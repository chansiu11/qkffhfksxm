'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const MeleeRules=require('../melee-rules.js');
const origin={x:0,y:1.65,z:4};
const enemy={id:'target',alive:true,x:0,z:2,footY:0,yaw:Math.PI};

test('game melee uses separate light/heavy modes; ordinary hits have non-headshot damage',()=>{
  const light=MeleeRules.selectTarget(origin,0,0,'light',[enemy]);
  const heavy=MeleeRules.selectTarget(origin,0,0,'heavy',[enemy]);
  assert(light && heavy);
  assert.equal(light.damage,50);assert.equal(heavy.damage,75);
  assert.equal(light.behind,false);assert.equal(heavy.behind,false);
  assert(MeleeRules.MODES.light.range>MeleeRules.MODES.heavy.range);
  assert(MeleeRules.MODES.light.halfAngle>MeleeRules.MODES.heavy.halfAngle);
});
test('attack in front of the facing enemy stays normal; game rear bonus is 2x',()=>{
  const front={...enemy,yaw:Math.PI};
  const behind={...enemy,yaw:0};
  assert.equal(MeleeRules.selectTarget(origin,0,0,'heavy',[front]).damage,75);
  assert.equal(MeleeRules.selectTarget(origin,0,0,'heavy',[behind]).damage,150);
});
test('hits outside the melee reach, outside view arc, or through opaque barrier are ignored',()=>{
  assert.equal(MeleeRules.selectTarget(origin,0,0,'light',[{...enemy,z:-1}]),null);
  assert.equal(MeleeRules.selectTarget(origin,0,0,'light',[{...enemy,x:2.7}]),null);
  assert.equal(MeleeRules.selectTarget(origin,0,0,'light',[enemy],()=>false),null);
});
test('closer to center of view is chosen first, one target only',()=>{
  const offCenter={...enemy,id:'off',x:.7,z:2.2};
  const center={...enemy,id:'center'};
  const r=MeleeRules.selectTarget(origin,0,0,'light',[offCenter,center]);
  assert.equal(r.target.id,'center');
});