'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
process.env.PORT='0';
const {server,rooms}=require('../server/server.js');
function next(ws,type,ms=3500){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(Error(`Timed out: ${type}`));},ms);
    function onMessage(event){const p=JSON.parse(event.data);if(p.type===type){clearTimeout(timer);ws.removeEventListener('message',onMessage);resolve(p);}}
    ws.addEventListener('message',onMessage);
  });
}
async function connect(){if(!server.listening)await once(server,'listening');const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);await new Promise((ok,bad)=>{ws.onopen=ok;ws.onerror=bad;});return ws;}
function gun(p,id){const w=require('../server/weapons.json')[id];p.weapon=id;p.inventory[w.slot]=id;p.mag=w.magSize;p.reserve=w.resSize;p.ammo[id]={mag:p.mag,reserve:p.reserve};p.lastShot=0;p.reloading=false;}
async function setup(code){const a=await connect(),b=await connect();const pa=next(a,'joined');a.send(JSON.stringify({type:'create',code}));const ja=await pa;const pb=next(b,'joined');b.send(JSON.stringify({type:'join',code}));const jb=await pb;const st=next(a,'started');a.send(JSON.stringify({type:'start'}));await st;const r=rooms.get(code);const p=r.players.get(ja.id),q=r.players.get(jb.id);r.phase='combat';r.until=Date.now()+50000;p.x=0;p.y=1.65;p.footY=0;p.z=40;p.yaw=Math.PI;q.x=0;q.y=1.65;q.footY=0;q.z=42;q.yaw=0;return {a,b,r,p,q,close(){a.send(JSON.stringify({type:'leave'}));b.send(JSON.stringify({type:'leave'}));a.close();b.close();}};}

test('visible enemy headshot, with head position lag compensation, is lethal even through heavy armor',async()=>{
  const f=await setup('71');const {a,p,q}=f;
  try{
    gun(p,'vandal');q.hp=100;q.armor=50;q.x=0;
    // Display still shows the head where it was at the last server snapshot.
    const seenAt=Date.now()-130;
    q.positionHistory=[{at:seenAt,x:0,z:42,footY:0,yaw:0},{at:seenAt+110,x:2,z:42,footY:0,yaw:0}];
    q.x=2;
    const hit=next(a,'hit');const killed=next(a,'kill');
    a.send(JSON.stringify({type:'shoot',yaw:Math.PI,pitch:0,seenAt,from:[0,1.65,40]}));
    const [h,k]=await Promise.all([hit,killed]);
    assert.equal(h.headshot,true);assert.equal(k.victim,q.id);assert.equal(q.alive,false);
  }finally{f.close();}
});

test('Operator has a 100-HP one-shot to the chest even with 50 armor',async()=>{
  const f=await setup('72');const {a,p,q}=f;
  try{
    gun(p,'operator');q.hp=100;q.armor=50;
    const hit=next(a,'hit');const killed=next(a,'kill');
    a.send(JSON.stringify({type:'shoot',yaw:Math.PI,pitch:-Math.atan2(.72,2),from:[0,1.65,40]}));
    const [h,k]=await Promise.all([hit,killed]);
    assert.equal(h.headshot,false);assert(h.damage>=100);assert.equal(k.victim,q.id);
    assert.equal(q.hp,0);
  }finally{f.close();}
});

test('reload provides explicit started/done and replenishes the equipped magazine',async()=>{
  const f=await setup('73');const {a,p}=f;
  try{
    gun(p,'vandal');p.mag=3;p.reserve=40;p.ammo.vandal={mag:3,reserve:40};
    const started=next(a,'reload_started');const done=next(a,'reload_done');
    a.send(JSON.stringify({type:'reload',weapon:'vandal'}));
    const st=await started;assert.equal(st.weapon,'vandal');assert.equal(p.reloading,true);
    const end=await done;assert.equal(end.weapon,'vandal');assert.equal(end.mag,25);assert.equal(end.reserve,18);assert.equal(p.reloading,false);
    const res=next(a,'reload_cancelled');
    a.send(JSON.stringify({type:'reload',weapon:'vandal'}));
    const result=await res;assert.equal(result.weapon,'vandal');
  }finally{f.close();}
});

after(async()=>{await new Promise(resolve=>server.close(resolve));});