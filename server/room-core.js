/* Shared room engine. The existing game rules are unchanged; transport is injected. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.createRoomCore=factory;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
'use strict';
const {rooms,send,close,crypto,catalog,ground,ShotgunPellets,ShootingSpread,MeleeRules,recordPosition,samplePosition,rayCharacter,MAX_REWIND_MS,sendSnapshot}=deps;
const LIMIT=ground.limit;
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function finite(v, lo, hi, fallback) { return typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback; }
function otherTeam(t) { return t === 'attack' ? 'defense' : 'attack'; }
function roomUsers(r) { return [...r.players.values()]; }
function emitRoom(r, m) { for (const p of r.players.values()) send(p.client, m); }
function lobbyInfo(r) { return { map:r.map, code: r.code, host: r.host, winRounds: r.winRounds, started: r.started, phase: r.phase, hostMode:!!r.hostMode, hostRun:r.hostMode?r.hostRun:null,
  players: roomUsers(r).map(p => ({ id: p.id, name: p.name, team: p.team, online: !!p.client, direct:!!p.direct })) }; }
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
    p.aiming=false;
    p.weapon = 'classic';
    p.inventory = { primary: null, secondary: 'classic', knife: 'knife' };
  }
  p.shopReceipts = {};
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
  p.spikeSelected=false;
  p.heldSpike = false;
  p.actionFrom = 0;
  p.actionBase = 0;
  p.lastPosAt = 0;
  p.stepDistance=0;p.lastLandSeq=0;p.lastLandAt=0;
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
  if (r.started&&!r.hostMode) send(c, snapshot(r));
  broadcastLobby(r);
}
function resetRound(r) {
  r.objects=Object.fromEntries(Object.entries(ground.interactives[r.map]||{}).map(([id,item])=>[id,{hp:item.hp,closed:false}]));
  r.phase = 'buy';
  r.until = Date.now() + 16000;
  r.spike = null;
  r.drops=[]; r.dropSeq=0;
  r.carrier=null;
  const [x,spawnZ]=ground.maps[r.map].labels['Attacker Side Spawn'];
  const z=spawnZ-1.25;
  r.drops.push({key:'spawn-spike',id:'spike',x,z,y:ground.height(r.map,x,z)});
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
  const movement=kind==='step'||kind==='land';
  for(const q of r.players.values()){
    if(movement&&q===p)continue;
    if(Math.hypot(q.x-p.x,q.z-p.z)<(movement?40:60))
      send(q.client,{type:'world_sound',source:p.id,kind,x:p.x,z:p.z,y:movement?p.footY+.12:p.footY+.8});
  }
}
function inRing(r,p){return !!r.spike&&Math.abs(p.footY-r.spike.y)<1.25&&Math.hypot(p.x-r.spike.x,p.z-r.spike.z)<=4.5;}
function defusing(r,p){return p.heldSpike&&p.alive&&p.team==='defense'&&r.phase==='planted'&&inRing(r,p);}
function planting(r,p){return r.carrier===p.id&&p.heldSpike&&r.phase==='combat'&&p.team==='attack'&&spikeSite(p.x,p.z,p.footY,r.map);}
function fire(r, p, msg) {
  if(p.spikeSelected)return;
  const blockers = ground.maps[r.map].blockers;
  if (r.phase !== 'combat' && r.phase !== 'planted') return;
  if (!p.alive || p.reloading || planting(r,p) || defusing(r,p)) return;
  const w = catalog[p.weapon] || catalog.classic;
  const now = Date.now();
  const meleeMode = MeleeRules.modeFor(msg.mode);
  if(now-p.lastShot>500)p.bulldogCount=0;
  const alt = msg.alt === true && (w.id === 'classic' || w.id === 'bucky');
  const ammo = p.mag;
  const cooldown = alt && w.id === 'classic' ? .45 : w.id === 'knife' ? MeleeRules.MODES[meleeMode].cooldown : (msg.ads && w.id==='bulldog' ? (((p.bulldogCount||0)%3===2)?.325:.075) : ShootingSpread.fireInterval(w,msg.ads,p.spreadState,now));
  if (now < p.equipUntil || now - p.lastShot < ((p.lastInterval??cooldown) * 1000 - 8)) return;
  if (w.id !== 'knife' && p.mag <= 0) {send(p.client,{type:'ammo_sync',weapon:p.weapon,mag:p.mag,reserve:p.reserve});return;}
  p.lastShot = now;
      p.bulldogCount=msg.ads&&w.id==='bulldog'?((p.bulldogCount||0)+1)%3:0;p.lastInterval=cooldown;
  if (w.id !== 'knife') p.mag -= alt && w.id === 'classic' ? Math.min(3,ammo) : 1;
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
      recoilState:state, shotTime:now, alt,ammo,yaw,pitch,shotIndex:burst,seed:finite(msg.seed,0,4294967295,0),
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
  let ox=useFrom?from[0]:p.x,oy=useFrom?from[1]:p.y,oz=useFrom?from[2]:p.z;
  // Clients aim at the interpolated previous snapshot; rewind ONLY character
  // positions, never walls, by a strictly bounded amount of server time.
  const shotAt=finite(msg.seenAt,now-MAX_REWIND_MS,now,now);
  if (w.id === 'knife') {
    emitRoom(r, {type:'knife_swing', shooter:p.id, mode:meleeMode, x:ox, y:oy, z:oz});
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
  const muzzle=[ox,oy,oz];
  const altBucky=alt && w.id==='bucky';
  let travel=0;
  if (altBucky) {
    const [dx,dy,dz]=directions[0];
    const wall=mapImpact(r,ox,oy,oz,dx,dy,dz,w.range);
    const near=wall.impactDistance<=8 || [...r.players.values()].some(target=>{
      if (!target.alive || target.team===p.team) return false;
      const hit=rayCharacter(ox,oy,oz,dx,dy,dz,target,shotAt);
      return hit && hit.distance<=8;
    });
    if (near) directions=[directions[0]];
    else {travel=8; ox+=dx*travel; oy+=dy*travel; oz+=dz*travel;}
  }
  for (const [dx, dy, dz] of directions) {
    let {impactDistance,struck}=mapImpact(r,ox,oy,oz,dx,dy,dz,w.range-travel);
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
      const damage=ShootingSpread.applyGunDamage(hit,w.id,travel+best,headshot?'head':legshot?'leg':'body');
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
      altBucky,split:travel?[ox,oy,oz]:undefined,
      from:[muzzle[0] + first[0] * .28, muzzle[1] + first[1] * .28, muzzle[2] + first[2] * .28],
      to:ends[0], pellets:directions.length > 1 ? ends : undefined};
    for (const receiver of r.players.values())
      if (receiver.id !== p.id || altBucky) send(receiver.client, shot);
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
  else if(m.type==='select_spike' && p.alive && r.carrier===p.id && !r.spike){
    cancelEquipmentReload(p); p.spikeSelected=true; p.aiming=false;
  } else if(m.type==='drop_item' && r.started && p.alive && ['combat','buy','planted'].includes(r.phase)){
    const spike=m.item==='spike', id=spike?'spike':p.weapon;
    if(spike ? r.carrier!==p.id||r.spike : m.item!==id||id==='knife'||!catalog[id])return;
    if(!spike && p.inventory[catalog[id].slot]!==id)return;
    const x=p.x-Math.sin(p.yaw)*1.3,z=p.z-Math.cos(p.yaw)*1.3;
    r.drops.push({key:'throw-'+(++r.dropSeq),id,x,z,yaw:p.yaw,y:ground.height(r.map,x,z),mag:p.mag,reserve:p.reserve});
    if(spike){r.carrier=null;p.spikeSelected=false;p.heldSpike=false;p.actionFrom=0;}
    else{
      cancelEquipmentReload(p);p.inventory[catalog[id].slot]=null;delete p.ammo[id];delete p.shopReceipts?.[catalog[id].slot];
      p.weapon=p.inventory.secondary||p.inventory.primary||'knife';
      p.mag=p.ammo[p.weapon]?.mag??1;p.reserve=p.ammo[p.weapon]?.reserve??0;
      send(c,{type:'drop_loadout',inventory:p.inventory,weapon:p.weapon,mag:p.mag,reserve:p.reserve});
    }
  } else if(m.type==='pickup_item' && p.alive){
    const item=r.drops?.find(d=>d.key===m.key);
    if(!item||Math.hypot(item.x-p.x,item.y-p.footY,item.z-p.z)>2.2)return;
    if(item.id==='spike'){if(p.team!=='attack'||r.carrier||r.spike)return;r.carrier=p.id;}
    else{const slot=catalog[item.id].slot;if(p.inventory[slot])return;
      p.inventory[slot]=item.id;p.ammo[item.id]={mag:item.mag,reserve:item.reserve};
      send(c,{type:'drop_loadout',inventory:p.inventory,weapon:p.weapon,mag:p.mag,reserve:p.reserve});}
    r.drops=r.drops.filter(d=>d!==item);
  } else if(m.type==='equip' && r.started) {
    const slot=String(m.slot||'');
    if(defusing(r,p)&&slot!=='knife')return;
    const item=p.inventory?.[slot];
    if(!item||!catalog[item])return;
    if (p.weapon !== item) {cancelEquipmentReload(p);p.bulldogCount=0;p.lastShot=0;p.lastInterval=0;p.equipUntil=now+1000*catalog[item].equipTime;}
    p.aiming=false;
    p.spikeSelected=false;
    p.weapon=item;
    p.mag=p.ammo[item]?.mag ?? catalog[item].magSize;
    p.reserve=p.ammo[item]?.reserve ?? catalog[item].resSize;
    send(c, {type:'inventory',weapon:item,mag:p.mag,reserve:p.reserve});
  }
  // Keep non-combat inter-round position updates synchronized, using the existing bounds checks.
  else if(m.type==='move' && r.started && p.alive && ['combat','buy','planted','round_end'].includes(r.phase)) {
    if(planting(r,p)||defusing(r,p)){p.y=p.footY+1.2;return;}
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
      const distance=Math.hypot(next.x-p.x,next.z-p.z),dy=footY-p.footY;
      p.x=next.x;p.z=next.z;p.y=y;p.footY=footY;
      if(typeof m.audioRunning==='boolean'){
        const landing=Number.isSafeInteger(m.landSeq)&&m.landSeq>=0&&m.landSeq!==p.lastLandSeq&&m.audioGrounded===true;
        if(landing){
          p.lastLandSeq=m.landSeq;
          if(m.landSeq>0&&now-(p.lastLandAt||0)>=300){p.lastLandAt=now;p.stepDistance=0;worldSound(r,p,'land');}
        }
        if(m.audioRunning&&!landing){
          p.stepDistance=(p.stepDistance||0)+distance;
          if(p.stepDistance>=1.9){p.stepDistance%=1.9;worldSound(r,p,'step');}
        }else if(m.audioGrounded!==false||landing)p.stepDistance=0;
      }else if(typeof m.running==='boolean'){
        if(m.running&&Math.abs(dy)<.58){
          p.stepDistance=(p.stepDistance||0)+distance;
          if(p.stepDistance>=1.9){p.stepDistance%=1.9;worldSound(r,p,'step');}
        }else p.stepDistance=0;
      }
      if(gateCorrected)send(c,{type:'buy_gate_correction',x:p.x,z:p.z,attemptX:x,attemptZ:z,round:r.round});
      p.yaw=finite(m.yaw,-1e6,1e6,p.yaw);
      p.pitch=finite(m.pitch,-1.48,1.48,p.pitch);
      p.aiming=m.aiming===true;
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
      if(w.slot==='primary'||w.slot==='secondary'){
        p.shopReceipts??={};
        p.shopReceipts[w.slot]={id,cost:w.cost};
      }
    }
    send(c,{type:'purchase',item:id,credits:p.credits,armor:p.armor,mag:p.mag,reserve:p.reserve});
  } else if(m.type==='refund' && r.phase==='buy' && p.alive) {
    const slot=m.slot;
    if(slot!=='primary'&&slot!=='secondary')return;
    const receipt=p.shopReceipts?.[slot];
    if(!receipt||receipt.id!==p.inventory[slot]||!(receipt.cost>0))return notify(c,'이번 라운드 구매 항목만 환불할 수 있습니다.');
    delete p.shopReceipts[slot];
    cancelEquipmentReload(p);
    p.inventory[slot]=slot==='secondary'?'classic':null;
    delete p.ammo[receipt.id];
    if(slot==='secondary'&&!p.ammo.classic)p.ammo.classic={mag:catalog.classic.magSize,reserve:catalog.classic.resSize};
    if(p.weapon===receipt.id)p.weapon=p.inventory.secondary||p.inventory.primary||'knife';
    p.mag=p.ammo[p.weapon].mag;p.reserve=p.ammo[p.weapon].reserve;
    p.credits=clamp(p.credits+receipt.cost,0,9000);
    send(c,{type:'refund_result',slot,inventory:p.inventory,weapon:p.weapon,credits:p.credits,mag:p.mag,reserve:p.reserve});
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
    const duration=Math.round((w.reloadTime || 1.1) * 1000);
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
    if(defusing(r,p)){cancelEquipmentReload(p);p.weapon='knife';p.aiming=false;p.mag=p.ammo.knife.mag;p.reserve=p.ammo.knife.reserve;p.y=p.footY+1.2;}
    if(!p.heldSpike) {p.actionFrom=0;p.actionBase=0;}
  }
}
function spikeSite(x,z,footY,map) {
  return ground.siteAt(map,x,z,footY);
}
function spikeAction(r,p,now) {
  if(!p.alive) return null;
  if(r.phase==='combat' && p.team==='attack' && r.carrier===p.id) {
    const site=spikeSite(p.x,p.z,p.footY,r.map);
    return site?{site,mode:'plant',progress:p.heldSpike&&p.actionFrom?clamp((now-p.actionFrom)/4000,0,1):0}:null;
  }
  if(r.phase==='planted' && p.team==='defense' && inRing(r,p)) {
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
    scores:r.scores,host:r.host,winRounds:r.winRounds,spike:r.spike,carrier:r.carrier,drops:r.drops,
    players:roomUsers(r).map(p=>({id:p.id,name:p.name,team:p.team,x:q(p.x),y:q(p.y),z:q(p.z),footY:q(p.footY),yaw:q(p.yaw),pitch:q(p.pitch),spikeSelected:!!p.spikeSelected,aiming:!!p.aiming,hp:p.hp,armor:p.armor,alive:p.alive,credits:p.credits,inventory:p.inventory,weapon:p.weapon,mag:p.mag,reserve:p.reserve,reloading:p.reloading,reloadWeapon:p.reloadWeapon,spikeAction:spikeAction(r,p,now)}))};
}
function broadcastState(r) {
  if(r.started)sendSnapshot(r,snapshot(r));
}
function step(r,now){
  if(!r.started)return;
  if(r.carrier){
    const carrier=r.players.get(r.carrier);
    if(!carrier?.alive){
      const spawn=ground.maps[r.map].labels['Attacker Side Spawn'];
      const x=carrier?.x??spawn[0],z=carrier?.z??spawn[1];
      r.drops.push({key:'throw-'+(++r.dropSeq),id:'spike',x,z,y:carrier?.footY??ground.height(r.map,x,z)});
      r.carrier=null;
    }
  }
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
      if(p.team==='attack' && r.phase==='combat' && r.carrier===p.id) {
        const site=spikeSite(p.x,p.z,p.footY,r.map);
        if(!site){p.actionFrom=0;continue;}
        if(!p.actionFrom){p.actionFrom=now;worldSound(r,p,'plant');}
        if(now-p.actionFrom>=4000){
          p.spikeSelected=false;r.carrier=null;
          r.spike={x:p.x,y:p.footY,z:p.z,site};r.phase='planted';r.until=now+45000;
          p.actionFrom=0;p.heldSpike=false;p.credits=clamp(p.credits+300,0,9000);
          emitRoom(r,{type:'spike_planted',spike:r.spike});
        }
      } else if(p.team==='defense' && r.phase==='planted' && r.spike){
        if(!inRing(r,p)){p.actionFrom=0;continue;}
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

return {receive,spawn,start,step,snapshot,broadcastLobby,broadcastState,lobbyInfo,emitRoom,roomUsers};
});
