'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {recordPosition,samplePosition,rayCharacter,MAX_REWIND_MS}=require('../server/hit-registry.js');

test('head hitbox matches visible rectangular 3D head, including its corners',()=>{
  const target={x:.21,z:42,footY:0,yaw:0};
  // Camera y=1.65, corner of visible head box (radius of old spherical box missed).
  const hit=rayCharacter(0,1.65,40,0,0,1,target,Date.now());
  assert(hit && hit.headshot, 'a visible corner of the head should register as a headshot');
  assert(hit.distance>1.7 && hit.distance<2.0);
});

test('body hitbox spans actual chest mesh, rather than a small central sphere',()=>{
  const target={x:0,z:42,footY:0,yaw:0};
  const down=-Math.atan2(.95,2);
  const cp=Math.cos(down),dy=Math.sin(down);
  const hit=rayCharacter(0,1.65,40,0,dy,cp,target,Date.now());
  assert(hit && !hit.headshot, 'lower torso shot should register as body');
});

test('visual snapshot time rewinds only target history within the retention window',()=>{
  const old=Date.now()-155;
  const target={x:0,z:42,footY:0,yaw:0};
  recordPosition(target,old);
  target.x=2;
  recordPosition(target,old+130);
  const rendered=samplePosition(target,old);
  assert.equal(rendered.x,0);
  const oldHit=rayCharacter(0,1.65,40,0,0,1,target,old);
  const newHit=rayCharacter(0,1.65,40,0,0,1,target,old+130);
  assert(oldHit && oldHit.headshot);
  assert.equal(newHit,null,'a distant current position must not falsely hit');
  assert(MAX_REWIND_MS<=350,'server lag compensation must be bounded');
});

test('headshot hitbox rotates with displayed enemy orientation',()=>{
  const target={x:0,z:42,footY:0,yaw:Math.PI/2};
  const hit=rayCharacter(0,1.5,40,0,0,1,target,Date.now());
  assert(hit?.headshot);
});