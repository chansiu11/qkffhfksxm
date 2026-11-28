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

function combatFixture(t){
  const crypto=require('node:crypto');
  const createRoomCore=require('../server/room-core.js');
  const rooms=new Map(), events=[];
  const a={id:'attacker'}, b={id:'defender'};
  const core=createRoomCore({
    rooms,crypto,catalog:require('../server/weapons.json'),ground:require('../config.js'),
    ShotgunPellets:require('../shotgun-pellets.js'),ShootingSpread:require('../shooting-spread.js'),
    MeleeRules:require('../melee-rules.js'),...require('../server/hit-registry.js'),
    send(client,message){if(client===a)events.push(message);},
    sendSnapshot(){}
  });
  const now=Date.now();
  t.mock.method(Date,'now',()=>now);
  core.receive(a,{type:'create',code:'71'});
  core.receive(b,{type:'join',code:'71'});
  core.receive(a,{type:'start'});
  const room=rooms.get('71'),p=room.players.get(a.id),q=room.players.get(b.id);
  room.phase='combat';
  room.until=now+50000;
  Object.assign(p,{x:0,y:1.65,footY:0,z:40,yaw:Math.PI});
  Object.assign(q,{x:0,y:1.65,footY:0,z:42,yaw:0});
  const fire=options=>core.receive(a,{type:'shoot',yaw:Math.PI,pitch:0,seed:0,from:[p.x,p.y,p.z],...options});
  return {p,q,events,now,fire};
}

test('rewind registers a headshot at the previous target position',t=>{
  const {p,q,events,now,fire}=combatFixture(t);
  gun(p,'vandal');
  q.armor=50;
  const seenAt=now-130;
  q.positionHistory=[{at:seenAt,x:0,z:42,footY:0,yaw:0},
    {at:seenAt+110,x:2,z:42,footY:0,yaw:0}];
  q.x=2;
  fire({seenAt});
  assert.equal(events.find(m=>m.type==='hit')?.headshot,true);
  assert.equal(events.find(m=>m.type==='kill')?.victim,q.id);
});

test('Operator chest shot deals 100 HP through heavy armor',t=>{
  const {p,q,events,fire}=combatFixture(t);
  gun(p,'operator');
  q.armor=50;
  fire({pitch:-Math.atan2(.36,2),ads:true});
  assert.equal(events.find(m=>m.type==='hit')?.damage,100);
  assert.equal(q.hp,0);
});

test('server applies Vandal leg damage to a separate leg hitbox',t=>{
  const {p,q,events,fire}=combatFixture(t);
  gun(p,'vandal');
  p.x=.16;
  p.y=.35;
  fire({});
  assert.equal(events.find(m=>m.type==='hit')?.damage,34);
  assert.equal(q.hp,66);
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
test('close Phantom headshot eliminates a full-health target with heavy armor',async()=>{
  const f=await setup('74');
  try {
    gun(f.p,'phantom');
    f.q.hp=100; f.q.armor=50;
    const hit=next(f.a,'hit');
    f.a.send(JSON.stringify({type:'shoot',yaw:Math.PI,pitch:0,from:[0,1.65,40]}));
    assert.equal((await hit).headshot,true);
    assert.equal(f.q.hp,0);
    assert.equal(f.q.alive,false);
  } finally { f.close(); }
});
