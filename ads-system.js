/* Visual-only aiming transition for the browser FPS. No impact on server hits. */
(function(root,factory){
  const API=factory();
  if(typeof module==='object'&&module.exports)module.exports=API;
  if(root)root.GameADS=API;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const DURATION_MS=100;
  const ZOOM=Object.freeze({
    stinger:1.15,spectre:1.15,bulldog:1.25,guardian:1.5,
    phantom:1.25,vandal:1.25,marshal:3.5,outlaw:3.5,operator:3.5
  });
  const SNIPERS=new Set(['marshal','outlaw','operator']);
  // Individual, purely cosmetic ADS sight themes for the game's non-scoped guns.
  const SIGHTS=Object.freeze({
    stinger:{accent:'#b795fc',shape:'compact'},
    spectre:{accent:'#80d8ee',shape:'compact'},
    bulldog:{accent:'#7ce2b2',shape:'bullpup'},
    guardian:{accent:'#a8c5ff',shape:'precision'},
    phantom:{accent:'#77dfc8',shape:'standard'},
    vandal:{accent:'#f0c466',shape:'standard'}
  });

  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
  function isEligible(weapon){return !!weapon&&weapon.slot==='primary'&&weapon.canScope===true&&Object.hasOwn(ZOOM,weapon.id);}
  function isSniper(weapon){return !!weapon&&SNIPERS.has(weapon.id);}
  function fov(weapon,normal=75){
    const zoom=ZOOM[weapon?.id]||1;
    return 2*Math.atan(Math.tan(normal*Math.PI/360)/zoom)*180/Math.PI;
  }
  function current(player,now){
    if(!Number.isFinite(player.adsStartedAt))return clamp(player.adsProgress);
    const t=clamp((now-player.adsStartedAt)/DURATION_MS);
    const smooth=t*t*(3-2*t);
    return clamp((player.adsFrom||0)+((player.adsTo||0)-(player.adsFrom||0))*smooth);
  }
  function request(player,now,enable){
    const value=current(player,now);
    player.adsFrom=value;
    player.adsTo=enable?1:0;
    player.adsRequested=!!enable;
    player.adsStartedAt=now;
    player.adsProgress=value;
    player.isScoped=false;
    return value;
  }
  function update(player,now){
    player.adsProgress=current(player,now);
    player.isScoped=!!player.adsRequested&&player.adsProgress>=.99999;
    return player.adsProgress;
  }
  function reset(player){
    player.adsFrom=0;player.adsTo=0;player.adsRequested=false;
    player.adsProgress=0;player.adsStartedAt=NaN;player.isScoped=false;
  }
  return Object.freeze({DURATION_MS,ZOOM,SIGHTS,isEligible,isSniper,fov,current,request,update,reset});
});