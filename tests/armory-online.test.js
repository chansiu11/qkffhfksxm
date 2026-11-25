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

function message(ws, type) {
  return new Promise((resolve, reject) => {
    const listener = event => {
      const data = JSON.parse(event.data);
      if (data.type !== type) return;
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
after(() => new Promise(resolve => server.close(resolve)));
