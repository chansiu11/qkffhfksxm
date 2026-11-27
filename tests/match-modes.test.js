'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {test} = require('node:test');
const ground = require('../config.js');
const createRoomCore = require('../server/room-core.js');
const catalog = require('../server/weapons.json');
const registry = require('../server/hit-registry.js');

function makeRoom(mode, map, count) {
  const rooms = new Map();
  const messages = [];
  const engine = createRoomCore({
    rooms, crypto, catalog, ground, ...registry,
    send(client, message) { if(client) messages.push([client.id, message]); },
    sendSnapshot() {},
  });
  const clients = Array.from({length:count}, (_, i) => ({id:String(i)}));
  engine.receive(clients[0], {type:'create', code:'42', mode, map});
  for(const client of clients.slice(1)) engine.receive(client, {type:'join', code:'42'});
  return {room:rooms.get('42'), host:clients[0], engine, messages};
}

function expire(engine, room) {
  engine.step(room, room.until);
}

test('normal uses the existing team spike rules and map', () => {
  const {room, host, engine} = makeRoom('normal','haven',2);
  engine.receive(host, {type:'start'});
  assert.equal(room.map,'haven');
  assert.equal(room.winRounds,13);
  assert.equal(room.phase,'buy');
  assert.ok(room.drops.some(item => item.id==='spike'));
});

test('swiftplay credits restart at halftime and 5–4 ends the match', () => {
  const {room, host, engine} = makeRoom('swift','ascent',2);
  const player = room.players.get(host.id);
  engine.receive(host, {type:'start'});
  const team = player.team;
  const winners = ['attack','defense','defense','attack','attack','defense','attack','defense','attack'];
  const credits = [800,3000,4250,6000,800,2400,4250,6000,6000];
  for(const [i, winner] of winners.entries()){
    assert.equal(room.round,i+1);
    assert.equal(room.phase,'buy');
    assert.equal(player.credits,credits[i]);
    assert.equal(player.team,i<4?team:'defense');
    expire(engine, room);
    assert.equal(room.phase,'combat');
    for(const p of room.players.values()) p.alive=p.team===winner;
    engine.step(room, room.until-1000);
    assert.equal(room.phase,'round_end');
    expire(engine, room);
  }
  assert.equal(room.started,false);
  assert.deepEqual(room.scores,{attack:5,defense:4});
});

test('deathmatch starts in combat, respawns at distance and ends at 40 or the time limit', () => {
  const {room, host, engine, messages} = makeRoom('deathmatch','haven',3);
  engine.receive(host, {type:'start'});
  assert.equal(room.phase,'combat');
  assert.equal(room.drops.length,0);
  assert.ok(room.until-Date.now()>539000);
  const [p,q,r] = engine.roomUsers(room);
  assert.equal(p.team,r.team);
  p.alive=false;
  const life=p.life;
  p.respawnAt=Date.now()+1500;
  engine.step(room, p.respawnAt-1);
  assert.equal(p.alive,false);
  engine.step(room, p.respawnAt);
  assert.equal(p.alive,true);
  assert.equal(p.life,life+1);
  assert.ok([q,r].every(other=>Math.hypot(p.x-other.x,p.z-other.z)>=14));
  p.kills=40;
  engine.step(room,Date.now());
  assert.equal(room.started,false);
  assert.ok(messages.some(([,m]) => m.type==='match_end' && m.winner===p.name));
  engine.receive(host, {type:'start'});
  assert.equal(p.kills,0);
  expire(engine,room);
  assert.equal(room.started,false);
});

test('arena enforces the four-player limit and maps switch with the mode', () => {
  const {room, host, engine, messages} = makeRoom('normal','haven',5);
  engine.receive(host,{type:'set_mode',mode:'duel'});
  assert.equal(room.map,'arenaA');
  engine.receive(host,{type:'set_map',map:'arenaC'});
  engine.receive(host,{type:'start'});
  assert.equal(room.started,false);
  assert.ok(messages.some(([,m])=>m.type==='error'&&m.message.includes('4명')));
  room.players.delete('4');
  engine.receive(host,{type:'start'});
  assert.equal(room.started,true);
  assert.equal(room.map,'arenaC');
  assert.equal(room.winRounds,10);
  assert.deepEqual(room.drops,[]);
  for(const side of ['attack','defense']){
    const players = engine.roomUsers(room).filter(p=>p.team===side);
    assert.equal(new Set(players.map(p=>p.x)).size,2);
  }
});

test('all arena routes have clearance through the teams’ shared collision geometry', () => {
  for(const id of ['arenaA','arenaB','arenaC']){
    const map=ground.maps[id];
    for(const path of map.routes.attack){
      for(let i=1;i<path.length;i++){
        const [x1,z1]=path[i-1], [x2,z2]=path[i];
        const steps=Math.ceil(Math.hypot(x2-x1,z2-z1)/.2);
        for(let k=0;k<=steps;k++){
          const x=x1+(x2-x1)*k/steps, z=z1+(z2-z1)*k/steps;
          const pos={x,z};
          ground.resolve(id,pos,ground.height(id,x,z),.62);
          assert.ok(Math.hypot(x-pos.x,z-pos.z)<.02,`${id} route blocked at ${x}, ${z}`);
        }
      }
    }
  }
});
