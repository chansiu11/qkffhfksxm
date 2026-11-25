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
function encodeFrame(opcode,data=Buffer.alloc(0)){
  const payload=Buffer.isBuffer(data)?data:Buffer.from(data);
  let head;
  if(payload.length<126)head=Buffer.from([0x80|opcode,payload.length]);
  else if(payload.length<=65535){head=Buffer.alloc(4);head[0]=0x80|opcode;head[1]=126;head.writeUInt16BE(payload.length,2);}
  else {head=Buffer.alloc(10);head[0]=0x80|opcode;head[1]=127;head.writeBigUInt64BE(BigInt(payload.length),2);}
  return Buffer.concat([head,payload]);
}
function writeFrame(socket,opcode,data){
  if(!socket.writable||socket.destroyed||socket.writableLength>=MAX_BACKLOG_BYTES)return false;
  socket.write(encodeFrame(opcode,data));return true;
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
  if(r.hostMode)send(r.players.get(r.host)?.client,{type:'host_peer_left',id});
  if (p.rejoinTimer) clearTimeout(p.rejoinTimer);
  if (r.host === id) r.host = r.players.keys().next().value || null;
  if (!r.players.size) rooms.delete(r.code);
  else { broadcastLobby(r); if(!r.hostMode)broadcastState(r); }
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
  if(r.hostMode&&r.host===p.id)fallbackRoom(r,'방장 연결 종료');
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
    res.end(JSON.stringify({ ok: true, service: 'qkffhfksxm-realtime', buyGateRevision: 'ascent-joins18', performanceRevision: 'perf19', transportRevision:'host21', audioRevision:'audio22', rooms: rooms.size, players: clients.size }));
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

const engine = require('./room-core.js')({
  rooms,send,close,crypto,catalog,ground,ShotgunPellets,ShootingSpread,MeleeRules,
  recordPosition,samplePosition,rayCharacter,MAX_REWIND_MS,
  sendSnapshot(r,state){
    const frame=encodeFrame(1,JSON.stringify(state));
    for(const p of r.players.values()){
      const c=p.client;
      if(c&&!c.closed&&c.socket.writable&&!c.socket.destroyed&&c.socket.writableLength<8*1024)c.socket.write(frame);
    }
  }
});
const {start,step,broadcastLobby,broadcastState,lobbyInfo,emitRoom}=engine;
const CONTROL=new Set(['host_opt','host_signal','host_input','host_output','host_abort','host_finish','host_alive']);
function fallbackRoom(r,reason){
  if(!r.hostMode)return;
  r.hostMode=false;r.started=false;
  const online=[...r.players.values()].filter(p=>p.client&&!p.client.closed);
  if(!online.some(p=>p.id===r.host))r.host=online[0]?.id||r.host;
  emitRoom(r,{type:'host_fallback',reason});
  if(online.length)start(r);
  else broadcastLobby(r);
}
function receive(c,m){
  if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.type!=='string')return;
  const r=c.room,p=r?.players.get(c.id);
  if(!p)return engine.receive(c,m);
  if(m.type==='host_opt'){
    if(!r.started){p.direct=m.enabled===true;broadcastLobby(r);}
    return;
  }
  if(m.type==='host_signal'){
    const to=r.players.get(m.to);
    if(!to||to===p||!p.direct||!to.direct||(p.id!==r.host&&to.id!==r.host))return;
    if(!m.signal||!['offer','answer','ice'].includes(m.signal.kind))return;
    if(JSON.stringify(m.signal).length>7000)return;
    const now=Date.now();if(!p.signalWindow||now-p.signalWindow>60000){p.signalWindow=now;p.signalCount=0;}
    if(++p.signalCount>240)return;
    send(to.client,{type:'host_signal',from:p.id,signal:m.signal});return;
  }
  if(m.type==='start'&&r.host===p.id&&!r.started&&m.hostReady===true){
    const members=[...r.players.values()];
    if(members.every(u=>u.direct&&u.client&&!u.client.closed)&&members.every(u=>u.id===p.id||Array.isArray(m.ready)&&m.ready.includes(u.id))){
      r.hostMode=true;r.hostRun=crypto.randomUUID();r.hostAliveAt=Date.now();r.started=true;r.phase='buy';
      emitRoom(r,{type:'host_begin',room:lobbyInfo(r)});
      broadcastLobby(r);return;
    }
  }
  if(m.type==='host_input'){
    if(r.hostMode&&m.run===r.hostRun&&p.id!==r.host&&m.data&&typeof m.data.type==='string'&&!CONTROL.has(m.data.type)&&!['create','join','resume','leave','start'].includes(m.data.type)){
      send(r.players.get(r.host)?.client,{type:'host_input',run:r.hostRun,from:p.id,data:m.data});
    }
    return;
  }
  if(m.type==='host_output'){
    const to=r.players.get(m.to);
    if(r.hostMode&&m.run===r.hostRun&&p.id===r.host&&to&&to!==p&&m.data&&typeof m.data.type==='string'&&!CONTROL.has(m.data.type)&&!['host_begin','host_fallback','hello','joined','resumed','resume_failed'].includes(m.data.type)){
      send(to.client,{type:'host_output',run:r.hostRun,data:m.data});
    }
    return;
  }
  if(m.type==='host_alive'){if(r.hostMode&&p.id===r.host&&m.run===r.hostRun)r.hostAliveAt=Date.now();return;}
  if(m.type==='host_abort'){if(r.hostMode&&p.id===r.host)fallbackRoom(r,'방장 연결 문제');return;}
  if(m.type==='host_finish'){
    if(r.hostMode&&p.id===r.host){emitRoom(r,{type:'host_complete'});r.hostMode=false;r.started=false;r.phase='waiting';broadcastLobby(r);}
    return;
  }
  if(r.hostMode&&!['ping','leave','resume'].includes(m.type))return;
  engine.receive(c,m);
}
setInterval(()=>{const now=Date.now();for(const room of rooms.values()){if(room.hostMode){if(now-room.hostAliveAt>10000)fallbackRoom(room,'방장 응답 없음');}else step(room,now);}},TICK_MS).unref();
server.listen(PORT,process.env.BIND_HOST || '0.0.0.0',()=>console.log(`Realtime game server ready on :${PORT}`));
module.exports={server,rooms};