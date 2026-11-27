'use strict';
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const catalog = require('../server/weapons.json');
process.env.PORT = '0';
process.env.BIND_HOST = '127.0.0.1';
const {server, rooms} = require('../server/server.js');

async function connect() {
  if (!server.listening) await once(server, 'listening');
  const ws = new WebSocket('ws://127.0.0.1:' + server.address().port + '/ws');
  await once(ws, 'open');
  return ws;
}

function message(ws, type, matches = () => true) {
  return new Promise((resolve, reject) => {
    const listener = event => {
      const data = JSON.parse(event.data);
      if (data.type !== type || !matches(data)) return;
      clearTimeout(timer);
      ws.removeEventListener('message', listener);
      resolve(data);
    };
    const timer = setTimeout(() => {
      ws.removeEventListener('message', listener);
      reject(new Error('Timed out waiting for ' + type));
    }, 8000);
    ws.addEventListener('message', listener);
  });
}

async function exchange(sender, command, reply, recipient = sender) {
  const pending = message(recipient, reply);
  sender.send(JSON.stringify(command));
  return pending;
}

for (const [index, id] of ['bandit','outlaw','ares','odin','warden'].entries()) {
  test(id + ' purchase, remote shot and magazine refill', async t => {
    const a = await connect();
    t.after(() => a.close());
    const b = await connect();
    t.after(() => b.close());
    const code = String(90 + index);
    const joined = await exchange(a, {type:'create', code}, 'joined');
    await exchange(b, {type:'join', code}, 'joined');
    await exchange(a, {type:'start'}, 'started');
    const room = rooms.get(code);
    const buyer = room.players.get(joined.id);
    const weapon = catalog[id];
    buyer.credits = 9000;
    const purchase = await exchange(a, {type:'buy', item:id}, 'purchase');
    assert.equal(purchase.item, id);
    assert.equal(purchase.credits, 9000 - weapon.cost);
    assert.equal(purchase.mag, weapon.magSize);
    assert.equal(buyer.inventory[weapon.slot], id);
    room.phase = 'combat';
    room.until = Date.now() + 30000;
    await new Promise(resolve => setTimeout(resolve, weapon.equipTime * 1000 + 30));
    const shot = await exchange(a, {type:'shoot',yaw:0,pitch:1,seed:123}, 'shot', b);
    assert.equal(shot.shooter, joined.id);
    assert.equal(shot.weapon, id);
    assert.equal(buyer.mag, weapon.magSize - 1);
    const done = message(a, 'reload_done');
    const started = await exchange(a, {type:'reload',weapon:id,requestId:1}, 'reload_started');
    assert.equal(started.remainingMs, Math.round((weapon.reloadTime || 1.1) * 1000));
    const result = await done;
    assert.deepEqual([result.weapon,result.mag,result.reserve], [id,weapon.magSize,weapon.resSize-1]);
  });
}
test('two clients see the selected mode, map and match start over WebSocket', async t => {
  const host = await connect();
  t.after(() => host.close());
  const guest = await connect();
  t.after(() => guest.close());
  const code = '96';
  await exchange(host, {type:'create', code, mode:'swift', map:'haven'}, 'joined');
  const joined = await exchange(guest, {type:'join', code}, 'joined');
  assert.equal(joined.room.mode,'swift');
  assert.equal(joined.room.map,'haven');
  assert.equal(joined.room.winRounds,5);

  const arenaLobby = await exchange(host, {type:'set_mode', mode:'duel'}, 'lobby', guest);
  assert.equal(arenaLobby.room.mode,'duel');
  assert.equal(arenaLobby.room.map,'arenaA');
  const arenaC = await exchange(host, {type:'set_map', map:'arenaC'}, 'lobby', guest);
  assert.equal(arenaC.room.map,'arenaC');
  assert.equal(arenaC.room.winRounds,10);

  const guestStarts = message(guest, 'started');
  await exchange(host, {type:'start'}, 'started');
  await guestStarts;
  const [hostState, guestState] = await Promise.all([message(host,'state'),message(guest,'state')]);
  for(const state of [hostState, guestState]){
    assert.equal(state.mode,'duel');
    assert.equal(state.phase,'buy');
    assert.equal(state.winRounds,10);
    assert.equal(state.players.length,2);
    assert.deepEqual(state.drops,[]);
    assert.deepEqual(state.players.map(p=>p.z).sort((a,b)=>a-b),[-19,19]);
  }
  const combat = message(guest, 'state', state => state.phase === 'combat');
  host.send(JSON.stringify({type:'skip'}));
  await combat;
});

after(() => new Promise(resolve => server.close(resolve)));
