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
  const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(x)?x:lo));
  function weaponProfile(w){
    const p=profiles[w?.id]||profiles.vandal;
    return {move:p[0],growth:p[1],rise:p[2],side:p[3],recovery:p[4]};
  }
  function burstIndex(state,w,nowMs){
    const profile=weaponProfile(w);
    if(!state||state.weapon!==w.id||!Number.isFinite(state.at)||nowMs-state.at>profile.recovery)
      return 0;
    return Math.min(19,(state.count||0)+1);
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
  function sample(w,options={}){
    const p=weaponProfile(w), shot=clamp(Math.floor(options.shotIndex||0),0,19);
    const move=clamp((clamp(options.speed||0,0,9)-.16)/7.45,0,1);
    const onMove=move*move*(3-2*move); // walking < running; no sudden binary penalty
    const air=options.airborne?1:0, crouch=options.crouched ? .85 : 1;
    const ads=options.ads&&w?.canScope?.68:1;
    const scatterBase=Math.max(.0001,Number(w?.spreadBase)||0);
    const multi=(w?.pellets||1)>1;
    // Shotgun fan is an independent pellet cone; this term displaces its center.
    const base=multi?.0045:scatterBase;
    const moveCone=(Math.max(.012,Number(w?.spreadMove)||.04)*p.move)*onMove*crouch*ads;
    const airborneCone=air*.040*p.move;
    const sprayCone=Math.min(12,shot)*.0020*p.growth*(ads*.83+.17);
    const cone=Math.min(.19,base*ads + moveCone + airborneCone + sprayCone);
    const [randA,randB]=rand2(options.seed);
    const radius=Math.sqrt(randA)*cone; // uniform disk, not central-bias moving shots
    const theta=randB*2*Math.PI;
    const jitterX=Math.cos(theta)*radius;
    const jitterY=Math.sin(theta)*radius;
    const climb=Math.min(14,shot)*.0016*p.rise*(1+onMove*.4);
    const sway=shot===0?0:Math.sin(shot*.87)*Math.min(13,shot)*.00115*p.side;
    const yaw=options.yaw+jitterX+sway;
    const pitch=clamp(options.pitch+jitterY+climb,-1.48,1.48);
    const pelletCone=multi?Math.min(.17,scatterBase*(1+onMove*.65+shot*.045+air*.25)) : 0;
    return {yaw,pitch,cone,shotIndex:shot,moveFactor:onMove,pelletCone,
      recoil:climb,offsetX:jitterX+sway,offsetY:jitterY+climb};
  }
  function directions(w,options,pellets){
    const shot=sample(w,options);
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
  return {profiles,weaponProfile,burstIndex,confirmShot,motion,sample,directions,crosshairError};
});