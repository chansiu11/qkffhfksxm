'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
process.env.PORT='0';
const {server,rooms}=require('../server/server.js');
const catalog=require('../server/weapons.json');
const wait=(ws,type,ms=2700)=>new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{ws.removeEventListener('message',fn);reject(Error(`Timed out on ${type}`));},ms);
  function fn(ev){const p=JSON.parse(ev.data);if(p.type!==type)return;clearTimeout(timeout);ws.removeEventListener('message',fn);resolve(p);}
  ws.addEventListener('message',fn);
});
async function connection(){if(!server.listening)await once(server,'listening');const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});return ws;}
async function setup(code){const a=await connection(),b=await connection();let pend=wait(a,'joined');a.send(JSON.stringify({type:'create',code}));const ja=await pend;pend=wait(b,'joined');b.send(JSON.stringify({type:'join',code}));const jb=await pend;pend=wait(a,'started');a.send(JSON.stringify({type:'start'}));await pend;const room=rooms.get(code),p=room.players.get(ja.id),q=room.players.get(jb.id);room.phase='combat';room.until=Date.now()+50000;
  p.x=0;p.y=1.65;p.footY=0;p.z=40;p.yaw=Math.PI;q.x=0;q.y=1.65;q.footY=0;q.z=42;q.yaw=0;
  return {a,b,p,q,room,close(){a.send(JSON.stringify({type:'leave'}));b.send(JSON.stringify({type:'leave'}));a.close();b.close();}};
}
test('server rejects mismatched reload request and echoes ID so client can unlock',async()=>{
  const f=await setup('91');
  try{
    const {a,p}=f;const denied=wait(a,'reload_cancelled');
    a.send(JSON.stringify({type:'reload',weapon:'operator',requestId:41}));
    const rejected=await denied;
    assert.equal(rejected.requestId,41);assert.equal(rejected.weapon,'operator');assert.equal(rejected.reason,'weapon_mismatch');
    assert.equal(p.reloading,false);
    p.weapon='classic';p.mag=1;p.reserve=35;p.ammo.classic={mag:1,reserve:35};
    const st=wait(a,'reload_started'),done=wait(a,'reload_done');
    a.send(JSON.stringify({type:'reload',weapon:'classic',requestId:42}));
    assert.equal((await st).requestId,42);
    const result=await done;
    assert.equal(result.requestId,42);assert.equal(result.mag,12);assert.equal(p.reloading,false);
  }finally{f.close();}
});
test('knife light/strong game attacks hit once, heavy rear swing uses game bonus; no bullets',async()=>{
  const f=await setup('92');
  try{
    const {a,b,p,q}=f;
    p.weapon='knife';p.inventory.knife='knife';q.hp=100;q.armor=0;
    const light=wait(a,'hit');const shotEvents=[];const listener=e=>{if(JSON.parse(e.data).type==='shot')shotEvents.push(e.data)};b.addEventListener('message',listener);
    a.send(JSON.stringify({type:'shoot',mode:'light',yaw:Math.PI,pitch:0,from:[p.x,p.y,p.z]}));
    const h=await light;assert.equal(h.damage,50);assert.equal(q.hp,50);assert.equal(h.headshot,false);
    q.hp=100;q.armor=50;q.yaw=Math.PI;p.lastShot=0;
    const heavy=wait(a,'hit'),kill=wait(a,'kill');
    a.send(JSON.stringify({type:'shoot',mode:'heavy',yaw:Math.PI,pitch:0,from:[p.x,p.y,p.z]}));
    const result=await heavy,down=await kill;
    assert.equal(down.weapon,'knife');assert.equal(result.damage,100);assert.equal(q.hp,0);
    assert.equal(shotEvents.length,0,'knife should have no bullet tracer events');
    b.removeEventListener('message',listener);
  }finally{f.close();}
});
test('knife game attack beyond range does not reach an opponent',async()=>{
  const f=await setup('93');try{const {a,p,q}=f;p.weapon='knife';p.z=40;q.z=46;
    a.send(JSON.stringify({type:'shoot',mode:'heavy',yaw:Math.PI,pitch:0}));
    await new Promise(ok=>setTimeout(ok,160));assert.equal(q.hp,100);
  }finally{f.close();}
});
after(async()=>{await new Promise(resolve=>server.close(resolve));});
test('buying a gun during reload allows the new gun to fire, reload, and fire again',async()=>{
  const f=await setup('94');
  try {
    const {a,p,room}=f;
    room.phase='buy'; p.credits=9000;
    p.mag=p.ammo.classic.mag=1;
    async function request(message,reply){
      const response=wait(a,reply);
      a.send(JSON.stringify(message));
      return response;
    }
    await request({type:'reload',weapon:'classic',requestId:1},'reload_started');
    await request({type:'buy',item:'ghost'},'purchase');
    assert.equal(p.reloading,false);
    room.phase='combat';
    const shot={type:'shoot',yaw:0,pitch:0};
    const remoteShot=()=>{const seen=wait(f.b,'shot');a.send(JSON.stringify(shot));return seen;};
    await remoteShot();
    const full=catalog.ghost.magSize;
    assert.equal(p.mag,full-1);
    const done=await request({type:'reload',weapon:'ghost',requestId:2},'reload_done');
    assert.equal(done.mag,full);
    assert.equal(done.reserve,catalog.ghost.resSize-1);
    await remoteShot();
    assert.equal(p.mag,full-1);
  } finally { f.close(); }
});
