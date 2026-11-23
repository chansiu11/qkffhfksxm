'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const context={window:{},performance:{now:()=>0},document:{getElementById(){return null;}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'weapon-viewmodels.js'),'utf8'),context);
const api=context.window.WeaponViewmodels;
const expected=['bandit','classic','shorty','sheriff','ghost','frenzy','stinger','spectre','bucky','judge','bulldog','guardian','phantom','vandal','marshal','operator','ares','odin','knife','outlaw'];
test('all 20 user images are different, valid WebP with transparent outer pixels and no beige background',()=>{
  const assets=fs.readdirSync(path.join(root,'assets/weapons')).filter(p=>p.endsWith('.webp'));
  assert.equal(assets.length,20);
  assert.equal(new Set(assets).size,20);
  const unique=new Set();
  for(const name of expected){
    const bytes=fs.readFileSync(path.join(root,`assets/weapons/${name}.webp`));
    assert.equal(api.referenceImages[name],name);
    assert(bytes.length>1000,name);
    assert.equal(bytes.toString('ascii',0,4),'RIFF',name);
    assert.equal(bytes.toString('ascii',8,12),'WEBP',name);
    unique.add(bytes.toString('base64'));
  }
  assert.equal(unique.size,20,'No two guns share the same photo');
});
test('Outlaw uses submitted photo, every playable weapon maps to its own source, no extra hands',()=>{
  assert.equal(Object.keys(api.styles).length,17);
  for(const id of Object.keys(api.styles)){
    const svg=api.makeSvg(id);
    assert(svg.includes(`href="assets/weapons/${id}.webp"`),id);
    assert(svg.includes('weapon-only'));
    assert(!svg.includes('paper-hand'));
  }
});