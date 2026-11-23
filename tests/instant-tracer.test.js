'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function tracerHarness() {
  const body=html.match(/const TRACER_LIFETIME = ([\s\S]*?)\n      \/\/ Must match Three\.js camera/);
  assert(body, 'instant tracer implementation is missing');
  const update=html.match(/for \(let i = activeTracers\.length - 1; i >= 0; i--\) \{([\s\S]*?)\n        \}\n\n        \/\/ Animate floating/);
  assert(update, 'tracer lifetime cleanup implementation is missing');
  class Vector3 {
    constructor(x=0,y=0,z=0) {this.x=x;this.y=y;this.z=z;}
    clone(){return new Vector3(this.x,this.y,this.z);}
    distanceTo(other){return Math.hypot(this.x-other.x,this.y-other.y,this.z-other.z);}
  }
  class BufferGeometry {
    setFromPoints(points){this.points=points;return this;}
    dispose(){this.disposed=true;}
  }
  class LineBasicMaterial {
    constructor(args){Object.assign(this,args);}
    dispose(){this.disposed=true;}
  }
  class Line {constructor(geometry,material){this.geometry=geometry;this.material=material;}}
  const added=[];const removed=[];
  const scene={add:x=>added.push(x),remove:x=>removed.push(x)};
  const THREE={BufferGeometry,LineBasicMaterial,Line,AdditiveBlending:1,Vector3};
  const script=`const activeTracers=[];${'const TRACER_LIFETIME = '+body[1]}\n function tick(dt){${'for (let i = activeTracers.length - 1; i >= 0; i--) {'+update[1]+'\n        }'}};\n ({spawnBulletTracer,tick,activeTracers})`;
  const api=vm.runInNewContext(script,{THREE,scene,Number,Math});
  return {api,THREE,added,removed};
}

test('A fired tracer is a straight line visible from origin to impact immediately',()=>{
  const {api,THREE,added}=tracerHarness();
  const start=new THREE.Vector3(1,2,3), end=new THREE.Vector3(7,8,9);
  api.spawnBulletTracer(start,end,0x123456);
  assert.equal(added.length,1);
  assert(added[0] instanceof THREE.Line, 'tracer must be a line, not mesh/sphere');
  assert.equal(added[0].geometry.points[0].x,1);
  assert.equal(added[0].geometry.points[1].x,7);
  assert.equal(added[0].material.color,0x123456);
  assert.equal(api.activeTracers.length,1);
  assert.equal('progress' in api.activeTracers[0],false,'tracer must not travel');
});

test('Line disappears after a short fade without changing start/end points',()=>{
  const {api,THREE,added,removed}=tracerHarness();
  api.spawnBulletTracer(new THREE.Vector3(),new THREE.Vector3(0,0,-220),0xff1234);
  const before=added[0].geometry.points;
  api.tick(0.06);
  assert(added[0].material.opacity>0 && added[0].material.opacity<0.95);
  assert.strictEqual(added[0].geometry.points,before);
  api.tick(0.075);
  assert.equal(api.activeTracers.length,0);
  assert.strictEqual(removed[0],added[0]);
  assert(added[0].geometry.disposed);
  assert(added[0].material.disposed);
});

test('There are no traveling spheres or cylinders in the shared tracer implementation',()=>{
  const block=html.slice(html.indexOf('const TRACER_LIFETIME'),html.indexOf('// Must match Three.js camera'));
  assert(block.includes('new THREE.Line('));
  assert(!block.includes('new THREE.SphereGeometry('));
  assert(!block.includes('new THREE.CylinderGeometry('));
  assert(!block.includes('new THREE.Mesh('));
  const online=fs.readFileSync(path.join(root,'multiplayer-client.js'),'utf8');
  assert(online.includes('a.spawnBulletTracer(start, end'));
  assert(html.includes('spawnBulletTracer(player.pos.clone().addScaledVector(bulletDirection'));
});