'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crosshair=require('../crosshair-profile.js');
const pellets=require('../shotgun-pellets.js');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('VALORANT profile share codes retain primary, custom color, outlines, dot, inner and outer lines',()=>{
  const parsed=crosshair.parse('0;s;1;P;c;8;u;7FFF00FF;o;0.8;t;2;d;1;z;3;0t;2;0l;4;0o;3;0a;0.7;0m;1;0f;1;1b;0;A;c;7;o;1;0l;6;S;c;5');
  assert.equal(parsed.code.startsWith('0;s;1;P'),true);
  assert.equal(parsed.primary.color,'#7FFF00');
  assert.equal(parsed.primary.inner.length,4);
  assert.equal(parsed.primary.inner.offset,3);
  assert.equal(parsed.primary.inner.alpha,0.7);
  assert.equal(parsed.primary.inner.moveError,true);
  assert.equal(parsed.primary.inner.fireError,true);
  assert.equal(parsed.primary.outer.shown,false);
  assert.equal(parsed.primary.dot,true);
  assert.equal(parsed.primary.dotSize,3);
  assert.equal(parsed.ads.color,'#ff0000');
  assert.equal(parsed.usePrimaryForAds,true);
  assert.equal(crosshair.parse(crosshair.DEFAULT).primary.color,'#00ffff');
  assert.throws(()=>crosshair.parse('javascript:alert(1)'),/코드/);
  assert.throws(()=>crosshair.parse('0;A;c;5'),/P/);
});

test('Shotgun game visuals create multiple finite separate trails per trigger pull',()=>{
  for(const n of [8,10]) {
    const dirs=pellets.directions(Math.PI*.2,Math.PI*.1,n,.065,Math.PI*.9);
    assert.equal(dirs.length,n);
    for(const d of dirs){assert.equal(d.length,3);assert(d.every(Number.isFinite));assert(Math.abs(Math.hypot(...d)-1)<1e-8);}
    assert(dirs.slice(1).some(d=>Math.abs(d[0]-dirs[0][0])>.01),'pellets must visibly diverge');
    assert.deepEqual(dirs,pellets.directions(Math.PI*.2,Math.PI*.1,n,.065,Math.PI*.9));
  }
  assert.equal(pellets.directions(0,0,1,.05,0).length,1);
});

test('Crosshair import is available on menu and HUD without changing aim direction',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const id of ['crosshair-wrap','crosshair-settings','crosshair-form','crosshair-code','crosshair-preview'])
    assert(html.includes('id="'+id+'"'), 'missing '+id);
  assert(html.includes('src="crosshair-profile.js"'));
  assert(html.includes('src="crosshair-ui.js"'));
  assert(html.includes('window.openCrosshairSettings(event)'));
  assert(html.includes('ShotgunPellets.directions'));
  assert(html.includes('KeyC'));
});