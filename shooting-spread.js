/* Fictional FPS shot-variation system shared by browser visuals and room-server hit checks.
 * One deterministic seed per game shot: movement, successive shots, and each
 * weapon's fictional handling profile contribute to the virtual ray direction.
 */
(function(global, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(global)global.ShootingSpread=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const profiles=Object.freeze({
    bandit:[.85,.8,.7,.75,440], warden:[1.08,.86,.95,.91,450],
    ares:[1.2,1.05,.95,.98,460], odin:[1.28,1.08,1.04,1.02,480],
    classic:  [0.76,0.73,0.65,0.70,405],
    shorty:   [1.00,0.82,0.52,0.82,680],
    frenzy:   [0.84,1.14,1.00,1.08,360],
    ghost:    [0.73,0.60,0.58,0.65,395],
    sheriff:  [1.02,1.10,0.85,0.90,520],
    stinger:  [0.84,1.20,0.90,1.05,320],
    spectre:  [0.75,0.94,0.72,0.80,345],
    bucky:    [1.10,0.72,0.55,0.65,750],
    judge:    [1.08,1.08,0.76,0.88,420],
    bulldog:  [1.06,0.95,0.78,0.95,390],
    guardian: [0.92,0.63,0.63,0.70,420],
    phantom:  [0.96,0.85,0.82,0.85,360],
    vandal:   [1.03,1.00,1.00,1.00,380],
    marshal:  [1.32,0.52,1.00,0.70,760],
    outlaw:   [1.45,0.70,1.08,0.78,800],
    operator: [1.65,0.80,1.20,0.86,930]
  });
  // Pitch samples in degrees at shots 1, 2, 3, 5, 8, 12, 20.
  // Anchors are tuned approximations; published first-shot cones are separate.
  const pitchAt = [0,1,2,4,7,11,19];
  const handling = {
    bandit:{hip:.275,pitch:[0,.12,.45,1.1,2,2,2]},
    warden:{hip:.23,ads:.04,pitch:[0,.16,.52,1.5,3.1,3.6,3.6]},
    ares:{hip:1,ads:.9,pitch:[0,.1,.45,1.4,2.7,3.4,3.5]},
    odin:{hip:.8,ads:.79,pitch:[0,.1,.42,1.5,3,3.7,3.8]},
    classic:  {hip:.4,  pitch:[0,.06,.24,.78,1.65,2.05,2.05]},
    shorty:   {hip:4,   pitch:[0,.55,.55,.55,.55,.55,.55]},
    frenzy:   {hip:.65, pitch:[0,.18,.85,3.5,3.5,3.5,3.5], bloom:4},
    ghost:    {hip:.3,  pitch:[0,.045,.18,.65,1.25,1.6,1.6]},
    sheriff:  {hip:.25, pitch:[0,.28,.8,2.25,3.1,3.1,3.1]},
    stinger:  {hip:.65, ads:.35,pitch:[0,.18,.7,2.4,3.9,4.3,4.3], bloom:5},
    spectre:  {hip:.4,  ads:.25,pitch:[0,.07,.28,1.15,2.65,3.4,3.4], protected:5},
    bucky:    {hip:3,   pitch:[0,.09,.12,.12,.12,.12,.12]},
    judge:    {hip:2.5, pitch:[0,.25,.72,1.65,2.4,2.4,2.4]},
    bulldog:  {hip:.3,  ads:.3,pitch:[0,.09,.31,1.35,2.95,3.75,3.75], protected:5},
    guardian: {hip:.1,  ads:0,pitch:[0,.15,.54,1.4,2.3,2.5,2.5]},
    phantom:  {hip:.2,  ads:.11,pitch:[0,.055,.22,1.05,2.75,3.65,3.65], protected:8},
    vandal:   {hip:.25, ads:.1575,pitch:[0,.085,.34,1.55,3.45,4.2,4.2], protected:6},
    marshal:  {hip:1,   ads:0,pitch:[0,.06,.08,.08,.08,.08,.08]},
    outlaw:   {hip:3.5, ads:0,pitch:[0,.52,.52,.52,.52,.52,.52]},
    operator: {hip:5,   ads:0,pitch:[0,.025,.03,.03,.03,.03,.03]}
  };
  function pitchDegrees(curve, shot) {
    for(let i=1;i<pitchAt.length;i++){
      if(shot<=pitchAt[i]){
        const t=(shot-pitchAt[i-1])/(pitchAt[i]-pitchAt[i-1]);
        return curve[i-1]+t*(curve[i]-curve[i-1]);
      }
    }
    return curve[curve.length-1];
  }
  const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(x)?x:lo));
  function weaponProfile(w){
    const p=profiles[w?.id]||profiles.vandal;
    return {move:p[0],growth:p[1],rise:p[2],side:p[3],recovery:p[4]};
  }
  function burstIndex(state,w,nowMs){
    const profile=weaponProfile(w);
    if(!state||state.weapon!==w.id||!Number.isFinite(state.at)||nowMs-state.at>profile.recovery)
      return 0;
    const interval = (w.fireRate || 0) * 1000;
    const elapsed = Math.max(0, nowMs - state.at);
    if (elapsed >= profile.recovery) return 0;
    const remaining = 1 - clamp((elapsed - interval) / Math.max(1, profile.recovery - interval), 0, 1);
    return Math.min(19, Math.round(((state.count || 0) + 1) * remaining));
  }
  function confirmShot(state,w,nowMs,index){
    if(!state)return;
    state.weapon=w.id;
    state.at=nowMs;
    state.count=clamp(index,0,19);
  }
  function motion(player){
    return {
      speed:Math.hypot(player?.vel?.x||0,player?.vel?.z||0),
      airborne:player?.onGround===false,
      crouched:!!player?.crouchToggle||!!player?.crouching,
      ads:!!player?.isScoped
    };
  }
  function rand2(seed){
    let n=(Number(seed)>>>0)||0x8f24a91f;
    function next(){n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;}
    return [next(),next()];
  }
  // PC 11.08 rifle yaw switches. Track the lateral center separately from shot scatter.
  function automaticYaw(w, options, shot, protectedShots, amplitude, switchMs) {
    const state=options.recoilState || {};
    const time=options.shotTime ?? shot*w.fireRate*1000;
    const [initial, roll]=rand2((options.seed ^ 0xa3c59ac3) >>> 0);
    if (!shot || state.yawWeapon!==w.id || !Number.isFinite(state.yawAt)) {
      state.yawWeapon=w.id;
      state.yawSign=initial<.5 ? -1 : 1;
      state.yawCenter=0;
      state.yawAt=time;
      state.yawSwitchAt=-Infinity;
    }
    const elapsed=Math.max(0,time-state.yawAt);
    if (shot>=protectedShots && time-state.yawSwitchAt>=switchMs && roll<.10) {
      state.yawSign*=-1;
      state.yawSwitchAt=time;
    }
    const target=state.yawSign*amplitude*Math.min(1,shot/10);
    // Traverse the full lateral width over the configured transition time.
    const step=2*amplitude*elapsed/switchMs;
    state.yawCenter+=clamp(target-state.yawCenter,-step,step);
    state.yawAt=time;
    return state.yawCenter;
  }
  function sample(w,options={}){
    const p=weaponProfile(w), shot=clamp(Math.floor(options.shotIndex||0),0,19);
    const move=clamp((clamp(options.speed||0,0,9)-.16)/7.45,0,1);
    const onMove=move*move*(3-2*move); // walking < running; no sudden binary penalty
    const air=options.airborne?1:0, crouch=options.crouched ? .85 : 1;
    const ads=options.ads&&w?.canScope?.68:1;
    const tune=handling[w.id]||handling.vandal;
    const rad=Math.PI/180;
    const scatterBase=(options.ads && w.canScope ? (tune.ads ?? tune.hip) : tune.hip)*rad;
    const multi=(w?.pellets||1)>1;
    // Shotgun fan is an independent pellet cone; this term displaces its center.
    const base=multi?.0045:scatterBase;
    const moveCone=(Math.max(.012,Number(w?.spreadMove)||.04)*p.move)*onMove*crouch*ads;
    const airborneCone=air*.040*p.move;
    const sprayCone=Math.pow(Math.min(1,shot/(tune.bloom??11)),1.5)*.024*p.growth*(ads*.83+.17);
    const cone=Math.min(.19,base + moveCone + airborneCone + sprayCone);
    const [randA,randB]=rand2(options.seed);
    const radius=Math.sqrt(randA)*cone; // uniform disk, not central-bias moving shots
    const theta=randB*2*Math.PI;
    const jitterX=Math.cos(theta)*radius;
    const jitterY=Math.sin(theta)*radius;
    const climb=pitchDegrees(tune.pitch,shot)*rad*(1+onMove*.4);
    const rifleSwitch = ['bulldog','vandal','phantom'].includes(w.id);
    const switchMs = rifleSwitch ? 600 : w.id==='spectre' ? 280 : p.recovery;
    const amplitude = .014*p.side;
    const sway = w.auto
      ? automaticYaw(w,options,shot,tune.protected ?? 3,amplitude,switchMs)
      : (rand2((options.seed ^ 0x7f4a7c15) >>> 0)[1]*2-1)*amplitude*Math.min(1,shot/10);
    const yaw=options.yaw+jitterX+sway;
    const pitch=clamp(options.pitch+jitterY+climb,-1.48,1.48);
    const pelletCone=multi?Math.min(.17,scatterBase*(1+onMove*.65+shot*.045+air*.25)) : 0;
    return {yaw,pitch,cone,shotIndex:shot,moveFactor:onMove,pelletCone,
      recoil:climb,offsetX:jitterX+sway,offsetY:jitterY+climb};
  }
  function directions(w,options,pellets){
    const shot=sample(w,options);
    if (options.alt && (w.id === 'classic' || w.id === 'bucky')) {
      const classic = w.id === 'classic';
      const count = classic ? Math.min(3, options.ammo) : 5;
      const movement = options.airborne ? 2.25 : Math.min(1, options.speed / 5.73) * 1.5;
      const cone = Math.tan((classic ? 1.9 + movement : 2) * Math.PI / 180);
      const vectors = pellets.directions(shot.yaw, shot.pitch, count, cone, options.scatter);
      return {shot, vectors, splitDistance: classic ? 0 : 8};
    }
    const vectors=pellets.directions(shot.yaw,shot.pitch,w?.pellets||1,shot.pelletCone,options.scatter||0);
    return {shot,vectors};
  }
  function crosshairError(w,player,atMs=0){
    const state=w?._spreadState;
    const recent=state&&atMs-state.at<weaponProfile(w).recovery?state.count:0;
    const m=motion(player);
    const moving=clamp(m.speed/7.6,0,1);
    return clamp((moving*7)+(m.airborne?3:0)+(Math.min(10,recent)*.45),0,10);
  }
  const runMultipliers=Object.freeze({
    bandit:.8,warden:.8,ares:.76,odin:.76,knife:1, classic:.85, frenzy:.85, ghost:.85, shorty:.8, sheriff:.8,
    stinger:.85, spectre:.85, bucky:.75, judge:.75, bulldog:.8, guardian:.8,
    phantom:.8, vandal:.8, marshal:.8, outlaw:.8, operator:.76
  });
  function tagMultiplier(actor,now){
    if(!Number.isFinite(actor.taggedAt))return 1;
    return .275 + .725 * clamp((now-actor.taggedAt-150)/200,0,1);
  }
  function movementSpeed(id,crouching,walking){
    return 6.75*(runMultipliers[id]??.8)*(crouching?.35:walking?.6:1);
  }
  // Range start in map meters, then head, body and leg damage per projectile.
  const damageRanges={
    bandit:[[0,152,39,33],[10,128,39,33],[30,112,34,28]],
    warden:[[0,200,50,42]],
    ares:[[0,75,30,25],[30,70,28,23]],
    odin:[[0,95,38,32],[30,77,31,26]],
    vandal: [[0, 160, 40, 34]],
    bulldog: [[0, 115.5, 35, 29.75]],
    phantom: [[0, 156, 39, 33.15], [20, 140, 35, 29.75]],
    judge: [[0, 34, 17, 14.45], [10, 20, 10, 8.5], [15, 14, 7, 5.95]],
    bucky: [[0, 34, 17, 14], [8, 26, 13, 11.05], [12, 18, 9, 7.65]],
    frenzy: [[0, 78, 26, 22.1], [20, 63, 21, 17.85]],
    classic: [[0, 78, 26, 22.1], [30, 66, 22, 18.7]],
    ghost: [[0, 105, 30, 25.5], [30, 87.5, 25, 21.25]],
    sheriff: [[0, 159.5, 55, 46.75], [30, 145, 50, 42.5]],
    shorty: [[0, 22, 11, 9.35], [7, 12, 6, 5.1], [15, 6, 3, 2.55]],
    operator: [[0, 255, 150, 120]],
    guardian: [[0, 195, 65, 48.75]],
    outlaw: [[0, 238, 140, 119]],
    marshal: [[0, 202, 101, 85.85]],
    spectre: [[0, 78, 26, 22.1], [15, 66, 22, 18.7], [30, 60, 20, 17]],
    stinger: [[0, 67.5, 27, 22.95], [15, 57, 23, 19]]
  };
  function fireInterval(w, ads, state, nowMs){
    if(w.id==='odin' && !ads) return 1 / (12 + Math.min(burstIndex(state || {}, w, nowMs), 6) * .6);
    return (ads && w.scopedInterval) || w.fireRate;
  }
  function applyGunDamage(target,id,distance,zone){
    const ranges=damageRanges[id];
    const band=ranges.findLast(row=>distance>=row[0]);
    const raw=band[zone==='head'?1:zone==='leg'?3:2];
    const absorbed=Math.min(target.armor,raw*.66);
    const previous=target.hp;
    target.armor=Math.round((target.armor-absorbed)*10000)/10000;
    target.hp=Math.max(0,Math.round((target.hp-raw+absorbed)*10000)/10000);
    return previous-target.hp;
  }
  return {fireInterval,applyGunDamage,movementSpeed,tagMultiplier,profiles,weaponProfile,burstIndex,confirmShot,motion,sample,directions,crosshairError};
});