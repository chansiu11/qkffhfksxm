'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
class G {constructor(){this.children=[];this.position={set(){}};this.rotation={};} add(x){this.children.push(x);}}
const T={Group:G};
let clock=0;
const layer={content:'',classList:{toggle(){}},set innerHTML(html){this.content=html;},get innerHTML(){return this.content;},querySelector(s){const elementId=s==="svg"?"<svg":`id="${s.slice(1)}"`;if(!this.content.includes(elementId))return null;return {style:{},setAttribute(){},removeAttribute(){}};}};
const context={window:{},performance:{now:()=>clock},document:{getElementById:id=>id==='fps-weapon-sprite-layer'?layer:null}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','weapon-viewmodels.js'),'utf8'),context);
const api=context.window.WeaponViewmodels;

test('17 distinct original 2D weapon images, no 3D weapon meshes',()=>{
  assert.equal(Object.keys(api.styles).length,17);
  const images=Object.keys(api.styles).map(id=>api.makeSvg(id));
  assert.equal(new Set(images).size,17,'each gun must have a recognizably unique graphic');
  for(const [i,id] of Object.keys(api.styles).entries()) {
    assert(images[i].startsWith('<svg'),id);
    assert(images[i].includes('<title>'),id);
    assert(images[i].includes(api.styles[id].mark),`missing weapon identifier: ${id}`);
    assert(!images[i].includes('<script'),`script within image ${id}`);
  }
  const knife=api.makeSvg('knife');
  assert(knife.includes('id="art-blade"'));
  assert(!knife.includes('id="art-mag"'));
  const view=api.create(T,{});
  for(const id of Object.keys(api.styles)) {
    view.setWeapon(id);
    assert.equal(view.current,id);
    assert.equal(view.group.children.length,0,'first-person 3D viewmodel must be removed');
    assert(layer.innerHTML.includes(api.styles[id].mark));
    view.beginReload(); clock+=380;
    view.fire();clock+=65;
    view.update(1/60,{alive:true,vel:{x:3,z:0},isScoped:false},{inMatch:true});
    view.stopReload();
    view.update(1/60,{alive:true,vel:{x:0,z:0},isScoped:false},{inMatch:true});
  }
});

test('crosshair zoom key, shared online and offline hit flash wiring',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const multiplayer=fs.readFileSync(path.join(__dirname,'..','multiplayer-client.js'),'utf8');
  assert.match(html,/e\.code === 'KeyX'/);
  assert.match(html,/window\.toggleScope\(\)/);
  assert.match(html,/function flashDamage\(/);
  assert.match(html,/classList\.add\('damage-on'\)/);
  assert.match(html,/\bflashDamage\(\);/);
  assert.match(multiplayer,/me\.hp < a\.player\.hp \|\| me\.armor < a\.player\.armor/);
  assert.match(multiplayer,/a\.flashDamage\(\)/);
});