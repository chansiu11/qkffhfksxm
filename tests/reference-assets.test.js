'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'weapon-viewmodels.js'),'utf8');
const context={window:{},performance:{now:()=>0},document:{getElementById(){return null;}}};
vm.runInNewContext(source,context);
const api=context.window.WeaponViewmodels;

test('each weapon in user reference sheet has its OWN valid, unique WebP image',()=>{
  const expected=['classic','shorty','frenzy','ghost','sheriff','stinger','spectre','bucky','judge',
    'bulldog','guardian','phantom','vandal','marshal','operator','ares','odin','knife'];
  const files=new Set(fs.readdirSync(path.join(root,'assets/weapons')).filter(n=>n.endsWith('.webp')));
  assert.equal(files.size,18);
  const binarySet=new Set();
  for(const id of expected){
    assert.equal(api.referenceImages[id],id);
    const file=`${id}.webp`;
    assert(files.has(file),`Missing ${file}`);
    const bytes=fs.readFileSync(path.join(root,'assets/weapons',file));
    assert(bytes.length>1500,`Broken image ${file}`);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    binarySet.add(bytes.toString('base64'));
  }
  assert.equal(binarySet.size,18,'No image may be reused as another weapon');
});

test('existing weapon slots use exact image, and the absent Outlaw keeps its original art',()=>{
  assert.equal(Object.keys(api.styles).length,17);
  for(const id of Object.keys(api.styles)){
    const svg=api.makeSvg(id);
    assert(svg.includes(`data-weapon-id="${id}"`));
    if(id==='outlaw'){
      assert(!svg.includes('data-ref-image='));
      continue;
    }
    assert(svg.includes(`href="assets/weapons/${id}.webp"`),id);
    assert(svg.includes('paper-cutout-depth'),id);
  }
});

test('perspective makes image muzzle face forward while mobile scales without clipping',()=>{
  assert.match(source,/rotateY\(\$\{planeYaw\}deg\)/);
  assert.match(source,/planeYaw=\(-51/);
  assert.match(source,/screenWidth<=600\?\.94:1/);
  assert.match(source,/forwardShift/);
  assert.match(source,/window\.innerWidth/);
});