'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const catalog = require('./weapons.json');
const ground = require('../config.js');
const ShotgunPellets = require('../shotgun-pellets.js');
const ShootingSpread = require('../shooting-spread.js');
const MeleeRules = require('../melee-rules.js');
const {recordPosition, samplePosition, rayCharacter, MAX_REWIND_MS} = require('./hit-registry.js');
const PORT = process.env.PORT == null ? 10000 : Number(process.env.PORT);
const rooms = new Map();
const clients = new Set();
const TICK_MS = 100; // 10 Hz server snapshots; render/aim stays local for low latency.
const REJOIN_GRACE_MS = 45000;
const MAX_BACKLOG_BYTES = 96 * 1024;
const MAX_MSG = 8192;
const LIMIT = ground.limit;

// A small RFC6455 JSON/WebSocket transport: no third-party packages or builds.
function writeFrame(socket, opcode, data = Buffer.alloc(0)) {
  if (!socket.writable) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const head = payload.length < 126 ? Buffer.from([0x80 | opcode, payload.length]) :
    Buffer.from([0x80 | opcode, 126, (payload.length >>> 8) & 255, payload.length & 255]);
  // Never let a slow peer queue unlimited traffic and stall the whole room.
  if (!socket.destroyed && socket.writableLength < MAX_BACKLOG_BYTES) socket.write(Buffer.concat([head, payload]));
}
function send(c, msg) {
  if (!c || c.closed || !c.socket.writable || c.socket.destroyed) return false;
  // Movement snapshots are disposable. Drop outdated states rather than building
  // up seconds of buffering over a slow phone or unstable mobile network.
  if (msg.type === 'state' && c.socket.writableLength > 24 * 1024) return false;
  writeFrame(c.socket, 1, JSON.stringify(msg));
  return true;
}
function removePlayer(r, id) {
  const p = r.players.get(id);
  if (!p) return;
  r.players.delete(id);
  if (p.rejoinTimer) clearTimeout(p.rejoinTimer);
  if (r.host === id) r.host = r.players.keys().next().value || null;
  if (!r.players.size) rooms.delete(r.code);
  else { broadcastLobby(r); broadcastState(r); }
}
function close(c, immediate = false) {
  if (c.closed) return;
  c.closed = true;
  try { c.socket.destroy(); } catch (_) {}
  clients.delete(c);
  const r = c.room;
  c.room = null;
  if (!r) return;
  const p = r.players.get(c.id);
  if (!p || p.client !== c) return; // superseded by a resumed connection
  p.client = null;
  if (immediate) { removePlayer(r, c.id); return; }
  p.disconnectedAt = Date.now();
  // Preserve the player identity, team, round and inventory during short outages.
  // A room on a restarted free-tier instance cannot be recovered without DB storage.
  p.rejoinTimer = setTimeout(() => {
    if (!p.client && r.players.get(p.id) === p) removePlayer(r, p.id);
  }, REJOIN_GRACE_MS);
  p.rejoinTimer.unref?.();
  broadcastLobby(r);
}
function consume(c, chunk) {
  c.buffer = Buffer.concat([c.buffer, chunk]);
  if (c.buffer.length > 64 * 1024) return close(c);
  while (c.buffer.length >= 2) {
    const h = c.buffer;
    const op = h[0] & 15;
    const fin = (h[0] & 128) !== 0;
    const masked = (h[1] & 128) !== 0;
    let length = h[1] & 127, offset = 2;
    if (!masked || !fin) return close(c);
    if (length === 126) {
      if (h.length < 4) return;
      length = h.readUInt16BE(2); offset = 4;
    } else if (length === 127) return close(c);
    if (length > MAX_MSG) return close(c);
    if (h.length < offset + 4 + length) return;
    const key = h.subarray(offset, offset + 4);
    const payload = Buffer.from(h.subarray(offset + 4, offset + 4 + length));
    for (let i = 0; i < length; i++) payload[i] ^= key[i & 3];
    c.buffer = h.subarray(offset + 4 + length);
    if (op === 8) { close(c); return; }
    if (op === 9) { writeFrame(c.socket, 10, payload); continue; }
    if (op !== 1) continue;
    try { receive(c, JSON.parse(payload.toString('utf8'))); }
    catch (_) { send(c, { type: 'error', message: 'Malformed message.' }); }
  }
}
const server = http.createServer((req, res) => {
  const headers = { 'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'https://chansiu11.github.io', 'cache-control': 'no-store' };
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true, service: 'qkffhfksxm-realtime', buyGateRevision: 'ascent-garden-wall9', rooms: rooms.size, players: clients.size }));
  } else { res.writeHead(404, headers); res.end('{}'); }
});
server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin || '';
  const allowOrigins = (process.env.ALLOWED_ORIGINS || 'https://chansiu11.github.io,http://localhost:8080,http://127.0.0.1:8080').split(',');
  if (req.url !== '/ws' || req.headers.upgrade?.toLowerCase() !== 'websocket' ||
      (origin && !allowOrigins.includes(origin)) || !/^[A-Za-z0-9+/]{22}==$/.test(req.headers['sec-websocket-key'] || '')) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
  }
  const key = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + key + '\r\n\r\n');
  const c = { socket, id: crypto.randomUUID(), buffer: Buffer.alloc(0), room: null, closed: false, lastMessage: 0 };
  clients.add(c);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 12000);
  socket.on('data', chunk => consume(c, chunk));
  socket.on('error', () => close(c));
  socket.on('close', () => close(c));
  if (head?.length) consume(c, head);
  send(c, { type: 'hello', id: c.id });
});

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function finite(v, lo, hi, fallback) { return typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback; }
function otherTeam(t) { return t === 'attack' ? 'defense' : 'attack'; }
function roomUsers(r) { return [...r.players.values()]; }
function emitRoom(r, m) { for (const p of r.players.values()) send(p.client, m); }
function lobbyInfo(r) { return { map:r.map, code: r.code, host: r.host, winRounds: r.winRounds, started: r.started, phase: r.phase,
  players: roomUsers(r).map(p => ({ id: p.id, name: p.name, team: p.team, online: !!p.client })) }; }
function broadcastLobby(r) { emitRoom(r, { type: 'lobby', room: lobbyInfo(r) }); }
function notify(c, message) { send(c, { type: 'error', message }); }
function spawn(p, idx, map, keepWeapons = false) {
  const atk = p.team === 'attack';
  const [x,z]=ground.maps[map].labels[atk?'Attacker Side Spawn':'Defender Side Spawn'];
  p.x=x+(idx%5-2)*1.15;p.z=z;
  p.footY=ground.height(map,p.x,z);p.y=p.footY+1.65;
  p.yaw = atk ? 0 : Math.PI;
  p.pitch = 0;
  p.hp = 100;
  p.armor = 0;
  p.alive = true;
  if (!keepWeapons) {
    p.weapon = 'classic';
    p.inventory = { primary: null, secondary: 'classic', knife: 'knife' };
  }
  p.ammo = {};
  for (const id of Object.values(p.inventory).filter(Boolean)) {
    p.ammo[id] = {mag:catalog[id].magSize,reserve:catalog[id].resSize};
  }
  p.mag = p.ammo[p.weapon].mag;
  p.reserve = p.ammo[p.weapon].reserve;
  p.reloading = false;
  p.reloadWeapon = null;
  p.reloadEndsAt = 0;
  p.reloadSeq = (p.reloadSeq || 0) + 1;
  p.heldSpike = false;
  p.actionFrom = 0;
  p.actionBase = 0;
  p.lastPosAt = 0;
  p.bulldogCount=0;p.lastShot = 0;p.lastInterval=0;p.equipUntil=0;
  p.spreadState = {};
  p.movementSpeed = 0;
  p.lastMovedAt = 0;
  p.positionHistory=[];
  recordPosition(p);
}
function createRoom(c, msg) {
  if (c.room) return notify(c, '이미 방에 참가했습니다.');
  const code = String(msg.code || '');
  if (!/^\d{2}$/.test(code)) return notify(c, '방 코드는 숫자 2자리여야 합니다.');
  const creating = msg.type === 'create';
  let r = rooms.get(code);
  if (creating && r) return notify(c, '이미 사용 중인 코드입니다. 다른 코드를 선택하세요.');
  if (!creating && !r) return notify(c, '해당 코드의 방이 없습니다.');
  if (r && r.players.size >= 10) return notify(c, '방 정원이 가득 찼습니다.');
  if (r && r.started) return notify(c, '진행 중인 경기는 참가할 수 없습니다.');
  if (!r) {
    r = { code, map:msg.map==='haven'?'haven':'ascent', host: c.id, winRounds: msg.winRounds === 5 ? 5 : 13,
      players: new Map(), started: false, phase: 'waiting', round: 1,
      scores: { attack: 0, defense: 0 }, until: 0, spike: null, halfDefused: false };
    rooms.set(code, r);
  }
  const team = roomUsers(r).filter(p => p.team === 'attack').length <= roomUsers(r).filter(p => p.team === 'defense').length ? 'attack' : 'defense';
  const p = { id: c.id, client: c, name: `PLAYER ${r.players.size + 1}`, team, credits: 800,
    sessionToken: crypto.randomBytes(24).toString('hex'), disconnectedAt: 0, rejoinTimer: null };
  spawn(p, r.players.size,r.map);
  r.players.set(c.id, p);
  c.room = r;
  send(c, { type: 'joined', id: c.id, token: p.sessionToken, team, room: lobbyInfo(r) });
  broadcastLobby(r);
}
function resumeRoom(c, msg) {
  if (c.room) return notify(c, 'Already connected');
  const r = rooms.get(String(msg.code || ''));
  const token = String(msg.token || '');
  const p = r && token.length === 48 ? roomUsers(r).find(u => u.sessionToken === token) : null;
  if (!p) {
    send(c, { type: 'resume_failed', message: '재접속할 방이 없습니다. 방을 다시 만드세요.' });
    return;
  }
  if (p.rejoinTimer) { clearTimeout(p.rejoinTimer); p.rejoinTimer = null; }
  const old = p.client;
  p.client = c;
  p.disconnectedAt = 0;
  c.id = p.id;
  c.room = r;
  if (old && old !== c) close(old, true);
  send(c, {type:'resumed',id:p.id,token:p.sessionToken,team:p.team,
    started:r.started,room:lobbyInfo(r)});
  if (r.started) send(c, snapshot(r));
  broadcastLobby(r);
}
function resetRound(r) {
  r.objects=Object.fromEntries(Object.entries(ground.interactives[r.map]||{}).map(([id,item])=>[id,{hp:item.hp,closed:false}]));
  r.phase = 'buy';
  r.until = Date.now() + 16000;
  r.spike = null;
  r.halfDefused = false;
  const users = roomUsers(r);
  users.forEach((p, i) => {
    spawn(p, i, r.map,p.alive && r.round !== 1 && r.round !== r.winRounds);
    if (r.round === 1) p.credits = 800;
  });
  emitRoom(r, { type: 'round', round: r.round });
}
function endRound(r, team, reason) {
  if (r.phase === 'round_end' || !r.started) return;
  r.scores[team]++;
  r.phase = 'round_end';
  r.until = Date.now() + 3500;
  for (const p of r.players.values()) p.credits = clamp(p.credits + (team === p.team ? 3000 : 1900), 0, 9000);
  emitRoom(r, { type: 'round_end', team, reason });
}
function start(r) {
  r.started = true;
  r.round = 1;
  r.scores.attack = r.scores.defense = 0;
  resetRound(r);
  emitRoom(r, { type: 'started' });
  broadcastLobby(r);
}
function raySphere(ox,oy,oz,dx,dy,dz,x,y,z,r) {
  const vx=ox-x, vy=oy-y, vz=oz-z;
  const b=vx*dx+vy*dy+vz*dz;
  const c=vx*vx+vy*vy+vz*vz-r*r;
  const d=b*b-c;
  if(d<0) return Infinity;
  const t=-b-Math.sqrt(d);
  return t>=0?t:Infinity;
}
function rayBox(ox,oy,oz,dx,dy,dz,b) {
  if(b.frame){
    const {x,z,c,s}=b.frame,px=ox-x,pz=oz-z;
    ox=c*px-s*pz;oz=s*px+c*pz;
    const localX=c*dx-s*dz;dz=s*dx+c*dz;dx=localX;
    oy-=b.frame.slope*oz;dy-=b.frame.slope*dz;
  }
  let near=0,far=260;
  for(const [o,d,lo,hi] of [[ox,dx,b[0],b[1]],[oy,dy,b[2],b[3]],[oz,dz,b[4],b[5]]]) {
    if(Math.abs(d)<1e-9) { if(o<lo||o>hi)return Infinity; continue; }
    const a=(lo-o)/d, z=(hi-o)/d;
    near=Math.max(near,Math.min(a,z)); far=Math.min(far,Math.max(a,z));
    if(near>far)return Infinity;
  }
  return near;
}
function mapImpact(r,ox,oy,oz,dx,dy,dz,range){
    let impactDistance = ground.hitDistance(r.map,ox,oy,oz,dx,dy,dz,range);
    for (const b of ground.maps[r.map].blockers) {
      const wall = rayBox(ox, oy, oz, dx, dy, dz, b);
      if (wall < impactDistance) impactDistance = wall;
    }
    let struck=null;
    for(const [id,state] of Object.entries(r.objects||{})){
      if(state.hp<=0)continue;
      const obj=ground.interactives[r.map][id], box=[...obj.box];
      if(obj.lift && !state.closed){box[2]+=obj.lift;box[3]+=obj.lift;}
      const distance=rayBox(ox,oy,oz,dx,dy,dz,box);
      if(distance<impactDistance){impactDistance=distance;struck=state;}
    }
    return {impactDistance,struck};
}
function worldSound(r,p,kind){
  for(const q of r.players.values()){
    if(kind==='step'&&q===p)continue;
    if(Math.hypot(q.x-p.x,q.z-p.z)<(kind==='step'?40:60))
      send(q.client,{type:'world_sound',source:p.id,kind,x:p.x,z:p.z,y:kind==='step'?p.footY+.12:p.footY+.8});
  }
}
function planting(r,p){return p.heldSpike&&r.phase==='combat'&&p.team==='attack'&&spikeSite(p.x,p.z,p.footY,r.map);}
function fire(r, p, msg) {
  const blockers = ground.maps[r.map].blockers;
  if (r.phase !== 'combat' && r.phase !== 'planted') return;
  if (!p.alive || p.reloading || planting(r,p)) return;
  const w = catalog[p.weapon] || catalog.classic;
  const now = Date.now();
  const meleeMode = MeleeRules.modeFor(msg.mode);
  if(now-p.lastShot>500)p.bulldogCount=0;
  const cooldown = w.id === 'knife' ? MeleeRules.MODES[meleeMode].cooldown : (msg.ads && w.id==='bulldog' ? (((p.bulldogCount||0)%3===2)?.325:.075) : ((msg.ads?w.scopedInterval:0)||w.fireRate));
  if (now < p.equipUntil || now - p.lastShot < ((p.lastInterval??cooldown) * 1000 - 8)) return;
  if (w.id !== 'knife' && p.mag <= 0) {send(p.client,{type:'ammo_sync',weapon:p.weapon,mag:p.mag,reserve:p.reserve});return;}
  p.lastShot = now;
      p.bulldogCount=msg.ads&&w.id==='bulldog'?((p.bulldogCount||0)+1)%3:0;p.lastInterval=cooldown;
  if (w.id !== 'knife') p.mag--;
  if (p.ammo?.[p.weapon]) p.ammo[p.weapon].mag = p.mag;
  const yaw = finite(msg.yaw, -100000, 100000, p.yaw);
  const pitch = finite(msg.pitch, -1.48, 1.48, p.pitch);
  const spreadRotation = finite(msg.scatter, 0, Math.PI * 2, 0);
  // Virtual shooting spread is reconstructed from the same deterministic seed
  // as the client. The room owns the burst history; clients cannot force an
  // arbitrary high/low recoil state after a long sequence of shots.
  let directions=[];
  if(w.id!=='knife') {
    const state=p.spreadState||(p.spreadState={});
    const serverBurst=ShootingSpread.burstIndex(state,w,now);
    const claimedBurst=finite(msg.burst,0,19,serverBurst);
    const burst=Math.abs(claimedBurst-serverBurst)<=1?claimedBurst:serverBurst;
    ShootingSpread.confirmShot(state,w,now,burst);
    // Recent observed movement prevents zero-speed requests while running.
    const recentMove=now-(p.lastMovedAt||0)<190?p.movementSpeed||0:0;
    const clientMove=finite(msg.speed,0,8.5,recentMove);
    const speed=Math.max(clientMove,recentMove*.70);
    const roll=ShootingSpread.directions(w, {
      yaw,pitch,shotIndex:burst,seed:finite(msg.seed,0,4294967295,0),
      speed,airborne:msg.airborne===true,crouched:msg.crouched===true,
      ads:msg.ads===true,scatter:spreadRotation
    }, ShotgunPellets);
    directions=roll.vectors;
  }
  // Use the current camera origin if it is consistent with the last server move.
  // The move packet can arrive up to one network tick after the shot.
  const from=Array.isArray(msg.from)&&msg.from.length===3&&msg.from.every(Number.isFinite)?msg.from:null;
  const useFrom=from && Math.hypot(from[0]-p.x,from[2]-p.z)<1.05 && Math.abs(from[1]-p.y)<.65 &&
    !blockers.some(box => rayBox(p.x,p.y,p.z,from[0]-p.x,from[1]-p.y,from[2]-p.z,box)<=1);
  const ox=useFrom?from[0]:p.x,oy=useFrom?from[1]:p.y,oz=useFrom?from[2]:p.z;
  // Clients aim at the interpolated previous snapshot; rewind ONLY character
  // positions, never walls, by a strictly bounded amount of server time.
  const shotAt=finite(msg.seenAt,now-MAX_REWIND_MS,now,now);
  if (w.id === 'knife') {
    const candidates = [...r.players.values()].filter(target => target.alive && target.team !== p.team)
      .map(target => Object.assign({player: target, alive: true}, samplePosition(target, shotAt)));
    const meleeHit = MeleeRules.selectTarget({x: ox,y: oy,z: oz}, yaw,pitch,meleeMode,candidates,
      (target, info) => {
        // Walls block swings; a melee attack can never hit through a barrier.
        const dy=info.bodyY-oy,dist3=Math.hypot(info.dx,dy,info.dz);
        if (dist3 <= .02) return false;
        const panels=Object.entries(r.objects||{}).filter(([,state])=>state.hp>0).map(([id,state])=>{
          const item=ground.interactives[r.map][id],box=[...item.box];
          if(item.lift&&!state.closed){box[2]+=item.lift;box[3]+=item.lift;}
          return box;
        });
        for(const block of blockers.concat(panels)) {
          const t=rayBox(ox,oy,oz,info.dx/dist3,dy/dist3,info.dz/dist3,block);
          if(t>.04 && t<dist3-.30)return false;
        }
        return true;
      });
    if(!meleeHit){
      const spec=MeleeRules.MODES[meleeMode],cp=Math.cos(pitch);
      const {struck}=mapImpact(r,ox,oy,oz,-Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp,spec.range);
      if(struck)struck.hp=Math.max(0,struck.hp-spec.damage);
    }
    if (meleeHit) {
      const target=meleeHit.target.player;
      const damage=meleeHit.damage;
      const armorDamage=Math.min(target.armor, Math.round(damage*.55));
      target.armor-=armorDamage;
      target.hp=Math.max(0,target.hp-(damage-armorDamage));
      send(p.client,{type:'hit',headshot:false,damage:damage-armorDamage,pelletsHit:1});
      if(target.hp===0){
        target.alive=false;p.credits=clamp(p.credits+200,0,9000);
        emitRoom(r,{type:'kill',killer:p.id,victim:target.id,weapon:'knife',headshot:false});
        if(!roomUsers(r).some(q=>q.team===target.team&&q.alive)&&!r.spike)
          endRound(r,p.team,'TEAM ELIMINATED');
      }
    }
    return;
  }
  let totalDamage = 0, anyHeadshot = false, hitCount = 0;
  const taggedPlayers = new Set();
  const ends = [], effects = [];
  for (const [dx, dy, dz] of directions) {
    let {impactDistance,struck}=mapImpact(r,ox,oy,oz,dx,dy,dz,w.range);
    let best = impactDistance, hit = null, headshot = false, legshot = false;
    for (const target of r.players.values()) {
      if (!target.alive || target.team === p.team) continue;
      const intersection=rayCharacter(ox,oy,oz,dx,dy,dz,target,shotAt);
      if(intersection && intersection.distance<best) {
        best=intersection.distance;hit=target;headshot=intersection.headshot;legshot=intersection.legshot;
      }
    }
    if (hit) {
      impactDistance = best;
      const damage=ShootingSpread.applyGunDamage(hit,w.id,best,headshot?'head':legshot?'leg':'body');
      taggedPlayers.add(hit);
      totalDamage += damage; hitCount++; anyHeadshot ||= headshot;
      effects.push({point:[ox+dx*best,oy+dy*best,oz+dz*best],head:!!headshot});
      if (hit.hp === 0) {
        hit.alive = false; p.credits = clamp(p.credits + 200, 0, 9000);
        emitRoom(r, {type:'kill', killer:p.id, victim:hit.id, weapon:p.weapon, headshot});
        if (!roomUsers(r).some(q => q.team === hit.team && q.alive) && !r.spike)
          endRound(r, p.team, 'TEAM ELIMINATED');
      }
    }
    if(!hit && struck)struck.hp=Math.max(0,struck.hp-w.bodyDmg);
    ends.push([Math.round((ox + dx * impactDistance) * 100) / 100,
      Math.round((oy + dy * impactDistance) * 100) / 100,
      Math.round((oz + dz * impactDistance) * 100) / 100]);
  }
  if (w.id !== 'knife') {
    // One compact event per trigger pull, even with eight or ten visible pellets.
    const first = directions[0];
    const shot = {type:'shot', shooter:p.id, weapon:p.weapon,
      from:[ox + first[0] * .28, oy + first[1] * .28, oz + first[2] * .28],
      to:ends[0], pellets:directions.length > 1 ? ends : undefined};
    for (const receiver of r.players.values())
      if (receiver.id !== p.id) send(receiver.client, shot);
  }
  for (const target of taggedPlayers) if(target.alive) send(target.client,{type:'bullet_tag'});
  if (hitCount) send(p.client, {type:'hit', headshot:anyHeadshot,
    damage:totalDamage, pelletsHit:hitCount,effects});
}

function cancelEquipmentReload(p) {
  if (!p.reloading) return;
  const weapon=p.reloadWeapon;
  p.reloading=false;
  p.reloadWeapon=null;
  p.reloadEndsAt=0;
  p.reloadSeq=(p.reloadSeq||0)+1;
  send(p.client,{type:'reload_cancelled',weapon,reason:'switched'});
}

function receive(c,m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.type !== 'string') return;
  const now=Date.now();
  c.lastMessage=now;
  if (m.type === 'ping') { send(c,{type:'pong',seq:m.seq}); return; }
  if (m.type === 'leave') { close(c, true); return; }
  if (m.type === 'resume') { resumeRoom(c,m); return; }
  if (m.type === 'create' || m.type === 'join') { createRoom(c,m); return; }
  const r=c.room, p=r?.players.get(c.id);
  if (!r || !p) return;
  if (m.type==='use_door') {
    const item=Object.hasOwn(ground.interactives[r.map],m.id) && ground.interactives[r.map][m.id];
    const door=r.objects?.[m.id];
    if (r.started && p.alive && ['buy','combat','planted'].includes(r.phase) && item?.switchAt && door?.hp>0 &&
        Math.hypot(p.x-item.switchAt[0],p.z-item.switchAt[1])<=3) door.closed=true;
    return;
  }
  if (m.type === 'set_map') {
    if (r.host !== p.id || r.started || !['ascent','haven'].includes(m.map)) return;
    r.map = m.map;
    broadcastLobby(r);
    return;
  }
  if (m.type === 'chat') {
    if (!r.started || typeof m.text !== 'string' || m.text.length > 180) return;
    const text = m.text.replace(/\s+/gu, ' ').trim();
    const channel=m.channel===undefined?'all':m.channel;
    if (!text || (channel!=='team' && channel!=='all')) return;
    const message={type:'chat',channel,team:p.team,name:p.name,text};
    for (const recipient of r.players.values()) {
      if (channel==='all' || recipient.team===p.team) send(recipient.client,message);
    }
    return;
  }
  if (m.type==='team' && !r.started) {
    const team=m.team==='defense'?'defense':'attack';
    if (roomUsers(r).filter(q=>q.team===team).length >= 5) return notify(c,'해당 팀이 가득 찼습니다.');
    p.team=team; broadcastLobby(r);
  } else if(m.type==='start' && r.host===p.id && !r.started) start(r);
  else if(m.type==='skip' && r.host===p.id && r.phase==='buy')r.until=now;
  else if(m.type==='equip' && r.started) {
    const slot=String(m.slot||'');
    const item=p.inventory?.[slot];
    if(!item||!catalog[item])return;
    if (p.weapon !== item) {cancelEquipmentReload(p);p.bulldogCount=0;p.lastShot=0;p.lastInterval=0;p.equipUntil=now+1000*catalog[item].equipTime;}
    p.weapon=item;
    p.mag=p.ammo[item]?.mag ?? catalog[item].magSize;
    p.reserve=p.ammo[item]?.reserve ?? catalog[item].resSize;
    send(c, {type:'inventory',weapon:item,mag:p.mag,reserve:p.reserve});
  }
  else if(m.type==='move' && r.started && p.alive && ['combat','buy','planted'].includes(r.phase)) {
    if(planting(r,p)){p.y=p.footY+1.2;return;}
    const x=finite(m.x,-LIMIT,LIMIT,p.x),z=finite(m.z,-LIMIT,LIMIT,p.z),
          footY=finite(m.footY,-5,16,p.footY),y=finite(m.y,-4,20,p.y);
    const dt=p.lastPosAt?clamp((now-p.lastPosAt)/1000,0.03,0.35):0.2;
    // Server bounds movement speed and does not accept arbitrary teleports.
    const moved=Math.hypot(x-p.x,z-p.z);
    if(moved<=12.0*dt+0.8 && Math.abs(footY-p.footY)<4.0) {
      if(moved>.015) {
        p.movementSpeed=clamp(moved/dt,0,8.5);
        p.lastMovedAt=now;
      } else if(now-(p.lastMovedAt||0)>160) p.movementSpeed=0;
      const next={x,z};
      let gateCorrected=false;
      const applyGate=()=>{
        const beforeX=next.x,beforeZ=next.z;
        ground.stopAtGate(r.map,p.team,p.x,p.z,next,.62);
        gateCorrected ||= Math.hypot(next.x-beforeX,next.z-beforeZ)>.001;
      };
      if(r.phase==='buy')applyGate();
      ground.resolve(r.map,next,footY,r.phase==='buy'?.62:.38);
      if(r.phase==='buy')applyGate();
      for(const [id,state] of Object.entries(r.objects||{})){
        const door=ground.interactives[r.map][id];
        if(!door.lift||!state.closed||state.hp<=0)continue;
        const [l,rgt,b,t,n,f]=door.box;
        if(footY>=t||footY+1.62<=b)continue;
        if(rayBox(p.x,footY+.1,p.z,next.x-p.x,0,next.z-p.z,[l-.38,rgt+.38,-100,100,n-.38,f+.38])<=1){
          next.x=p.x;next.z=p.z;break;
        }
      }
      if(m.running&&Math.abs(footY-p.footY)<.58){
        p.stepDistance=(p.stepDistance||0)+Math.hypot(next.x-p.x,next.z-p.z);
        if(p.stepDistance>=1.9){p.stepDistance%=1.9;worldSound(r,p,'step');}
      }else p.stepDistance=0;
      p.x=next.x;p.z=next.z;p.y=y;p.footY=footY;
      if(gateCorrected)send(c,{type:'buy_gate_correction',x:p.x,z:p.z,attemptX:x,attemptZ:z,round:r.round});
      p.yaw=finite(m.yaw,-1e6,1e6,p.yaw);
      p.pitch=finite(m.pitch,-1.48,1.48,p.pitch);
      recordPosition(p,now);
    }
    p.lastPosAt=now;
  } else if(m.type==='shoot' && r.started) fire(r,p,m);
  else if(m.type==='buy' && r.phase==='buy' && p.alive) {
    const id=String(m.item||'');const w=catalog[id];
    if(id==='light_shield'||id==='heavy_shield'){
      const cost=id==='light_shield'?400:1000,armor=id==='light_shield'?25:50;
      if(p.armor>=armor||p.credits<cost)return notify(c,'방어구 구매 조건이 맞지 않습니다.');
      p.armor=armor;p.credits-=cost;
    }else{
      if(!w||p.credits<w.cost||w.id==='knife')return notify(c,'구매할 수 없습니다.');
      cancelEquipmentReload(p);
      if(p.weapon!==id)p.equipUntil=now+w.equipTime*1000;
      p.inventory[w.slot]=id; p.weapon=id; p.mag=w.magSize;p.reserve=w.resSize;p.credits-=w.cost;
      p.ammo[id]={mag:p.mag,reserve:p.reserve};
    }
    send(c,{type:'purchase',item:id,credits:p.credits,armor:p.armor,mag:p.mag,reserve:p.reserve});
  } else if(m.type==='reload' && r.started && p.alive) {
    const weaponId=p.weapon, w=catalog[weaponId];
    const requestId = Number.isSafeInteger(m.requestId) ? m.requestId : null;
    // An old equipped weapon must never lock the client into a different gun.
    if (m.weapon && m.weapon !== weaponId) {
      send(c,{type:'reload_cancelled',weapon:m.weapon,requestId,reason:'weapon_mismatch'});
      send(c,{type:'ammo_sync',weapon:weaponId,mag:p.mag,reserve:p.reserve});
      return;
    }
    if(p.reloading){
      send(c,{type:'reload_started',weapon:p.reloadWeapon,requestId,
        remainingMs:Math.max(0,p.reloadEndsAt-now)});
      return;
    }
    if(!w || weaponId==='knife' || p.mag>=w.magSize || p.reserve<=0 ||
       (m.weapon && m.weapon!==weaponId)) {
      send(c,{type:'reload_cancelled',weapon:weaponId,requestId,reason:'invalid'});
      send(c,{type:'ammo_sync',weapon:weaponId,mag:p.mag,reserve:p.reserve});
      return;
    }
    p.reloading=true;
    p.reloadWeapon=weaponId;
    const duration=1100;
    p.reloadEndsAt=now+duration;
    const sequence=p.reloadSeq=(p.reloadSeq || 0)+1;
    send(c,{type:'reload_started',weapon:weaponId,requestId,remainingMs:duration});
    const playerId=p.id,roomCode=r.code;
    setTimeout(()=>{
      const room=rooms.get(roomCode),pl=room?.players.get(playerId);
      if (!pl || !pl.reloading || pl.reloadSeq !== sequence ||
          pl.reloadWeapon !== weaponId || pl.weapon !== weaponId) return;
      const spec=catalog[weaponId];
      const current=pl.ammo[weaponId] || {mag:pl.mag,reserve:pl.reserve};
      const take=Math.max(0,Math.min(spec.magSize-current.mag,current.reserve));
      current.mag+=take;current.reserve-=take;
      pl.ammo[weaponId]=current;
      pl.mag=current.mag;pl.reserve=current.reserve;
      pl.reloading=false;pl.reloadWeapon=null;pl.reloadEndsAt=0;
      send(pl.client,{type:'reload_done',weapon:weaponId,requestId,mag:pl.mag,reserve:pl.reserve});
      send(pl.client,{type:'inventory',weapon:weaponId,mag:pl.mag,reserve:pl.reserve});
    },duration);
  } else if (m.type==='spike' && r.started) {
    p.heldSpike=!!m.held;
    if(!p.heldSpike) {p.actionFrom=0;p.actionBase=0;}
  }
}
function spikeSite(x,z,footY,map) {
  return ground.siteAt(map,x,z,footY);
}
function spikeAction(r,p,now) {
  if(!p.alive) return null;
  if(r.phase==='combat' && p.team==='attack') {
    const site=spikeSite(p.x,p.z,p.footY,r.map);
    return site?{site,mode:'plant',progress:p.heldSpike&&p.actionFrom?clamp((now-p.actionFrom)/4000,0,1):0}:null;
  }
  if(r.phase==='planted' && p.team==='defense' && r.spike && Math.hypot(p.x-r.spike.x,p.z-r.spike.z)<4.5) {
    const progress=p.heldSpike&&p.actionFrom?
      clamp(p.actionBase+(now-p.actionFrom)/7000,0,1):(r.halfDefused?0.5:0);
    return {site:r.spike.site,mode:'defuse',progress};
  }
  return null;
}
function snapshot(r) {
  const now=Date.now();
  // Quantize positions to centimetres, enough for FPS interpolation and smaller packets.
  const q=n=>Math.round(n*100)/100;
  return {type:'state',objects:r.objects,serverAt:now,code:r.code,round:r.round,phase:r.phase,timer:q(Math.max(0,(r.until-now)/1000)),
    scores:r.scores,host:r.host,winRounds:r.winRounds,spike:r.spike,
    players:roomUsers(r).map(p=>({id:p.id,name:p.name,team:p.team,x:q(p.x),y:q(p.y),z:q(p.z),footY:q(p.footY),yaw:q(p.yaw),pitch:q(p.pitch),hp:p.hp,armor:p.armor,alive:p.alive,credits:p.credits,inventory:p.inventory,weapon:p.weapon,mag:p.mag,reserve:p.reserve,reloading:p.reloading,reloadWeapon:p.reloadWeapon,spikeAction:spikeAction(r,p,now)}))};
}
function broadcastState(r) {
  if (!r.started) return;
  // Serialize one frame per room, not once for each participant.
  const frame = Buffer.from(JSON.stringify(snapshot(r)));
  for (const p of r.players.values()) {
    const c = p.client;
    if (c && !c.closed && c.socket.writable && !c.socket.destroyed &&
        c.socket.writableLength < 24 * 1024) writeFrame(c.socket, 1, frame);
  }
}
function step(r,now){
  if(!r.started)return;
  if (now>=r.until) {
    if (r.phase==='buy'){r.phase='combat';r.until=now+100000;}
    else if(r.phase==='combat')endRound(r,'defense','TIME EXPIRED');
    else if(r.phase==='planted')endRound(r,'attack','SPIKE DETONATED');
    else if(r.phase==='round_end') {
      if(Math.max(r.scores.attack,r.scores.defense)>=r.winRounds) {
        r.started=false;r.phase='waiting';emitRoom(r,{type:'match_end',scores:r.scores});broadcastLobby(r);return;
      }
      r.round++;
      if(r.round === r.winRounds) {
        for(const p of r.players.values()) {p.team=otherTeam(p.team);p.credits=800;}
        const previousAttackScore=r.scores.attack;
        r.scores.attack=r.scores.defense; r.scores.defense=previousAttackScore;
      }
      resetRound(r);
    }
  }
  if(r.phase==='combat' || r.phase==='planted') {
    const attackers=roomUsers(r).filter(p=>p.team==='attack');
    const defenders=roomUsers(r).filter(p=>p.team==='defense');
    for(const p of r.players.values()) {
      if(!p.alive||!p.heldSpike){
        if(!p.heldSpike)p.actionFrom=0;
        continue;
      }
      if(p.team==='attack' && r.phase==='combat') {
        const site=spikeSite(p.x,p.z,p.footY,r.map);
        if(!site){p.actionFrom=0;continue;}
        if(!p.actionFrom){p.actionFrom=now;worldSound(r,p,'plant');}
        if(now-p.actionFrom>=4000){
          r.spike={x:p.x,y:p.footY,z:p.z,site};r.phase='planted';r.until=now+45000;
          p.actionFrom=0;p.heldSpike=false;p.credits=clamp(p.credits+300,0,9000);
          emitRoom(r,{type:'spike_planted',spike:r.spike});
        }
      } else if(p.team==='defense' && r.phase==='planted' && r.spike){
        if(Math.hypot(p.x-r.spike.x,p.z-r.spike.z)>4.5){p.actionFrom=0;continue;}
        if(!p.actionFrom){worldSound(r,p,r.halfDefused?'half':'defuse');p.actionFrom=now;p.actionBase=r.halfDefused?0.5:0;}
        const progress=p.actionBase+(now-p.actionFrom)/7000;
        if(progress>=0.5)r.halfDefused=true;
        // A continuous defuse always takes 7s. On interrupted defuse, the saved
        // halfway checkpoint resumes with 3.5s remaining, not an instant completion.
        if(progress>=1.0){endRound(r,'defense','SPIKE DEFUSED');break;}
      }
    }
    if(attackers.length&&defenders.length){
      if(!attackers.some(p=>p.alive) && !r.spike)endRound(r,'defense','ATTACKERS ELIMINATED');
      else if(!defenders.some(p=>p.alive))endRound(r,'attack','DEFENDERS ELIMINATED');
    }
  }
  broadcastState(r);
}
setInterval(()=>{const now=Date.now();for(const room of rooms.values())step(room,now);},TICK_MS).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Realtime game server ready on :${PORT}`));
module.exports={server,rooms};