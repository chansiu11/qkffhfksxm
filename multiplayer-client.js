/* Realtime bridge for the supplied Three.js game. No changes to map geometry or PC/mobile controls. */
(function () {
  'use strict';
  const MP = {
    active: false, started: false, myId: null, socket: null, api: null,
    state: null, room: null, lastRound: 0, lastSent: 0, lastSpike: null,
    peers: new Map(),
    install(api) { this.api = api; this.status('온라인 서버에 연결하지 않았습니다.');
      setInterval(()=>{if(this.active)this.send({type:'ping'});},30000); },
    status(message, error = false) {
      for (const id of ['online-status', 'online-lobby-status']) {
        const el = document.getElementById(id);
        if (el) { el.textContent = message; el.style.color = error ? '#ff7785' : '#38e2c7'; }
      }
    },
    send(value) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(value)); return true;
      }
      return false;
    },
    disconnect() {
      this.active = false; this.started = false; this.myId = null;
      this.state = null; this.lastRound = 0; this.lastSpike = null;
      if (this.socket) { const ws = this.socket; this.socket = null; ws.onclose = null; ws.close(); }
      this.removePeers();
      this.status('온라인 서버에 연결하지 않았습니다.');
    },
    connect(type, code, winRounds) {
      const url = String(window.GAME_SERVER_URL || '').replace(/\/$/, '');
      if (!/^https?:\/\//.test(url) && !/^wss?:\/\//.test(url)) {
        this.status('서버 URL이 설정되지 않았습니다. config.js를 확인하세요.', true);
        return;
      }
      this.disconnect();
      this.active = true;
      this.status('Render 서버에 연결 중...');
      const wsURL = url.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws';
      let ws;
      try { ws = new WebSocket(wsURL); }
      catch (err) { this.active = false; this.status('서버 주소 오류: ' + err.message, true); return; }
      this.socket = ws;
      const timeout = setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) ws.close(); }, 15000);
      ws.onopen = () => {
        clearTimeout(timeout);
        this.status('연결 성공 · 방 정보를 확인 중...');
        this.send({ type, code, winRounds });
      };
      ws.onmessage = (event) => {
        let data; try { data = JSON.parse(event.data); } catch (_) { return; }
        this.receive(data);
      };
      ws.onerror = () => { this.status('연결에 실패했습니다. Render 서비스 상태를 확인하세요.', true); };
      ws.onclose = () => {
        clearTimeout(timeout);
        if (this.socket !== ws) return;
        this.socket = null; this.active = false; this.started = false;
        this.status('서버 연결이 끊어졌습니다. 다시 방에 참가하세요.', true);
        if (this.api.matchState.inMatch) {
          this.api.matchState.inMatch = false;
          document.getElementById('ingame-hud').classList.add('hidden');
          document.getElementById('mobile-controls').classList.add('hidden');
          document.getElementById('entry-screen').classList.remove('hidden');
        }
      };
    },
    receive(data) {
      const a = this.api;
      switch (data.type) {
        case 'hello': this.myId = data.id; break;
        case 'error': this.status(data.message || '서버 요청 실패', true); break;
        case 'joined':
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
          if (a.player.activeSlot === 'primary' || a.player.activeSlot === 'secondary') {
            const w = a.getActiveWeapon();
            if (w.id === data.weapon) { w.mag = data.mag; w.reserve = data.reserve; }
          }
          a.player.reloading = false;
          a.viewmodel.stopReload();
          a.updateHUD(); break;
        case 'shot': {
          if (data.shooter === this.myId || !this.started || !this.api.matchState.inMatch) break;
          const xyz = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
          if (xyz(data.from) && xyz(data.to)) {
            const start = new THREE.Vector3(...data.from);
            const end = new THREE.Vector3(...data.to);
            const gun = a.WEAPON_CATALOG[data.weapon];
            a.spawnBulletTracer(start, end, gun?.color || 0xffd567);
          }
          break;
        }
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
      a.player.hp = me.hp;
      a.player.armor = me.armor;
      a.player.alive = me.alive;
      a.player.credits = me.credits;
      const gun = a.getActiveWeapon();
      if (gun.id === me.weapon) { gun.mag = me.mag; gun.reserve = me.reserve; }
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
        b.weapon = a.cloneWeaponInstance(rp.weapon in a.WEAPON_CATALOG ? rp.weapon : 'classic');
        b.spotted = state.phase !== 'buy' && (isAlly || Math.hypot(rp.x - a.player.pos.x, rp.z - a.player.pos.z) < 20);
        b.targetPosition = new THREE.Vector3(rp.x, rp.footY, rp.z);
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
    fire() {
      const a=this.api, p=a.player;
      if (!this.started || !p.alive || p.reloading || this.state?.phase === 'buy') return;
      const w=a.getActiveWeapon();
      const now=performance.now()/1000;
      if(now-p.lastShotTime < w.fireRate || (w.slot !== 'knife' && w.mag<=0)) return;
      p.lastShotTime=now;
      if(w.slot!=='knife')w.mag--;
      a.viewmodel.fire();
      if(w.slot==='knife') {
        a.sfx.playKnifeSlash();
      } else {
        a.sfx.playGunshot(w.id==='operator'?92:165,0.11);
        a.muzzleFlashMesh.material.opacity=1;
        setTimeout(()=>{a.muzzleFlashMesh.material.opacity=0;},45);
        a.gunGroup.position.z=-0.32;
        // Visual prediction for the shooter; the server broadcasts the authoritative shot to other clients.
        a.drawLocalShot(w);
      }
      this.send({type:'shoot',yaw:p.yaw,pitch:p.pitch});
      if(w.slot!=='knife')p.pitch=Math.min(1.48,p.pitch+w.recoilPitch);
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
      for (const b of this.peers.values()) { if (b.targetPosition) b.group.position.lerp(b.targetPosition, Math.min(1, (dt || 0.016)*13)); }
      if (!this.active || !this.started || !this.api?.matchState.inMatch) return;
      const now=performance.now();
      if(now-this.lastSent < 50)return;
      this.lastSent=now;
      const p=this.api.player;
      this.send({type:'move',x:p.pos.x,y:p.pos.y,z:p.pos.z,footY:p.footY,yaw:p.yaw,pitch:p.pitch});
      const held=!!this.api.getSpikeHeld();
      if(held!==this.lastSpike) {this.send({type:'spike',held});this.lastSpike=held;}
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