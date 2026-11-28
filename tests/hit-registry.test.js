'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {recordPosition,samplePosition,rayCharacter,MAX_REWIND_MS}=require('../server/hit-registry.js');

test('head hitbox follows the narrow robot visor',()=>{
  const target={x:.06,z:42,footY:0,yaw:0};
  const hit=rayCharacter(0,1.65,40,0,0,1,target,Date.now());
  assert(hit && hit.headshot, 'a visible corner of the head should register as a headshot');
  assert(hit.distance>1.8 && hit.distance<2.0);
});

test('body hitbox spans actual chest mesh, rather than a small central sphere',()=>{
  const target={x:0,z:42,footY:0,yaw:0};
  const down=-Math.atan2(.60,2);
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
test('empty space between the legs does not count as a hit',()=>{
  const target={x:0,z:2,footY:0,yaw:0};
  assert.equal(rayCharacter(0,.35,0,0,0,1,target,0),null);
  const leg=rayCharacter(.16,.35,0,0,0,1,target,0);
  assert.equal(leg.legshot,true);
});

test('crouched targets use lowered hit zones in rewound snapshots',()=>{
  const target={x:0,z:2,y:1.65,footY:0,yaw:0};
  recordPosition(target,100);
  target.y=1.2;
  recordPosition(target,200);
  assert.equal(rayCharacter(0,1.6,0,0,0,1,target,100).headshot,true);
  assert.equal(rayCharacter(0,1.6,0,0,0,1,target,200),null);
  assert.equal(rayCharacter(0,1.19,0,0,0,1,target,200).headshot,true);
});

test('leg hits use the weapon and distance specific damage table',()=>{
  const {applyGunDamage}=require('../shooting-spread.js');
  for(const [id,distance,body,leg] of [
    ['vandal',10,40,34],
    ['operator',25,150,120],
    ['guardian',25,65,48.75],
    ['phantom',19,39,33.15],
    ['phantom',20,35,29.75],
    ['judge',16,7,5.95],
    ['classic',30,22,18.7]
  ]){
    for(const armor of [0,25,50]){
      const total=zone=>{
        const target={hp:1000,armor};
        applyGunDamage(target,id,distance,zone);
        return 1000-target.hp+armor-target.armor;
      };
      assert.ok(Math.abs(total('leg')-leg)<.0002,`${id} leg at ${distance}m`);
      assert.ok(Math.abs(total('body')-body)<.0002,`${id} body at ${distance}m`);
    }
  }
});
