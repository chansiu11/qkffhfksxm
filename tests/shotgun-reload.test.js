'use strict';
const { test }=require('node:test');
const { once }=require('node:events');
const assert=require('node:assert/strict');
process.env.PORT='0';
const {server,rooms}=require('../server/server.js');
const next=(ws,type,timeout=3000)=>new Promise((resolve,reject)=>{
  const t=setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(Error('Missing '+type));},timeout);
  function onMessage(event){const msg=JSON.parse(event.data);if(msg.type===type){clearTimeout(t);ws.removeEventListener('message',onMessage);resolve(msg);}}
  ws.addEventListener('message',onMessage);
});
async function join(port){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);await new Promise((ok,bad)=>{ws.onopen=ok;ws.onerror=bad;});return ws;}

test('Shotgun sends exactly one compact remote event containing each game pellet and one ammo charge',async()=>{
  if(!server.listening)await once(server,'listening');
  const port=server.address().port;
  const a=await join(port), b=await join(port);
  const pa=next(a,'joined');a.send(JSON.stringify({type:'create',code:'64',winRounds:5}));const ja=await pa;
  const pb=next(b,'joined');b.send(JSON.stringify({type:'join',code:'64'}));await pb;
  const started=next(a,'started');a.send(JSON.stringify({type:'start'}));await started;
  const r=rooms.get('64'),p=r.players.get(ja.id);
  p.weapon='shorty';p.inventory.secondary='shorty';p.mag=2;p.reserve=6;p.ammo.shorty={mag:2,reserve:6};
  p.x=0;p.y=34;p.z=0;p.footY=32.35;
  for(const q of r.players.values())if(q!==p){q.x=40;q.z=30;q.y=34;q.footY=32.35;}
  r.phase='combat';r.until=Date.now()+45000;p.lastShot=0;
  let count=0;const observer=event=>{if(JSON.parse(event.data).type==='shot')count++;};b.addEventListener('message',observer);
  const remote=next(b,'shot');a.send(JSON.stringify({type:'shoot',yaw:0,pitch:0,scatter:1.25}));
  const shot=await remote;
  await new Promise(ok=>setTimeout(ok,65));
  b.removeEventListener('message',observer);
  assert.equal(count,1,'pellet fan should be one WebSocket packet');
  assert.equal(shot.weapon,'shorty');
  assert.equal(shot.pellets.length,8);
  assert(shot.pellets.every(v=>v.length===3&&v.every(Number.isFinite)));
  assert(new Set(shot.pellets.map(v=>v.join(','))).size>4,'trails should have visibly distinct endpoints');
  assert.equal(p.mag,1,'one trigger pull consumes only one magazine round');

  // Reload synchronization must not refill a weapon after the user switched away.
  p.mag=0;p.ammo.shorty.mag=0;
  a.send(JSON.stringify({type:'reload',weapon:'shorty'}));
  await new Promise(ok=>setTimeout(ok,50));
  const cancel=next(a,'reload_cancelled');a.send(JSON.stringify({type:'equip',slot:'knife'}));await cancel;
  await new Promise(ok=>setTimeout(ok,1150));
  assert.equal(p.ammo.shorty.mag,0,'canceled reload must not fill old inventory');
  const equip=next(a,'inventory');a.send(JSON.stringify({type:'equip',slot:'secondary'}));await equip;
  const inventory=next(a,'inventory');a.send(JSON.stringify({type:'reload',weapon:'shorty'}));
  const after=await inventory;
  assert.equal(after.weapon,'shorty');assert.equal(after.mag,2);assert.equal(after.reserve,4);
  assert.equal(p.mag,2);
  a.send(JSON.stringify({type:'leave'}));b.send(JSON.stringify({type:'leave'}));
  await new Promise(ok=>setTimeout(ok,100));a.close();b.close();
  assert.equal(rooms.has('64'),false);
});

test.after(async()=>{await new Promise(ok=>server.close(ok));});