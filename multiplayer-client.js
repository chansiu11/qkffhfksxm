/* Realtime bridge for the supplied Three.js game. No changes to map geometry or PC/mobile controls. */
(function () {
  'use strict';
  const MP = {
    active: false, started: false, myId: null, socket: null, api: null,
    state: null, room: null, lastRound: 0, lastSent: 0, lastSpike: null,
    token: null, roomCode: null, retries: 0, reconnecting: false, reconnectTimer: null,
    disconnecting: false, pingSeq: 0, pingSent: new Map(), rtt: null, jitter: 0,
    lastPing: 0, connectRequest: null, reconnectStarted: 0,
    peers: new Map(),
    install(api) {
      this.api = api;
      this.status('온라인 서버에 연결하지 않았습니다.');
      // Fast heartbeat and measured network RTT; never label a prediction as real ping.
      this.heartbeat = setInterval(() => {
        if (this.socket?.readyState !== WebSocket.OPEN) return;
        const seq = ++this.pingSeq;
        this.pingSent.set(seq, performance.now());
        if (this.pingSent.size > 8) this.pingSent.delete(this.pingSent.keys().next().value);
        this.send({type:'ping',seq});
      }, 2500);
      window.addEventListener('online', () => {
        if (this.reconnecting) this.scheduleReconnect(100);
      });
    },
    status(message, error = false) {
      for (const id of ['online-status', 'online-lobby-status']) {
        const el = document.getElementById(id);
        if (el) { el.textContent = message; el.style.color = error ? '#ff7785' : '#38e2c7'; }
      }
      const net = document.getElementById('hud-network-stats');
      if (net && this.reconnecting) { net.textContent = '연결 복구 중...'; net.style.color = '#ffd166'; }
    },
    send(value) {
      if (this.socket?.readyState === WebSocket.OPEN) {
        // Position packets are replaceable. Never overload a clogged connection.
        if (value.type === 'move' && this.socket.bufferedAmount > 16000) return false;
        try { this.socket.send(JSON.stringify(value)); return true; } catch (_) { return false; }
      }
      return false;
    },
    disconnect() {
      this.disconnecting = true;
      clearTimeout(this.reconnectTimer); this.reconnectTimer = null;
      this.reconnecting = false;
      if (this.socket?.readyState === WebSocket.OPEN) this.send({type:'leave'});
      if (this.socket) {
        const ws = this.socket; this.socket = null;
        ws.onclose = null; try { ws.close(); } catch (_) {}
      }
      this.active = false; this.started = false; this.myId = null;
      this.state = null; this.lastRound = 0; this.lastSpike = null;
      this.lastMoveKey = null;
      this.token = null; this.roomCode = null; this.rtt = null;
      this.pingSent.clear(); this.retries = 0;
      this.removePeers();
      this.status('온라인 서버에 연결하지 않았습니다.');
    },
    connect(type, code, winRounds) {
      const url = String(window.GAME_SERVER_URL || '').replace(/\/$/, '');
      if (!/^https?:\/\//.test(url) && !/^wss?:\/\//.test(url)) {
        this.status('서버 URL을 확인해 주세요.', true); return;
      }
      this.disconnect();
      this.disconnecting = false;
      this.active = true;
      this.connectRequest = {type,code,winRounds};
      this.roomCode = code;
      this.status('서버 연결 중... (최초 접속은 시간이 걸릴 수 있습니다)');
      this.openSocket(this.connectRequest, false);
    },
    openSocket(request, recovering) {
      const url = String(window.GAME_SERVER_URL || '').replace(/\/$/, '');
      const wsURL = url.replace(/^http:/,'ws:').replace(/^https:/,'wss:') + '/ws';
      let ws;
      try { ws = new WebSocket(wsURL); }
      catch (err) { this.handleDisconnect('연결을 열 수 없습니다.'); return; }
      this.socket = ws;
      let opened = false;
      const timeout = setTimeout(() => {
        if (this.socket === ws && ws.readyState !== WebSocket.OPEN) ws.close();
      }, recovering ? 13000 : 55000);
      ws.onopen = () => {
        opened = true;
        clearTimeout(timeout);
        this.lastSent = 0;
        this.lastMoveKey = null;
        // On reconnect, preserve the exact player identity, team and equipment.
        this.send(recovering ? {type:'resume',code:this.roomCode,token:this.token} : request);
        this.status(recovering ? '서버 연결 복구 확인 중...' : '연결 성공 · 방 정보 확인 중...');
      };
      ws.onmessage = ev => {
        let data;
        try { data = JSON.parse(ev.data); } catch (_) { return; }
        if (this.socket !== ws) return;
        this.receive(data);
      };
      ws.onerror = () => {
        if (!opened && !recovering) this.status('서버 응답이 없습니다. 다시 연결을 시도합니다...', true);
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        if (this.socket !== ws) return;
        this.socket = null;
        this.handleDisconnect('서버 연결이 일시적으로 끊겼습니다.');
      };
    },
    handleDisconnect(message) {
      if (this.disconnecting || !this.active) return;
      // Keep current scene, health and room instead of kicking a player to menu.
      if (this.token && this.roomCode) {
        if (!this.reconnecting) this.reconnectStarted = performance.now();
        this.reconnecting = true;
        this.status(message + ' 자동 재접속 중...', true);
        this.scheduleReconnect();
      } else {
        // Connect failures before joining a room can be retried by the user.
        this.active = false;
        this.started = false;
        this.status(message + ' 방 참가를 다시 시도하세요.', true);
      }
    },
    scheduleReconnect(delay) {
      clearTimeout(this.reconnectTimer);
      if (!this.reconnecting || this.disconnecting) return;
      if (performance.now()-this.reconnectStarted > 40000) {
        this.reconnecting = false; this.active = false;
        this.status('재접속 실패 · 방 정보를 확인해 주세요.', true);
        if (this.api.matchState.inMatch) this.api.openEntryScreen();
        return;
      }
      const retryDelay = delay ?? Math.min(6000, 800 * (1.65 ** Math.min(this.retries++,5)));
      this.reconnectTimer = setTimeout(() => {
        if (this.reconnecting && !this.disconnecting && this.socket?.readyState !== WebSocket.OPEN)
          this.openSocket({type:'resume',code:this.roomCode,token:this.token},true);
      }, retryDelay);
    },
    receive(data) {
      const a = this.api;
      switch (data.type) {
        case 'hello': if (!this.reconnecting) this.myId = data.id; break;
        case 'pong': {
          const start = this.pingSent.get(data.seq);
          if (start !== undefined) {
            this.pingSent.delete(data.seq);
            const elapsed = performance.now()-start;
            if (elapsed > 0 && elapsed < 30000) {
              if (this.rtt == null) this.rtt = elapsed;
              else {
                this.jitter = this.jitter*0.8 + Math.abs(elapsed-this.rtt)*0.2;
                this.rtt = this.rtt*0.78 + elapsed*0.22;
              }
            }
          }
          break;
        }
        case 'resume_failed': {
          const reason = data.message || '기존 방이 초기화되었습니다.';
          this.disconnect();
          this.status(reason, true);
          if (a.matchState.inMatch) a.openEntryScreen();
          break;
        }
        case 'resumed': {
          this.token = data.token; this.roomCode = data.room.code;
          this.reconnecting = false; this.retries = 0;
          clearTimeout(this.reconnectTimer);
          this.myId = data.id;
          const returnToMatch = !!data.started;
          if (returnToMatch && (!this.started || !a.matchState.inMatch)) {
            this.started = true;
            a.launchAscentMatchImmediate();
            this.removePeers();
            a.bots.splice(0).forEach(b => a.scene.remove(b.group));
            this.lastRound = 0;
          } else if (!returnToMatch) {this.started = false; a.openWaitingLobby();}
          this.renderLobby(data.room);
          this.status('다시 연결되었습니다 · ROOM #' + data.room.code);
          break;
        }
        case 'error': this.status(data.message || '서버 요청 실패', true); break;
        case 'joined':
          this.token = data.token || null;
          this.roomCode = data.room.code;
          this.myId = data.id;
          a.roomState.code = data.room.code;
          a.roomState.playerSide = data.team;
          a.roomState.isHost = data.room.host === data.id;
          a.roomState.allowCheats = false;
          a.syncCheatPermissionUI();
          a.openWaitingLobby();
          this.status('온라인 연결됨 · ROOM #' + data.room.code);
          this.renderLobby(data.room);
          break;
        case 'lobby':
          this.renderLobby(data.room);
          break;
        case 'started':
          if (!this.started) {
            this.started = true;
            a.launchAscentMatchImmediate();
            this.removePeers();
            a.bots.splice(0).forEach(b => a.scene.remove(b.group));
            this.status('실시간 경기 진행 중');
          }
          break;
        case 'round': this.lastRound = 0; break;
        case 'state': this.applyState(data); break;
        case 'purchase': this.applyPurchase(data); break;
        case 'inventory':
        case 'ammo_sync': {
          // Equip and combat snapshots must not accidentally finish a running
          // reload; the server sends a dedicated reload_done event for that.
          for (const slot of ['primary','secondary']) {
            const w=a.player[slot];
            if (w?.id === data.weapon) {w.mag=data.mag;w.reserve=data.reserve;}
          }
          a.updateHUD();
          break;
        }
        case 'reload_started': {
          const p = a.player;
          if (p.pendingReloadWeapon === data.weapon &&
              (data.requestId == null || p.reloadId === data.requestId)) {
            p.reloading = true;
            p.reloadServerConfirmed = true;
            if (!a.viewmodel.isReloading) a.viewmodel.beginReload();
          }
          a.updateHUD();
          break;
        }
        case 'reload_done': {
          for (const slot of ['primary','secondary']) {
            const w=a.player[slot];
            if (w?.id===data.weapon){w.mag=data.mag;w.reserve=data.reserve;}
          }
          // Ammo is authoritative; an earlier missing start packet must not
          // prevent a valid completion from unlocking the control.
          if (a.player.pendingReloadWeapon===data.weapon ||
              (a.getActiveWeapon()?.id === data.weapon && a.player.reloading)) {
            a.player.pendingReloadWeapon=null;
            a.player.reloading=false;
            a.player.reloadServerConfirmed=false;
            a.player.reloadId=(a.player.reloadId||0)+1;
            a.viewmodel.stopReload();
          }
          a.updateHUD();
          break;
        }
        case 'reload_cancelled': {
          const p = a.player;
          // A mismatched server equip response is itself a rejection of the
          // pending request. Clear it rather than freezing until watchdog.
          if (p.reloading && (data.requestId == null || data.requestId === p.reloadId)) {
            p.pendingReloadWeapon = null;
            p.reloading = false;
            p.reloadServerConfirmed = false;
            p.reloadId = (p.reloadId || 0) + 1;
            a.viewmodel.stopReload();
          }
          a.updateHUD();
          break;
        }
        case 'shot': {
          if (data.shooter === this.myId || !this.started || !this.api.matchState.inMatch) break;
          const xyz = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
          if (xyz(data.from) && xyz(data.to)) {
            const start = new THREE.Vector3(...data.from);
            const gun = a.WEAPON_CATALOG[data.weapon];
            const lines = Array.isArray(data.pellets) && data.pellets.length <= 16
              ? data.pellets.filter(xyz) : [data.to];
            // Render all shotgun pellets, but keep one WS event per trigger pull.
            for (const coords of lines) {
              const end = new THREE.Vector3(...coords);
              a.spawnBulletTracer(start, end, gun?.color || 0xffd567);
            }
          }
          break;
        }
        case 'bullet_tag': if(a.player.alive) a.player.taggedAt=performance.now(); break;
        case 'hit': a.showHitmarker(!!data.headshot); if (data.headshot) a.sfx.playHeadshotDing(); break;
        case 'kill': {
          const players = this.state?.players || [];
          const killer = players.find(p => p.id === data.killer), victim = players.find(p => p.id === data.victim);
          const myKill = data.killer === this.myId;
          a.addKillFeed(myKill ? 'YOU' : (killer?.name || 'PLAYER'), victim?.name || 'PLAYER', (data.weapon || '').toUpperCase(), !!data.headshot);
          break;
        }
        case 'spike_planted': a.showRoundBanner('SITE ' + data.spike.site, 'SPIKE PLANTED'); break;
        case 'round_end': a.showRoundBanner(data.reason, data.team === a.roomState.playerSide ? 'ROUND WON' : 'ROUND LOST'); break;
        case 'match_end':
          a.showRoundBanner('MATCH COMPLETE', 'MATCH FINISHED');
          this.started = false; this.lastRound = 0;
          a.matchState.inMatch = false;
          a.openWaitingLobby();
          break;
      }
    },
    renderLobby(room) {
      if (!room) return;
      this.room = room;
      const a = this.api;
      a.roomState.code = room.code;
      a.roomState.isHost = room.host === this.myId;
      const me = room.players.find(p => p.id === this.myId);
      if (me) a.roomState.playerSide = me.team;
      const codeEl = document.getElementById('lobby-code-display');
      if (codeEl) codeEl.textContent = room.code;
      const board = document.getElementById('online-roster');
      if (board) {
        board.replaceChildren();
        for (const side of ['attack', 'defense']) {
          const col = document.createElement('div');
          col.className = 'room-roster-list ' + side;
          const people = room.players.filter(p => p.team === side);
          const heading = document.createElement('div');
          heading.className = 'room-roster-top';
          const title = document.createElement('strong');
          title.textContent = side === 'attack' ? 'ATTACKERS' : 'DEFENDERS';
          const count = document.createElement('span');
          count.textContent = `${people.length} / 5`;
          heading.append(title, count);
          col.appendChild(heading);
          for (let i = 0; i < 5; i++) {
            const p = people[i];
            const row = document.createElement('div');
            row.className = 'room-slot' + (p ? '' : ' empty');
            const avatar = document.createElement('span');
            avatar.className = 'room-slot-icon';
            avatar.textContent = p ? String(i + 1).padStart(2, '0') : '+';
            const name = document.createElement('span');
            name.className = 'room-slot-name';
            name.textContent = p ? p.name : 'EMPTY SLOT';
            row.append(avatar, name);
            if (p && (p.id === this.myId || p.id === room.host)) {
              const badge = document.createElement('span');
              badge.className = 'room-slot-badge';
              badge.textContent = p.id === this.myId ? 'YOU' : 'HOST';
              row.appendChild(badge);
            }
            col.appendChild(row);
          }
          board.appendChild(col);
        }
      }
      for (const [side, id] of [['attack', 'btn-team-attack'], ['defense', 'btn-team-defense']]) {
        const button = document.getElementById(id);
        if (!button) continue;
        const selected = a.roomState.playerSide === side;
        button.classList.toggle('is-selected', selected);
        button.textContent = selected ? '선택됨 ✓' : '팀 참가 ↗';
        button.disabled = selected;
      }
      const rounds = document.getElementById('room-win-target');
      if (rounds) rounds.textContent = `${room.winRounds || a.roomState.winRounds} ROUNDS`;
      const start = document.getElementById('online-start-btn');
      if (start) { start.disabled = !a.roomState.isHost; start.style.opacity = a.roomState.isHost ? '1' : '0.65';
        start.textContent = a.roomState.isHost ? '경기 시작하기  →' : '방장의 시작을 기다리는 중'; }
      this.status(`온라인 ROOM #${room.code} · ${room.players.length}/10명`);
      a.updateHUD();
    },
    applyState(state) {
      this.state = state;
      if (!this.started || !this.api.matchState.inMatch) return;
      const a = this.api;
      const me = state.players.find(p => p.id === this.myId);
      if (!me) return;
      if (this.lastRound !== state.round) {
        this.lastRound = state.round;
        this.lastSpike = false;
        a.startNewRound();
        a.bots.splice(0).forEach(b => a.scene.remove(b.group));
        this.peers.clear();
      }
      a.roomState.playerSide = me.team;
      a.matchState.phase = state.phase;
      a.matchState.round = state.round;
      a.matchState.timer = state.timer;
      a.matchState.allyScore = state.scores[me.team];
      a.matchState.enemyScore = state.scores[me.team === 'attack' ? 'defense' : 'attack'];
      a.matchState.spikePlanted = !!state.spike;
      if (state.spike) {
        a.matchState.spikePos.set(state.spike.x, state.spike.y, state.spike.z);
        a.spikeMesh.position.copy(a.matchState.spikePos);
        a.spikeMesh.visible = true;
      } else a.spikeMesh.visible = false;
      a.barrierGroup.visible = state.phase === 'buy';
      const skip = document.getElementById('hud-skip-buy-btn');
      if (skip) skip.classList.toggle('hidden', !a.roomState.isHost || state.phase !== 'buy');
      const cheat = document.getElementById('hud-cheat-btn');
      if (cheat) cheat.classList.add('hidden');
      const badge = document.getElementById('hud-phase-badge');
      if (badge) badge.textContent = state.phase === 'buy' ? 'BUY PHASE — B 키로 무기 구매' : state.phase === 'combat' ? 'COMBAT PHASE — ONLINE' : state.phase === 'planted' ? 'SPIKE PLANTED — ONLINE' : 'ROUND COMPLETE';
      // Snapshot HP/armor may change before a hit event arrives. Flash only
      // for live damage (not the initial round reset or spectator transitions).
      if (a.matchState.inMatch && a.player.alive && me.alive && state.phase !== 'buy' &&
          (me.hp < a.player.hp || me.armor < a.player.armor)) a.flashDamage();
      a.player.hp = me.hp;
      a.player.armor = me.armor;
      a.player.alive = me.alive;
      a.player.credits = me.credits;
      const gun = a.getActiveWeapon();
      if (gun.id === me.weapon) { gun.mag = me.mag; gun.reserve = me.reserve; }
      // The UI can be optimistic while waiting for a reload ack, but the
      // authoritative server completion always unlocks it eventually.
      if (me.reloading && me.reloadWeapon === gun.id) {
        a.player.reloading = true;
        a.player.pendingReloadWeapon = gun.id;
        a.player.reloadServerConfirmed = true;
        if (!a.viewmodel.isReloading) a.viewmodel.beginReload();
      } else if (a.player.pendingReloadWeapon) {
        // Recover even if reload_done was dropped: snapshots are server-truth.
        // Never prematurely unlock before the server has seen our request.
        const elapsed = performance.now() - (a.player.reloadRequestedAt || 0);
        if (a.player.reloadServerConfirmed || elapsed > 2200) {
          a.player.reloading = false;
          a.player.pendingReloadWeapon = null;
          a.player.reloadServerConfirmed = false;
          a.player.reloadId = (a.player.reloadId || 0) + 1;
          a.viewmodel.stopReload();
        }
      } else if (a.player.reloading && !me.reloading) {
        a.player.reloading = false;
        a.player.reloadServerConfirmed = false;
        a.viewmodel.stopReload();
      }
      // Honor server spawn on round start and server corrections for abnormal movement.
      if (state.phase === 'buy' && state.timer > 15.5) {
        a.player.pos.set(me.x, me.y, me.z);
        a.player.footY = me.footY;
        a.player.yaw = me.yaw;
      } else if (Math.hypot(a.player.pos.x - me.x, a.player.pos.z - me.z) > 2.5) {
        a.player.pos.x = me.x; a.player.pos.z = me.z;
      }
      const present = new Set();
      for (const rp of state.players) {
        if (rp.id === this.myId) continue;
        present.add(rp.id);
        let b = this.peers.get(rp.id);
        const isAlly = rp.team === me.team;
        if (!b) {
          const m = a.createTacticalBotMesh(isAlly);
          b = { id: rp.id, name: rp.name, team: isAlly ? 'ally' : 'enemy', alive: rp.alive, hp: rp.hp, armor: rp.armor,
            group: m.group, headMesh: m.head, bodyMesh: m.body, weapon: a.cloneWeaponInstance('classic'),
            footY: rp.footY, yaw: rp.yaw, pitch: rp.pitch, callout: 'ONLINE PLAYER', spotted: false };
          this.peers.set(rp.id, b);
          a.bots.push(b);
        }
        b.team = isAlly ? 'ally' : 'enemy';
        a.setEnemyOutline(b, !isAlly);
        b.name = rp.name; b.alive = rp.alive; b.hp = rp.hp; b.armor = rp.armor;
        b.footY = rp.footY; b.yaw = rp.yaw; b.pitch = rp.pitch;
        const weaponId = rp.weapon in a.WEAPON_CATALOG ? rp.weapon : 'classic';
        if (!b.weapon || b.weapon.id !== weaponId) b.weapon = a.cloneWeaponInstance(weaponId);
        b.spotted = state.phase !== 'buy' && (isAlly || Math.hypot(rp.x - a.player.pos.x, rp.z - a.player.pos.z) < 20);
        if (!b.targetPosition) b.targetPosition = new THREE.Vector3();
        b.targetPosition.set(rp.x, rp.footY, rp.z);
        if (Number.isFinite(state.serverAt)) {
          b.targetAt=state.serverAt;
          if (!b.hasServerPosition) b.renderAt=b.targetAt;
        }
        if (!b.hasServerPosition) { b.group.position.copy(b.targetPosition); b.hasServerPosition=true; }
        b.group.rotation.y = rp.yaw;
        b.group.visible = rp.alive && state.phase !== 'buy';
      }
      for (const [id,b] of this.peers) {
        if (!present.has(id)) { a.scene.remove(b.group); this.peers.delete(id); const ix = a.bots.indexOf(b); if (ix>=0) a.bots.splice(ix,1); }
      }
      const seconds = Math.max(0,Math.ceil(state.timer));
      document.getElementById('hud-timer-text').textContent = state.spike ? `SPIKE ${seconds}s` : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
      a.updateHUD();
    },
    removePeers() {
      if (!this.api) return;
      for (const b of this.peers.values()) {
        this.api.scene.remove(b.group);
        const idx = this.api.bots.indexOf(b); if(idx>=0)this.api.bots.splice(idx,1);
      }
      this.peers.clear();
    },
    fire(knifeMode = 'light') {
      const a=this.api,p=a.player;
      if (!this.started || !p.alive || p.reloading || this.state?.phase === 'buy') return;
      const w=a.getActiveWeapon();
      const now=performance.now()/1000;
      const rate = w.slot === 'knife' ? MeleeRules.MODES[MeleeRules.modeFor(knifeMode)].cooldown : w.fireRate;
      if(now-p.lastShotTime < rate) return;
      if(w.slot !== 'knife' && w.mag<=0){window.triggerReload?.();return;}
      const pelletRotation=Math.random()*Math.PI*2;
      const nowMs=performance.now();
      const burstState=w._spreadState||(w._spreadState={});
      const burst=ShootingSpread.burstIndex(burstState,w,nowMs);
      const seed=(Math.random()*4294967296)>>>0;
      const locomotion=ShootingSpread.motion(p);
      const shotParams={yaw:p.yaw,pitch:p.pitch,...locomotion,shotIndex:burst,seed,scatter:pelletRotation};
      const spreadResult=w.slot==='knife'?null:ShootingSpread.directions(w,shotParams,ShotgunPellets);
      // Clients render opponent positions slightly behind the latest server
      // state to smooth 10 Hz snapshots. Send that visual timestamp so the
      // server can evaluate the same historical pose, not a newer position.
      const cp=Math.cos(p.pitch);
      const aim=[-Math.sin(p.yaw)*cp,Math.sin(p.pitch),-Math.cos(p.yaw)*cp];
      let seenAt=Number.isFinite(this.state?.serverAt)?this.state.serverAt:Date.now();
      let bestScore=Infinity;
      for(const b of this.peers.values()) {
        if (b.team!=='enemy'||!b.alive||!Number.isFinite(b.renderAt)) continue;
        const v=[b.group.position.x-p.pos.x,b.group.position.y+1.4-p.pos.y,b.group.position.z-p.pos.z];
        const dist=Math.hypot(...v);
        if (dist<.1||dist>225)continue;
        const dot=v[0]*aim[0]+v[1]*aim[1]+v[2]*aim[2];
        if(dot<=0)continue;
        const offset=Math.sqrt(Math.max(0,dist*dist-dot*dot));
        if(offset<Math.max(1,dist*.04) && offset<bestScore){bestScore=offset;seenAt=b.renderAt;}
      }
      const from=[p.pos.x,p.pos.y,p.pos.z];
      // Update the authoritative firing origin before the fire request. WebSocket
      // preserves message ordering; this avoids shooting from stale positions.
      this.send({type:'move',x:p.pos.x,y:p.pos.y,z:p.pos.z,footY:p.footY,
        yaw:p.yaw,pitch:p.lookPitch??p.pitch});
      if(!this.send({type:'shoot',yaw:p.yaw,pitch:p.pitch,scatter:pelletRotation,
        burst,seed,speed:Math.min(8.5,locomotion.speed),airborne:locomotion.airborne,
        crouched:locomotion.crouched,ads:locomotion.ads,
        mode:w.slot === 'knife' ? MeleeRules.modeFor(knifeMode) : undefined,
        seenAt:Math.round(seenAt),from}))return;
      p.lastShotTime=now;
      if(w.slot!=='knife')ShootingSpread.confirmShot(burstState,w,nowMs,burst);
      if(w.slot!=='knife')w.mag--;
      a.viewmodel.fire(knifeMode);
      window.markCrosshairFiring?.();
      if(w.slot==='knife') {
        a.sfx.playKnifeSlash();
      } else {
        a.sfx.playGunshot(w.id==='operator'?92:165,0.11);
        a.muzzleFlashMesh.material.opacity=1;
        setTimeout(()=>{a.muzzleFlashMesh.material.opacity=0;},45);
        a.gunGroup.position.z=-0.32;
        a.drawLocalShot(w,pelletRotation,spreadResult);
        ShootingSpread.applyRecoil(p,w,nowMs);
      }
      a.updateHUD();
    },
    buy(id) { this.send({type:'buy',item:id}); },
    applyPurchase(data) {
      const a=this.api,p=a.player,id=data.item;
      if (id !== 'light_shield' && id !== 'heavy_shield') {
        const item=a.WEAPON_CATALOG[id];
        if (item) {
          p[item.slot]=a.cloneWeaponInstance(id);
          a.switchWeaponSlot(item.slot);
        }
      }
      p.credits=data.credits;p.armor=data.armor;
      a.updateHUD();
      const fb=document.getElementById('shop-feedback');if(fb)fb.textContent='SERVER: 구매 완료';
    },
    tick(dt) {
      for (const b of this.peers.values()) {
        if (!b.targetPosition) continue;
        const alpha=Math.min(1,(dt||0.016)*13);
        b.group.position.lerp(b.targetPosition,alpha);
        if (Number.isFinite(b.targetAt) && Number.isFinite(b.renderAt))
          b.renderAt+=(b.targetAt-b.renderAt)*alpha;
      }
      if (!this.active || !this.started || !this.api?.matchState.inMatch) return;
      const now=performance.now();
      const p=this.api.player;
      const held=!!this.api.getSpikeHeld();
      if(held!==this.lastSpike) {
        if (this.send({type:'spike',held})) this.lastSpike=held;
      }
      if(now-this.lastSent < (this.rtt != null && this.rtt>140 ? 80 : 65))return;
      // Do not flood the room with identical stationary/aim-still packets.
      // A periodic 600ms refresh keeps server presence and hold state alive.
      const q=n=>Math.round(n*1000)/1000;
      const move={type:'move',x:q(p.pos.x),y:q(p.pos.y),z:q(p.pos.z),
        footY:q(p.footY),yaw:q(p.yaw),pitch:q(p.lookPitch??p.pitch)};
      const key=`${move.x}|${move.y}|${move.z}|${move.footY}|${move.yaw}|${move.pitch}`;
      if (key !== this.lastMoveKey || now-this.lastSent >= 600) {
        if (this.send(move)) {this.lastMoveKey=key; this.lastSent=now;}
      }
      const el=document.getElementById('hud-context-prompt');
      const box=document.getElementById('spike-action-box');
      const bar=document.getElementById('spike-action-bar');
      const pct=document.getElementById('spike-action-pct');
      const label=document.getElementById('spike-action-label');
      if (el && box && this.state) {
        const s=this.state, side=this.api.roomState.playerSide;
        const site=this.api.gameSpikeSiteAt(p.pos.x,p.pos.z,p.footY);
        const plant=p.alive&&s.phase==='combat'&&side==='attack'&&!!site;
        const defuse=p.alive&&s.phase==='planted'&&side==='defense'&&s.spike&&
          Math.hypot(p.pos.x-s.spike.x,p.pos.z-s.spike.z)<4.5;
        const action=this.state.players.find(q=>q.id===this.myId)?.spikeAction;
        const eligible=plant||defuse;
        el.classList.toggle('hidden',!eligible);
        if(eligible)el.textContent=plant?`[4/F] 길게 눌러 ${site} 사이트에 설치 (4초)`:'[4/F] 길게 눌러 해체 (7초)';
        const moving=eligible&&held&&action&&action.progress>0;
        box.classList.toggle('hidden',!moving);
        if(moving){
          const progress=Math.min(100,Math.max(0,Math.round(action.progress*100)));
          bar.style.width=progress+'%';pct.textContent=progress+'%';
          label.textContent=plant?'SPIKE PLANTING...':'SPIKE DEFUSING...';
        }
      }
    }
  };
  window.MP = MP;
})();