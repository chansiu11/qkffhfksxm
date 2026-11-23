/* Crosshair import dialog. Uses localStorage only; no network requests. */
(function () {
  'use strict';
  const KEY='ascent-crosshair-code-v1';
  let profile=null, firingUntil=0, lastErrorFrame=0;
  const get=(id)=>document.getElementById(id);
  const isOpen=()=>!get('crosshair-settings').classList.contains('hidden');
  function renderAll() {
    if (!profile) return;
    CrosshairProfiles.render(get('crosshair'),profile,{ads:!!window.ascentScoped});
    CrosshairProfiles.render(get('crosshair-preview'),profile);
  }
  function apply(code) {
    const next=CrosshairProfiles.parse(code);
    profile=next;
    try {localStorage.setItem(KEY,next.code);} catch (_) {}
    get('crosshair-code').value=next.code;
    renderAll();
    const status=get('crosshair-status');
    status.textContent='조준점 코드 적용 완료 · 설정은 이 브라우저에 저장됩니다.';
    status.style.color='#38e2c7';
  }
  window.openCrosshairSettings=function(event){
    if(event?.preventDefault)event.preventDefault();
    const dialog=get('crosshair-settings');
    if(!dialog)return;
    dialog.classList.remove('hidden');
    try { if(document.pointerLockElement) document.exitPointerLock(); }catch(_){}
    get('crosshair-code').focus();
  };
  window.closeCrosshairSettings=function(event){
    if(event?.preventDefault)event.preventDefault();
    get('crosshair-settings')?.classList.add('hidden');
  };
  window.isCrosshairSettingsOpen=isOpen;
  window.markCrosshairFiring=function(){firingUntil=performance.now()+180;};
  window.setCrosshairScoped=function(isScoped){
    window.ascentScoped=!!isScoped;
    if(profile) CrosshairProfiles.render(get('crosshair'),profile,{ads:!!window.ascentScoped});
  };
  window.updateCrosshairErrors=function(movement=0,now=performance.now()){
    if(now-lastErrorFrame<60 || !profile)return;
    lastErrorFrame=now;
    CrosshairProfiles.errorOffset(get('crosshair'),Math.min(10,Math.max(0,movement)),now<firingUntil?4:0);
  };
  document.addEventListener('DOMContentLoaded',()=>{
    get('crosshair-form').addEventListener('submit',e=>{
      e.preventDefault();
      try{apply(get('crosshair-code').value.trim());}
      catch(err){const status=get('crosshair-status');status.textContent=err.message;status.style.color='#ff8c8c';}
    });
    get('crosshair-reset').addEventListener('click',()=>apply(CrosshairProfiles.DEFAULT));
    get('crosshair-close').addEventListener('click',window.closeCrosshairSettings);
    get('crosshair-settings').addEventListener('pointerdown',e=>{
      if(e.target===e.currentTarget)window.closeCrosshairSettings();
    });
    try{apply(localStorage.getItem(KEY)||CrosshairProfiles.DEFAULT);}
    catch(_){apply(CrosshairProfiles.DEFAULT);}
  });
})();