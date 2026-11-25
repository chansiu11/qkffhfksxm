'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Spread=require('../shooting-spread.js');
const Pellets=require('../shotgun-pellets.js');
const catalog=require('../server/weapons.json');
const base=(weapon,extra={})=>({yaw:0,pitch:0,speed:0,airborne:false,crouched:false,ads:false,shotIndex:0,seed:123457,scatter:.4,...extra});

test('all 20 game firearms use individual movement and spray profiles; knife is not fired',()=>{
  const ids=Object.keys(catalog).filter(id=>id!=='knife');
  assert.equal(ids.length,20);
  for(const id of ids){
    const w=catalog[id];
    const p=Spread.weaponProfile(w);
    assert(p.move>.3 && p.recovery>=300);
    const still=Spread.sample(w,base(w));
    const running=Spread.sample(w,base(w,{speed:7.6}));
    assert(running.cone>still.cone*1.5,`${id} run should be visibly less accurate`);
    const spray=Spread.sample(w,base(w,{shotIndex:10}));
    assert(spray.cone>still.cone,`${id} sustained fire must add error`);
    assert(spray.recoil>0);
  }
  const spreads=ids.map(id=>Spread.sample(catalog[id],base(catalog[id],{speed:7.6,shotIndex:9})).cone.toFixed(5));
  assert(new Set(spreads).size>11,'handling should not be identical across weapons');
});

test('stationary taps recover; movement levels, air jumps and ADS affect virtual accuracy',()=>{
  const w=catalog.vandal,state={};
  assert.equal(Spread.burstIndex(state,w,1000),0);
  Spread.confirmShot(state,w,1000,0);
  assert.equal(Spread.burstIndex(state,w,1099),1);
  Spread.confirmShot(state,w,1099,1);
  assert.equal(Spread.burstIndex(state,w,1200),2);
  assert.equal(Spread.burstIndex(state,w,1650),0,'long pause resets virtual recoil');
  const still=Spread.sample(w,base(w));
  const walk=Spread.sample(w,base(w,{speed:4.3}));
  const run=Spread.sample(w,base(w,{speed:7.6}));
  const jump=Spread.sample(w,base(w,{speed:7.6,airborne:true}));
  const crouch=Spread.sample(w,base(w,{speed:7.6,crouched:true}));
  const ads=Spread.sample(w,base(w,{speed:7.6,ads:true}));
  assert(still.cone<walk.cone && walk.cone<run.cone);
  assert(jump.cone>run.cone);
  assert(crouch.cone<run.cone);
  assert(ads.cone<run.cone);
  assert.equal(Spread.crosshairError(w,{vel:{x:0,z:0},onGround:true},1700),0);
  assert(Spread.crosshairError(w,{vel:{x:7.6,z:0},onGround:true},1700)>5);
});

test('same seed, moving speed, and burst reconstruct identical virtual impact rays',()=>{
  for(const id of ['classic','spectre','phantom','vandal','operator','shorty','judge']) {
    const w=catalog[id];
    const opts=base(w,{yaw:.35,pitch:-.11,speed:6.1,airborne:false,shotIndex:6,seed:2719184422});
    const a=Spread.directions(w,opts,Pellets);
    const b=Spread.directions(w,opts,Pellets);
    assert.deepEqual(a,b,`seed-based shot differs for ${id}`);
    assert.equal(a.vectors.length,w.pellets||1);
    for(const ray of a.vectors){assert(Math.abs(Math.hypot(...ray)-1)<1e-6);assert(ray.every(Number.isFinite));}
    assert(Math.abs(a.shot.yaw-opts.yaw)>0.001 || Math.abs(a.shot.pitch-opts.pitch)>0.001,'burst bends away from crosshair');
  }
});

test('sustained rifle shots tilt upwards and wander to sides instead of endless perfect center hits',()=>{
  const w=catalog.vandal;
  const first=Spread.sample(w,base(w,{seed:1}));
  const twelfth=Spread.sample(w,base(w,{seed:1,shotIndex:11}));
  assert(twelfth.recoil>0.012);
  assert(twelfth.pitch>first.pitch);
  assert(twelfth.cone>first.cone*5);
  const moved=Spread.sample(w,base(w,{seed:1,speed:7.6}));
  assert(moved.cone>first.cone*20);
});

test('integration wiring and static hosting include the shared shot spread source',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const online=fs.readFileSync(path.join(root,'multiplayer-client.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server/server.js'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/pages.yml'),'utf8');
  assert(html.includes('src="shooting-spread.js'));
  assert(html.includes('ShootingSpread.directions(w'));
  assert(html.includes('spreadResult?.vectors'));
  assert(online.includes('a.drawLocalShot(w,pelletRotation,spreadResult)'));
  assert(online.includes('burst,seed,speed:'));
  assert(server.includes('const ShootingSpread = require'));
  const room = fs.readFileSync(path.join(root,'server/room-core.js'),'utf8');
  assert(room.includes('ShootingSpread.directions(w'));
  assert(workflow.includes('shooting-spread.js'));
});