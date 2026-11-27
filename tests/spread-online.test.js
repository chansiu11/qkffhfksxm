'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const ShootingSpread=require('../shooting-spread.js');
const ShotgunPellets=require('../shotgun-pellets.js');
const catalog=require('../server/weapons.json');
process.env.PORT='0';
process.env.BIND_HOST='127.0.0.1';
const {server,rooms}=require('../server/server.js');
function next(ws,type,timeout=8000){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.removeEventListener('message',on);reject(Error('no '+type));},timeout);
  function on(e){const m=JSON.parse(e.data);if(m.type===type){clearTimeout(timer);ws.removeEventListener('message',on);resolve(m)}}
  ws.addEventListener('message',on);
});}
async function connect(){if(!server.listening)await once(server,'listening');const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);await new Promise((res,rej)=>{socket.onopen=res;socket.onerror=rej;});return socket;}
async function setup(roomCode){
  const a=await connect(),b=await connect();
  let result=next(a,'joined');a.send(JSON.stringify({type:'create',code:roomCode}));const first=await result;
  result=next(b,'joined');b.send(JSON.stringify({type:'join',code:roomCode}));await result;
  result=next(a,'started');a.send(JSON.stringify({type:'start'}));await result;
  const r=rooms.get(roomCode),p=r.players.get(first.id);
  r.phase='combat';r.until=Date.now()+30_000;
  p.x=0;p.z=40;p.y=1.65;p.footY=0;p.yaw=Math.PI;p.pitch=0;
  const id='vandal',w=catalog[id];p.weapon=id;p.inventory.primary=id;
  p.mag=w.magSize;p.reserve=w.resSize;p.ammo[id]={mag:p.mag,reserve:p.reserve};
  p.lastShot=0;p.spreadState={};
  return {a,b,p,w,close(){a.send(JSON.stringify({type:'leave'}));b.send(JSON.stringify({type:'leave'}));a.close();b.close();}};
}
function compareFirst(ray,event,p){
  for(let axis=0;axis<3;axis++){
    const origin=[p.x,p.y,p.z][axis];
    assert(Math.abs(event.from[axis]-(origin+ray[axis]*.28))<.005,'online tracer must follow server ray component '+axis);
  }
}
test('online game shot uses shared deterministic movement+burst variation, not always crosshair center',async t=>{
  const f=await setup('82'),{a,b,p,w}=f;
  let gameTime=Date.now();
  t.mock.method(Date,'now',()=>gameTime);
  try{
    const seed=0x4db3c58e;
    const msg={type:'shoot',yaw:Math.PI,pitch:0,seed,scatter:0.3,burst:0,
      speed:7.6,airborne:false,crouched:false,ads:false,
      from:[0,1.65,40]};
    const expected=ShootingSpread.directions(w,{...msg,shotIndex:0},ShotgunPellets).vectors[0];
    const pending=next(b,'shot');a.send(JSON.stringify(msg));const shot=await pending;
    compareFirst(expected,shot,p);
    assert(Math.abs(expected[0])>.005||Math.abs(expected[1])>.005,'running changes shot direction');
    assert.equal(p.spreadState.count,0);
    gameTime+=Math.ceil(w.fireRate*1000);
    const follow={...msg,burst:1};
    const nextRay=ShootingSpread.directions(w,{...follow,shotIndex:1},ShotgunPellets).vectors[0];
    const p2=next(b,'shot');a.send(JSON.stringify(follow));const shot2=await p2.catch(error=>{throw new Error('Second shot did not reach the other client', {cause:error});});
    compareFirst(nextRay,shot2,p);assert.equal(p.spreadState.count,1);
    assert.notDeepEqual(nextRay,expected,'successive game shots should change trajectory');
  }finally{f.close();}
});
after(async()=>{await new Promise(resolve=>server.close(resolve));});