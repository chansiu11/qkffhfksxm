'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
process.env.PORT = '0';
const { server, rooms } = require('../server/server.js');
function next(ws, type, timeout=3000) {
  return new Promise((resolve, reject) => {
    const timer=setTimeout(()=>{ws.removeEventListener('message', handler);reject(new Error(`Timed out waiting for ${type}`));},timeout);
    function handler(ev) {const data=JSON.parse(ev.data); if(data.type===type) {clearTimeout(timer);ws.removeEventListener('message',handler);resolve(data);} }
    ws.addEventListener('message',handler);
  });
}
async function connect(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  return ws;
}
test('Room creation/join, team capacity, start, synced player snapshots, damage', async () => {
  if (!server.listening) await once(server,'listening');
  const port=server.address().port;
  const health=await fetch(`http://127.0.0.1:${port}/health`).then(x=>x.json());
  assert.equal(health.ok,true);
  const a=await connect(port), b=await connect(port);
  const joinedA=next(a,'joined');a.send(JSON.stringify({type:'create',code:'07',winRounds:5}));
  const ja=await joinedA;assert.equal(ja.room.code,'07');
  const joinedB=next(b,'joined');b.send(JSON.stringify({type:'join',code:'07'}));
  const jb=await joinedB;assert.equal(jb.room.players.length,2);
  const startedA=next(a,'started'), startedB=next(b,'started');
  a.send(JSON.stringify({type:'start'}));
  await Promise.all([startedA,startedB]);
  const stateA=await next(a,'state');assert.equal(stateA.players.length,2);
  assert.equal(stateA.phase,'buy');
  const r=rooms.get('07');assert(r);
  const p=r.players.get(ja.id), q=r.players.get(jb.id);
  // Set a clear line of sight between test players in the open attacker lobby.
  p.x=0;p.z=40;p.y=1.65;p.footY=0;p.yaw=Math.PI;
  q.x=0;q.z=42;q.y=1.65;q.footY=0;q.yaw=0;
  r.phase='combat';r.until=Date.now()+50000;
  const hit=next(a,'hit');
  const visibleShot=next(b,'shot');
  a.send(JSON.stringify({type:'shoot',yaw:Math.PI,pitch:0}));
  const [result, tracer]=await Promise.all([hit,visibleShot]);
  assert.equal(result.headshot, true);
  assert.equal(tracer.shooter,ja.id);
  assert.equal(tracer.weapon,'classic');
  assert.equal(tracer.from.length,3);
  assert.equal(tracer.to.length,3);
  assert(tracer.to[2]>tracer.from[2], 'remote tracer travels toward target');
  assert(q.hp<100);

  // In open elevated space, unobstructed tracers use the full long-range limit.
  p.x=0;p.y=35;p.z=0;p.footY=33.35;
  q.x=50;q.z=50;q.y=35;q.footY=33.35;
  p.lastShot=0;
  const longShot=next(b,'shot');
  a.send(JSON.stringify({type:'shoot',yaw:0,pitch:0}));
  const far=await longShot;
  assert(Math.abs(far.to[2]+220)<0.05, `expected full-range tracer, got ${far.to[2]}`);

  // Positive pitch looks UP in the Three.js YXZ camera. Test both elevations
  // so server hit rays and visible tracers cannot drift from the crosshair.
  p.lastShot=0;
  const upward=next(b,'shot');
  a.send(JSON.stringify({type:'shoot',yaw:0,pitch:Math.PI/6}));
  const up=await upward;
  assert(up.to[1]>up.from[1], 'positive camera pitch must shoot upward');
  assert(Math.abs((up.to[1]-up.from[1]) / (up.from[2]-up.to[2]) - Math.tan(Math.PI/6))<0.001,
    'positive-pitch tracer slope must agree with the camera');

  p.lastShot=0;
  const downward=next(b,'shot');
  a.send(JSON.stringify({type:'shoot',yaw:0,pitch:-Math.PI/6}));
  const down=await downward;
  assert(down.to[1]<down.from[1], 'negative camera pitch must shoot downward');

  // SPIKE: B Site should be a valid plant site, and progress is server-authoritative.
  p.x=-27;p.z=-23;p.footY=0;p.y=1.65;p.heldSpike=true;
  p.actionFrom=Date.now()-4200;
  r.phase='combat';r.until=Date.now()+25000;
  await new Promise(resolve=>setTimeout(resolve,190));
  assert.equal(r.phase,'planted','B Site plant must complete after four seconds');
  assert.equal(r.spike?.site,'B');
  assert.equal(p.heldSpike,false,'server must clear held input after successful plant');
  // Defuse has a 3.5 second halfway checkpoint but still needs 7 seconds total.
  q.x=r.spike.x;q.z=r.spike.z;q.footY=r.spike.y;q.y=q.footY+1.65;
  q.heldSpike=true;q.actionFrom=Date.now()-3750;q.actionBase=0;
  await new Promise(resolve=>setTimeout(resolve,180));
  assert.equal(r.halfDefused,true);
  assert.equal(r.phase,'planted','continuous defuse must NOT finish at 3.5s');
  q.heldSpike=false;q.actionFrom=0;q.actionBase=0;
  await new Promise(resolve=>setTimeout(resolve,135));
  q.heldSpike=true;q.actionFrom=Date.now()-3500;q.actionBase=0.5;
  await new Promise(resolve=>setTimeout(resolve,155));
  assert.equal(r.phase,'round_end','resumed half-defuse should finish after 3.5 more seconds');

  a.send(JSON.stringify({type:'leave'}));b.send(JSON.stringify({type:'leave'}));
  await new Promise(resolve=>setTimeout(resolve,120));
  a.close();b.close();
  assert.equal(rooms.size,0);
});

test('Network resilience: ping timing, temporary disconnection, resume session and room recovery', async () => {
  if (!server.listening) await once(server,'listening');
  const port=server.address().port;
  const ws=await connect(port);
  const joinedPromise=next(ws,'joined');ws.send(JSON.stringify({type:'create',code:'81',winRounds:5}));
  const joined=await joinedPromise;
  assert.match(joined.token,/^[0-9a-f]{48}$/);
  const p=rooms.get('81').players.get(joined.id);
  assert.equal(p.team,joined.team);
  const pong=next(ws,'pong');ws.send(JSON.stringify({type:'ping',seq:12345}));
  assert.equal((await pong).seq,12345);
  const left=once(ws,'close');ws.close();await left;
  await new Promise(r=>setTimeout(r,50));
  assert(rooms.get('81')?.players.has(joined.id),'session must survive transient disconnection');
  assert.equal(p.client,null);
  const newSocket=await connect(port);
  const resumed=next(newSocket,'resumed');
  newSocket.send(JSON.stringify({type:'resume',code:'81',token:joined.token}));
  const rejoin=await resumed;
  assert.equal(rejoin.id,joined.id);
  assert.equal(rejoin.team,joined.team);
  assert.equal(p.client?.socket?.destroyed,false);
  assert.equal(rooms.get('81').players.size,1,'resume must not create a duplicate player');
  newSocket.send(JSON.stringify({type:'leave'}));
  await new Promise(r=>setTimeout(r,100));
  assert.equal(rooms.has('81'),false);
  newSocket.close();
});

test.after(async()=>{await new Promise(r=>server.close(r));});