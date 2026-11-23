'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
let clock=0;
const photo={style:{}},flash={style:{}};
const layer={content:'',classes:new Set(),classList:{toggle(n,v){if(v)layer.classes.add(n);else layer.classes.delete(n)}},
  set innerHTML(s){this.content=s;},get innerHTML(){return this.content;},
  querySelector(selector){return selector==='.fps-paper-weapon'?photo:selector==='.weapon-shot-flash'?flash:null;}};
const ctx={window:{innerWidth:1440,innerHeight:900},performance:{now:()=>clock},
  document:{getElementById:id=>id==='fps-weapon-sprite-layer'?layer:null}};
vm.runInNewContext(fs.readFileSync(path.join(root,'weapon-viewmodels.js'),'utf8'),ctx);
const api=ctx.window.WeaponViewmodels;
class Group{constructor(){this.children=[]}}
class Vector3{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
const T={Group,Vector3};
const alive={alive:true,vel:{x:0,z:0},isScoped:false};
const running={inMatch:true};

test('all 17 equipped guns/knife use their own photo without any 3D meshes, hands or arms',()=>{
  const view=api.create(T);
  assert.equal(view.group.children.length,0);
  assert.equal(Object.keys(api.styles).length,17);
  for(const id of Object.keys(api.styles)){
    view.setWeapon(id);
    assert.equal(view.current,id);
    assert.match(layer.content,new RegExp(`assets/weapons/${id}\\.webp`));
    assert(layer.content.includes('<img class="fps-paper-weapon"'));
    assert(!/glove|paper-hand|sleeve|<svg|<path|holdingHands/i.test(layer.content));
    clock+=350;view.update(.016,alive,running);
    assert.match(photo.style.transform,/^matrix3d\(/);
    assert(layer.classes.has('weapon-visible'));
    if(id!=='knife'){
      view.beginReload();assert(view.isReloading);
      clock+=400;view.update(.016,alive,running);
      view.stopReload();assert(!view.isReloading);
    }
    view.fire(id==='knife'?'heavy':'light');clock+=20;view.update(.016,alive,running);
  }
  view.update(.016,alive,{inMatch:false});
  assert(!layer.classes.has('weapon-visible'));
});

test('first-person paper is PROJECTED as near-large/far-small rectangle, not rotated as a flat poster',()=>{
  const w=1440,h=900;
  const p=api.paperProjection('vandal',w,h);
  assert.match(p.matrix,/^matrix3d\(/);
  assert(p.corners[1].x>p.corners[0].x);
  const farHeight=Math.hypot(p.corners[3].x-p.corners[0].x,p.corners[3].y-p.corners[0].y);
  const nearHeight=Math.hypot(p.corners[2].x-p.corners[1].x,p.corners[2].y-p.corners[1].y);
  assert(nearHeight>farHeight*2.7,`rear paper edge should be visibly larger (far=${farHeight},near=${nearHeight})`);
  assert(p.frontDepth>p.rearDepth*3);
  assert(Math.abs((p.rear.x-p.muzzle.x) - w*(1.105-.527)*.5) < .01);
  assert(p.muzzle.y>h*.5 && p.muzzle.y<h*.73);
  assert.equal(api.muzzleEdgeY.vandal,.226);
});

test('paper projection retains real muzzle endpoint while weapon shifts with firing/reloading',()=>{
  const view=api.create(T);view.setWeapon('vandal');clock+=400;
  view.update(.016,alive,running);
  const resting=view.getMuzzleScreenPosition();
  assert(resting && resting.depth===2.9);
  const still=photo.style.transform;
  view.fire();clock+=30;view.update(.016,alive,running);
  assert.notEqual(photo.style.transform,still);
  const firing=view.getMuzzleScreenPosition();
  assert(Math.hypot(firing.x-resting.x,firing.y-resting.y)>3);
  assert(parseFloat(flash.style.opacity)>0,'flash must begin at projected muzzle');
  assert(Math.abs(parseFloat(flash.style.left)-firing.x)<1);
  assert(Math.abs(parseFloat(flash.style.top)-firing.y)<1);
  clock+=200;view.update(.016,alive,running);
  assert.equal(flash.style.opacity,'0');
  view.beginReload();clock+=300;view.update(.016,alive,running);
  assert(view.getMuzzleScreenPosition().y>resting.y+40);
  view.stopReload();assert(!view.isReloading);
});

test('muzzle world position is the actual paper edge transformed by camera, while hit ray is unchanged',()=>{
  const view=api.create(T);view.setWeapon('vandal');clock+=400;view.update(.016,alive,running);
  const tip=view.getMuzzleScreenPosition();
  const camera={fov:75,updateMatrixWorld(){},localToWorld(v){v.x+=3;v.y+=1;v.z+=12;return v;}};
  const point=view.getMuzzleWorldPosition(camera);
  const focal=900/(2*Math.tan(75*Math.PI/360));
  assert(Math.abs(point.x-(3+(tip.x-720)*tip.depth/focal))<.001);
  assert(Math.abs(point.y-(1+(450-tip.y)*tip.depth/focal))<.001);
  assert.equal(point.z,12-tip.depth);
});

test('responsive mobile paper endpoint stays below center and rear exits right/lower screen',()=>{
  for(const id of Object.keys(api.styles))for(const [w,h] of [[1440,900],[390,844],[1280,720]]){
    const p=api.paperProjection(id,w,h), cfg=api.viewEndpoints(id,w,h);
    assert(Math.abs(p.muzzle.x-cfg.front.x)<.01,id);
    assert(Math.abs(p.muzzle.y-cfg.front.y)<.01,id);
    assert(p.muzzle.y>h*.55 && p.muzzle.y<h*.8,id);
    assert(cfg.edge.x>w,id);
    assert(p.corners.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)),id);
  }
});

test('crosshair shooting, damage, reload and online hooks still wired',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const online=fs.readFileSync(path.join(root,'multiplayer-client.js'),'utf8');
  assert.match(html,/e\.code === 'KeyX'/);
  assert.match(html,/viewmodel\.getMuzzleWorldPosition\(camera\)/);
  assert.match(html,/spawnBulletTracer\(localTracerVisualStart\(player\.pos, bulletDirection\), endPt\)/);
  assert.match(html,/function flashDamage\(/);
  assert.match(online,/a\.viewmodel\.fire\(/);
});