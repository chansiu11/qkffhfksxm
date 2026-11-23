'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ads=require('../ads-system.js');
const root=path.join(__dirname,'..');
const vmSource=fs.readFileSync(path.join(root,'weapon-viewmodels.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const {runInNewContext}=require('node:vm');
const context={window:{},document:{},performance:{now:()=>0}};
runInNewContext(vmSource,context);
const v=context.window.WeaponViewmodels;
const guns=Object.keys(v.styles);

test('ADS is enabled only for eligible rifles/SMGs/snipers, never pistols, shotguns or knife',()=>{
  const should=['stinger','spectre','bulldog','guardian','phantom','vandal','marshal','outlaw','operator'];
  for(const id of guns){
    const eligible=should.includes(id);
    assert.equal(ads.isEligible({id,slot:eligible?'primary':id==='knife'?'knife':id==='bucky'||id==='judge'?'primary':'secondary',canScope:eligible}),eligible,id);
  }
  for(const id of ['knife','classic','shorty','frenzy','ghost','sheriff','bucky','judge']){
    assert(!ads.isEligible({id,slot:'primary',canScope:true}),id+' must have no zoom');
  }
});

test('ADS begins only after 100ms; 50ms aligns the weapon half way',()=>{
  const p={};ads.reset(p);ads.request(p,1000,true);
  assert.equal(ads.update(p,1000),0);
  assert.equal(p.isScoped,false);
  assert(Math.abs(ads.update(p,1050)-.5)<.0001);
  assert.equal(p.isScoped,false);
  assert(ads.update(p,1099)<1);
  assert.equal(p.isScoped,false);
  assert.equal(ads.update(p,1100),1);
  assert.equal(p.isScoped,true);
});

test('ADS can be released mid-transition without sudden scope or getting stuck',()=>{
  const p={};ads.reset(p);ads.request(p,0,true);
  ads.update(p,40);const before=p.adsProgress;
  ads.request(p,40,false);
  assert.equal(p.adsProgress,before);
  assert.equal(p.isScoped,false);
  ads.update(p,90);
  assert(p.adsProgress>0&&p.adsProgress<before);
  ads.update(p,140);
  assert.equal(p.adsProgress,0);
  assert.equal(p.isScoped,false);
  ads.reset(p);
  assert.equal(p.adsProgress,0);
});

test('Scope visual is sniper-only; general guns keep a central iron sight (not black scope)',()=>{
  assert(ads.isSniper({id:'operator'}));
  assert(ads.isSniper({id:'marshal'}));
  assert(ads.isSniper({id:'outlaw'}));
  for(const id of ['vandal','phantom','guardian','spectre'])assert(!ads.isSniper({id}));
  assert(html.includes("document.getElementById('scope-overlay').classList.toggle('hidden',!sniper||!ready)"));
  assert(html.includes('id="ads-iron-overlay"'));
  assert(html.includes('iron.style.opacity=String(Math.min(1,amount*amount))'));
  assert(html.includes('updateADSFrame(now);'));
  assert(html.includes('if(!GameADS.isEligible(gun))return;'));
});

test('Perspective warped paper moves muzzle to center during ADS, without changing aim ray',()=>{
  for(const id of ['stinger','spectre','vandal','phantom','guardian','bulldog','marshal','outlaw','operator']){
    for(const [w,h] of [[1440,900],[390,844],[1280,720]]){
      const initial=v.paperProjection(id,w,h,{adsProgress:0});
      const halfway=v.paperProjection(id,w,h,{adsProgress:.5});
      const centered=v.paperProjection(id,w,h,{adsProgress:1});
      assert(centered.matrix.startsWith('matrix3d('),id);
      assert(Math.abs(centered.muzzle.x-w*.5)<.001,id+' muzzle not centered');
      assert(Math.abs(centered.muzzle.y-h*.545)<.001,id+' sight height not centered');
      assert(Math.abs(halfway.muzzle.x-(initial.muzzle.x+centered.muzzle.x)*.5)<.05,id+' halfway position invalid');
      assert(initial.muzzle.x!==centered.muzzle.x || initial.muzzle.y!==centered.muzzle.y,id);
    }
  }
});

test('ADS magnifies scoped and non-scoped guns without instant jumping',()=>{
  const w={id:'vandal'};
  const fov=ads.fov(w);
  assert(fov<75&&fov>50);
  assert(ads.fov({id:'operator'})<30);
  const p={};ads.reset(p);ads.request(p,0,true);
  assert.equal(75+(fov-75)*ads.update(p,0),75);
  assert.equal(75+(fov-75)*ads.update(p,100),fov);
  assert(html.includes('camera.fov=fov;camera.updateProjectionMatrix()'));
});

test('GitHub Pages deploy copies ADS controller dependency',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/pages.yml'),'utf8');
  assert(workflow.includes('ads-system.js'));
  assert(html.includes('<script src="ads-system.js?v=20261124-ads100"></script>'));
});