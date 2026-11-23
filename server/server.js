'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const catalog = require('./weapons.json');
const blockers = require('./blockers.json');
const PORT = Number(process.env.PORT) || 10000;
const rooms = new Map();
const clients = new Set();
const TICK_MS = 100;
const MAX_MSG = 8192;
const LIMIT = 55;

// A small RFC6455 JSON/WebSocket transport: no third-party packages or builds.
function writeFrame(socket, opcode, data = Buffer.alloc(0)) {
  if (!socket.writable) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const head = payload.length < 126 ? Buffer.from([0x80 | opcode, payload.length]) :
    Buffer.from([0x80 | opcode, 126, (payload.length >>> 8) & 255, payload.length & 255]);
  socket.write(Buffer.concat([head, payload]));
}
function send(c, msg) {
  if (!c.closed && c.socket.writable) writeFrame(c.socket, 1, JSON.stringify(msg));
}
function close(c, reason = 'Disconnected') {
  if (c.closed) return;
  c.closed = true;
  try { writeFrame(c.socket, 8, Buffer.from([0x03, 0xe8])); } catch (_) {}
  c.socket.destroy();
  clients.delete(c);
  if (c.room) {
    const r = c.room;
    r.players.delete(c.id);
    if (r.host === c.id) r.host = r.players.keys().next().value || null;
    c.room = null;
    if (!r.players.size) rooms.delete(r.code);
    else { broadcastLobby(r); broadcastState(r); }
  }
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
    res.end(JSON.stringify({ ok: true, service: 'qkffhfksxm-realtime', rooms: rooms.size, players: clients.size }));
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
function lobbyInfo(r) { return { code: r.code, host: r.host, winRounds: r.winRounds, started: r.started, phase: r.phase,
  players: roomUsers(r).map(p => ({ id: p.id, name: p.name, team: p.team })) }; }
function broadcastLobby(r) { emitRoom(r, { type: 'lobby', room: lobbyInfo(r) }); }
function notify(c, message) { send(c, { type: 'error', message }); }
function spawn(p, idx) {
  const atk = p.team === 'attack';
  p.x = (idx % 5 - 2) * 3.0;
  p.z = atk ? 40 : -42;
  p.footY = 0;
  p.y = 1.65;
  p.yaw = atk ? 0 : Math.PI;
  p.pitch = 0;
  p.hp = 100;
  p.armor = 0;
  p.alive = true;
  p.weapon = 'classic';
  p.inventory = { primary: null, secondary: 'classic', knife: 'knife' };
  p.ammo = { classic: { mag: catalog.classic.magSize, reserve: catalog.classic.resSize } };
  p.mag = catalog.classic.magSize;
  p.reserve = catalog.classic.resSize;
  p.reloading = false;
  p.heldSpike = false;
  p.actionFrom = 0;
  p.lastPosAt = 0;
  p.lastShot = 0;
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
    r = { code, host: c.id, winRounds: msg.winRounds === 5 ? 5 : 13,
      players: new Map(), started: false, phase: 'waiting', round: 1,
      scores: { attack: 0, defense: 0 }, until: 0, spike: null, halfDefused: false };
    rooms.set(code, r);
  }
  const team = roomUsers(r).filter(p => p.team === 'attack').length <= roomUsers(r).filter(p => p.team === 'defense').length ? 'attack' : 'defense';
  const p = { id: c.id, client: c, name: `PLAYER ${r.players.size + 1}`, team, credits: 800 };
  spawn(p, r.players.size);
  r.players.set(c.id, p);
  c.room = r;
  send(c, { type: 'joined', id: c.id, team, room: lobbyInfo(r) });
  broadcastLobby(r);
}
function resetRound(r) {
  r.phase = 'buy';
  r.until = Date.now() + 16000;
  r.spike = null;
  r.halfDefused = false;
  const users = roomUsers(r);
  users.forEach((p, i) => {
    spawn(p, i);
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
  let near=0,far=260;
  for(const [o,d,lo,hi] of [[ox,dx,b[0],b[1]],[oy,dy,b[2],b[3]],[oz,dz,b[4],b[5]]]) {
    if(Math.abs(d)<1e-9) { if(o<lo||o>hi)return Infinity; continue; }
    const a=(lo-o)/d, z=(hi-o)/d;
    near=Math.max(near,Math.min(a,z)); far=Math.min(far,Math.max(a,z));
    if(near>far)return Infinity;
  }
  return near;
}
function fire(r, p, msg) {
  if (r.phase !== 'combat' && r.phase !== 'planted') return;
  if (!p.alive || p.reloading) return;
  const w = catalog[p.weapon] || catalog.classic;
  const now = Date.now();
  if (now - p.lastShot < (w.fireRate * 1000 - 8)) return;
  if (w.id !== 'knife' && p.mag <= 0) return;
  p.lastShot = now;
  if (w.id !== 'knife') p.mag--;
  if (p.ammo?.[p.weapon]) p.ammo[p.weapon].mag = p.mag;
  const yaw = finite(msg.yaw, -100000, 100000, p.yaw);
  const pitch = finite(msg.pitch, -1.48, 1.48, p.pitch);
  // Three.js YXZ FPS camera: positive pitch looks upward. Never invert dy here.
  const dx = -Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = -Math.cos(yaw) * Math.cos(pitch);
  const oy = p.y, ox = p.x, oz = p.z;
  let best = Infinity, hit = null, headshot = false;
  for (const target of r.players.values()) {
    if (!target.alive || target.team === p.team) continue;
    const tH = raySphere(ox,oy,oz,dx,dy,dz,target.x,target.footY+1.48,target.z,0.27);
    const tB = raySphere(ox,oy,oz,dx,dy,dz,target.x,target.footY+0.88,target.z,0.54);
    const t = Math.min(tH,tB);
    if (t < best && t < w.range) { best = t; hit=target; headshot = tH <= tB; }
  }
  // Determine the visible ray endpoint even when no opponent is hit.
  // The shooter already draws a predicted tracer; send the authoritative path to everyone else.
  let impactDistance = w.range;
  for (const b of blockers) {
    const wallDistance = rayBox(ox,oy,oz,dx,dy,dz,b);
    if (wallDistance > 0.06 && wallDistance < impactDistance) impactDistance = wallDistance;
  }
  if (hit && best > impactDistance + 0.02) hit = null;
  if (hit) impactDistance = Math.min(impactDistance, best);
  if (w.id !== 'knife') {
    const bulletEvent = { type:'shot', shooter:p.id, weapon:p.weapon,
      from:[ox+dx*0.28,oy+dy*0.28,oz+dz*0.28],
      to:[ox+dx*impactDistance,oy+dy*impactDistance,oz+dz*impactDistance] };
    for (const receiver of r.players.values()) if (receiver.id !== p.id) send(receiver.client, bulletEvent);
  }
  if (hit) {
    let damage = headshot ? w.headDmg : w.bodyDmg;
    const shield = Math.min(hit.armor, Math.round(damage * 0.55));
    hit.armor -= shield; damage -= shield; hit.hp = Math.max(0, hit.hp - damage);
    send(p.client,{type:'hit',headshot,damage});
    if (hit.hp === 0) {
      hit.alive=false; p.credits=clamp(p.credits+200,0,9000);
      emitRoom(r,{type:'kill',killer:p.id,victim:hit.id,weapon:p.weapon,headshot});
      const alive = roomUsers(r).filter(q=>q.team===hit.team&&q.alive).length;
      if (!alive && !r.spike) endRound(r,p.team,'TEAM ELIMINATED');
    }
  }
}
function receive(c,m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.type !== 'string') return;
  const now=Date.now();
  c.lastMessage=now;
  if (m.type === 'ping') { send(c,{type:'pong'}); return; }
  if (m.type === 'create' || m.type === 'join') { createRoom(c,m); return; }
  const r=c.room, p=r?.players.get(c.id);
  if (!r || !p) return;
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
    p.weapon=item;
    p.mag=p.ammo[item]?.mag ?? catalog[item].magSize;
    p.reserve=p.ammo[item]?.reserve ?? catalog[item].resSize;
  }
  else if(m.type==='move' && r.started && p.alive && ['combat','buy','planted'].includes(r.phase)) {
    const x=finite(m.x,-LIMIT,LIMIT,p.x),z=finite(m.z,-LIMIT,LIMIT,p.z),
          footY=finite(m.footY,-2,9,p.footY),y=finite(m.y,-1,14,p.y);
    const dt=p.lastPosAt?clamp((now-p.lastPosAt)/1000,0.03,0.35):0.2;
    // Server bounds movement speed and does not accept arbitrary teleports.
    if(Math.hypot(x-p.x,z-p.z)<= 12.0*dt+0.8 && Math.abs(footY-p.footY)<4.0) {
      p.x=x;p.z=z;p.y=y;p.footY=footY;
    }
    p.yaw=finite(m.yaw,-1e6,1e6,p.yaw);
    p.pitch=finite(m.pitch,-1.48,1.48,p.pitch);
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
      p.inventory[w.slot]=id; p.weapon=id; p.mag=w.magSize;p.reserve=w.resSize;p.credits-=w.cost;
      p.ammo[id]={mag:p.mag,reserve:p.reserve};
    }
    send(c,{type:'purchase',item:id,credits:p.credits,armor:p.armor,mag:p.mag,reserve:p.reserve});
  } else if(m.type==='reload' && r.started && p.alive && !p.reloading) {
    const w=catalog[p.weapon];
    if(!w||p.mag>=w.magSize||p.reserve<=0)return;
    p.reloading=true;
    const playerId=p.id,roomCode=r.code;
    setTimeout(()=>{
      const room=rooms.get(roomCode), pl=room?.players.get(playerId);
      if(!pl||!pl.reloading)return;
      const spec=catalog[pl.weapon];
      const take=Math.min(spec.magSize-pl.mag,pl.reserve);
      pl.mag+=take;pl.reserve-=take;pl.reloading=false;
      if(pl.ammo[pl.weapon])pl.ammo[pl.weapon]={mag:pl.mag,reserve:pl.reserve};
      send(pl.client,{type:'inventory',weapon:pl.weapon,mag:pl.mag,reserve:pl.reserve});
    },1100);
  } else if (m.type==='spike' && r.started) {
    p.heldSpike=!!m.held;
    if(!p.heldSpike) p.actionFrom=0;
  }
}
function snapshot(r) {
  const now=Date.now();
  return {type:'state',code:r.code,round:r.round,phase:r.phase,timer:Math.max(0,(r.until-now)/1000),
    scores:r.scores,host:r.host,winRounds:r.winRounds,spike:r.spike,
    players:roomUsers(r).map(p=>({id:p.id,name:p.name,team:p.team,x:p.x,y:p.y,z:p.z,footY:p.footY,yaw:p.yaw,pitch:p.pitch,hp:p.hp,armor:p.armor,alive:p.alive,credits:p.credits,weapon:p.weapon,mag:p.mag,reserve:p.reserve}))};
}
function broadcastState(r) { if(r.started)emitRoom(r,snapshot(r)); }
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
        const a=Math.hypot(p.x-29,p.z+8)<8.5, b=Math.hypot(p.x+32,p.z+23)<8.5;
        if(!a&&!b||p.footY>.65){p.actionFrom=0;continue;}
        if(!p.actionFrom)p.actionFrom=now;
        if(now-p.actionFrom>=4000){r.spike={x:p.x,y:p.footY,z:p.z,site:a?'A':'B'};r.phase='planted';r.until=now+45000;
          p.actionFrom=0;p.credits=clamp(p.credits+300,0,9000);emitRoom(r,{type:'spike_planted',spike:r.spike});}
      } else if(p.team==='defense' && r.phase==='planted' && r.spike){
        if(Math.hypot(p.x-r.spike.x,p.z-r.spike.z)>4.5){p.actionFrom=0;continue;}
        if(!p.actionFrom)p.actionFrom=now;
        if(now-p.actionFrom>= (r.halfDefused?3500:7000)){endRound(r,'defense','SPIKE DEFUSED');break;}
        if(now-p.actionFrom>=3500)r.halfDefused=true;
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