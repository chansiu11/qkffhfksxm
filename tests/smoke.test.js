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
  a.send(JSON.stringify({type:'shoot',yaw:Math.PI,pitch:0}));
  const result=await hit;
  assert.equal(result.headshot, true);
  assert(q.hp<100);
  a.close();b.close();
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(rooms.size,0);
});
test.after(async()=>{await new Promise(r=>server.close(r));});