'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
let clock=0;
const layer={content:'',style:{},classes:new Set(),classList:{toggle(name,on){if(on)layer.classes.add(name);else layer.classes.delete(name)}},set innerHTML(html){this.content=html;},get innerHTML(){return this.content;},querySelector(selector){if(selector==='svg'&&this.content.includes('<svg'))return {style:{}};return null;}};
const ctx={window:{innerWidth:1440},performance:{now:()=>clock},document:{getElementById:id=>id==='fps-weapon-sprite-layer'?layer:null}};
vm.runInNewContext(fs.readFileSync(path.join(root,'weapon-viewmodels.js'),'utf8'),ctx);
const API=ctx.window.WeaponViewmodels;
class Group{constructor(){this.children=[]}}
test('17 active guns and knife use only user photos, NO hand, glove or vector gun overlays',()=>{
  assert.equal(Object.keys(API.styles).length,17);
  const images=new Set();
  for(const id of Object.keys(API.styles)){
    const svg=API.makeSvg(id);images.add(svg);
    assert(svg.includes(`<title>${API.styles[id].mark}`),id);
    assert(svg.includes(`data-weapon-id="${id}"`),id);
    assert(svg.includes(`href="assets/weapons/${id}.webp"`),id);
    assert(svg.includes('class="weapon-texture"'),id);
    assert(!/paper-hand|paper-gun-hand|<path|<polygon|<rect|holdingHands|glove|sleeve|art-blade|art-mag/.test(svg),id);
  }
  assert.equal(images.size,17);
  const js=fs.readFileSync(path.join(root,'weapon-viewmodels.js'),'utf8');
  assert(!/holdingHands|gunParts|cutoutDepth|metallicFacets/.test(js));
});
test('first-person sprite moves with weapon swap, firing, reload, scope and motion without 3D mesh',()=>{
  const vm=API.create({Group});
  assert.equal(vm.group.children.length,0);
  for(const id of Object.keys(API.styles)){
    vm.setWeapon(id);assert.equal(vm.current,id);
    clock+=330;
    vm.update(.016,{alive:true,vel:{x:3,z:0},isScoped:false},{inMatch:true});
    assert(layer.classes.has('weapon-visible'));
    assert(layer.content.includes(`href="assets/weapons/${id}.webp"`));
    if(id!=='knife'){
      vm.beginReload();assert(vm.isReloading);
      clock+=220;vm.update(.016,{alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:true});
      vm.stopReload();assert(!vm.isReloading);
    }
    vm.fire(id==='knife'?'heavy':'light');clock+=50;
    vm.update(.016,{alive:true,vel:{x:0,z:0},isScoped:true},{inMatch:true});
  }
  vm.update(.016,{alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:false});
  assert(!layer.classes.has('weapon-visible'));
});
test('crosshair controls and hit flash remain wired into multiplayer and standalone',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const multiplayer=fs.readFileSync(path.join(root,'multiplayer-client.js'),'utf8');
  assert.match(html,/e\.code === 'KeyX'/);
  assert.match(html,/window\.toggleScope\(\)/);
  assert.match(html,/function flashDamage\(/);
  assert.match(multiplayer,/a\.flashDamage\(\)/);
});
test('tilted gun projects toward player center with a barrel-to-stock perspective and no arms',()=>{
  const src=fs.readFileSync(path.join(root,'weapon-viewmodels.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(src,/perspective\(930px\)/);
  assert.match(src,/rotateY\(/);
  assert.match(src,/rotateX\(/);
  assert.match(src,/rotateZ\(/);
  assert.match(src,/screenWidth<=820/);
  assert.match(css,/transform-style: preserve-3d;/);
  assert(!src.includes('paper-hand'));
});