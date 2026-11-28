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

test('a leg hit deals at most 70% of the body damage for every ranged weapon',()=>{
  const {applyGunDamage}=require('../shooting-spread.js');
  const catalog=require('../server/weapons.json');
  for(const id of Object.keys(catalog).filter(id=>id!=='knife')){
    for(const range of [0,7,15,20,30,50]){
      for(const armor of [0,25,50]){
        const hit=zone=>{
          const target={hp:1000,armor};
          applyGunDamage(target,id,range,zone);
          return 1000-target.hp+armor-target.armor;
        };
        assert(hit('leg')<=hit('body')*.70+.0002,`${id} at ${range}m with armor ${armor}`);
        assert(hit('leg')<hit('body'));
      }
    }
  }
});
