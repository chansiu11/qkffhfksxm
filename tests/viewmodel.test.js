'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
class V3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;} }
class Group { constructor(){this.children=[];this.position=new V3();this.rotation=new V3();this.scale={setScalar:(n)=>{this.scaled=n;}};this.visible=true;this.userData={};} add(...objects){this.children.push(...objects);} }
class Mesh extends Group {constructor(geometry,material){super();this.type='Mesh';this.geometry=geometry;this.material=material;}}
function geom(n){return class{constructor(...a){this.shape=n;this.args=a;}};}
const T={Group,Mesh,BoxGeometry:geom('box'),CylinderGeometry:geom('cylinder'),SphereGeometry:geom('sphere'),TorusGeometry:geom('torus'),ExtrudeGeometry:geom('extrude'),PlaneGeometry:geom('plane'),
  MeshStandardMaterial:class{constructor(x){Object.assign(this,x)}}, MeshBasicMaterial:class{constructor(x){Object.assign(this,x)}}, CanvasTexture:class{constructor(cv){this.cv=cv}},DoubleSide:2,
  Shape:class{moveTo(){}lineTo(){}quadraticCurveTo(){}closePath(){}}};
const sandbox={window:{},document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})},performance:{now:()=>clock},Math};
let clock=0;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../weapon-viewmodels.js'),'utf8'),sandbox);
test('Every weapon has an independent 3D model and the knife has no gun receiver',()=>{
  const o=sandbox.window.WeaponViewmodels.create(T,{});
  const styles=o.styles;
  assert.equal(Object.keys(styles).length,17);
  const models=[];
  for(const id of Object.keys(styles)){
    o.setWeapon(id);
    const obj=o.group.children.find(x=>x.visible && x!==o.flash);
    assert(obj,`missing visible model for ${id}`);
    assert(obj.children.length>=11,`not enough 3D parts on ${id}: ${obj.children.length}`);
    models.push(obj);
    assert.equal(o.flash.visible,id!=='knife',`muzzle flash must be off for knife ${id}`);
    if(id==='knife')assert(obj.children.every(x=>x.geometry?.shape!=='cylinder'), 'knife cannot reuse gun barrel cylinders');
  }
  assert.equal(new Set(models).size,17,'weapon models must be independent');
  for(const id of Object.keys(styles)){
    o.setWeapon(id);
    o.beginReload();
    o.fire();
    clock+=550;
    o.update(.016,{reloading:true,vel:{x:0,z:0},isScoped:false});
    o.update(.016,{reloading:false,vel:{x:0,z:0},isScoped:false});
    assert(Number.isFinite(o.group.rotation.x));
  }
});