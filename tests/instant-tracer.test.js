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
  assert(body, 'instant yellow tracer implementation is missing');
  const update=html.match(/for \(let i = activeTracers\.length - 1; i >= 0; i--\) \{([\s\S]*?)\n        \}\n\n        renderer\.render/);
  assert(update, 'tracer lifetime cleanup implementation is missing');
  class Vector3 {
    constructor(x=0,y=0,z=0) {this.x=x;this.y=y;this.z=z;}
    clone(){return new Vector3(this.x,this.y,this.z);}
    distanceTo(other){return Math.hypot(this.x-other.x,this.y-other.y,this.z-other.z);}
    addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
    sub(other){this.x-=other.x;this.y-=other.y;this.z-=other.z;return this;}
    dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
    normalize(){const d=Math.hypot(this.x,this.y,this.z);if(d){this.x/=d;this.y/=d;this.z/=d;}return this;}
    applyQuaternion(){return this;}
  }
  class BufferGeometry {
    setFromPoints(points){this.points=points;return this;}
    dispose(){this.disposed=true;}
  }
  class LineBasicMaterial {
    constructor(args){Object.assign(this,args);}
    dispose(){this.disposed=true;}
  }
  class LineSegments {constructor(geometry,material){this.geometry=geometry;this.material=material;}}
  const added=[];const removed=[];
  const scene={add:x=>added.push(x),remove:x=>removed.push(x)};
  const THREE={BufferGeometry,LineBasicMaterial,LineSegments,AdditiveBlending:1,Vector3};
  const camera={fov:75,near:0.1,quaternion:{},
    getWorldPosition:v=>v,
    getWorldDirection:v=>{v.z=-1;return v;}
  };
  const renderer={domElement:{clientHeight:720}};
  const script=`const activeTracers=[];${'const TRACER_LIFETIME = '+body[1]}\n function tick(dt){${'for (let i = activeTracers.length - 1; i >= 0; i--) {'+update[1]+'\n        }'}};\n ({spawnBulletTracer,localTracerVisualStart,tick,activeTracers})`;
  const viewmodel={getMuzzleWorldPosition:()=>null};
  const api=vm.runInNewContext(script,{THREE,scene,camera,renderer,viewmodel,window:{innerHeight:720},Number,Math});
  return {api,THREE,added,removed,viewmodel};
}

test('tracer becomes a bright yellow group of five thin parallel lines, never a sphere',()=>{
  const {api,THREE,added}=tracerHarness();
  const start=new THREE.Vector3(0,0,-0.5), end=new THREE.Vector3(0,0,-100);
  api.spawnBulletTracer(start,end,0xff4655);
  assert.equal(added.length,1);
  assert(added[0] instanceof THREE.LineSegments);
  const points=added[0].geometry.points;
  assert.equal(points.length,10,'5 parallel pairs widen the visual tracer');
  assert.equal(points[4].x,start.x);
  assert.equal(points[5].z,end.z);
  assert(points[0].x<points[2].x && points[8].x>points[4].x);
  assert.equal(added[0].material.color,0xffe331,'all weapons use bright yellow tracers');
  assert.equal(api.activeTracers.length,1);
  assert.equal('progress' in api.activeTracers[0],false,'no travel animation');
});

test('local first-person tracer begins exactly at projected PAPER muzzle, hit ray remains unchanged',()=>{
  const {api,THREE,viewmodel}=tracerHarness();
  viewmodel.getMuzzleWorldPosition=()=>new THREE.Vector3(.12,-.29,-2.9);
  const origin=new THREE.Vector3(0,0,0), dir=new THREE.Vector3(0,0,-1);
  const visual=api.localTracerVisualStart(origin,dir);
  assert.equal(visual.x,.12);assert.equal(visual.y,-.29);assert.equal(visual.z,-2.9);
  assert.equal(origin.x,0);
  assert.equal(origin.y,0);
  assert.equal(dir.x,0);
  assert.equal(dir.z,-1);
});

test('line disappears after 0.13s fade with no travel animation',()=>{
  const {api,THREE,added,removed}=tracerHarness();
  api.spawnBulletTracer(new THREE.Vector3(0,0,-0.5),new THREE.Vector3(0,0,-220));
  const points=added[0].geometry.points;
  api.tick(0.06);
  assert(added[0].material.opacity>0 && added[0].material.opacity<0.98);
  assert.strictEqual(added[0].geometry.points,points);
  api.tick(0.075);
  assert.equal(api.activeTracers.length,0);
  assert.strictEqual(removed[0],added[0]);
  assert(added[0].geometry.disposed);
  assert(added[0].material.disposed);
});

test('shot effect is still lines only in offline, online and shotgun shots',()=>{
  const block=html.slice(html.indexOf('const TRACER_LIFETIME'),html.indexOf('// Must match Three.js camera'));
  assert(block.includes('new THREE.LineSegments('));
  assert(!block.includes('new THREE.SphereGeometry('));
  assert(!block.includes('new THREE.CylinderGeometry('));
  assert(!block.includes('new THREE.Mesh('));
  const online=fs.readFileSync(path.join(root,'multiplayer-client.js'),'utf8');
  assert(online.includes('a.spawnBulletTracer(start, end'));
  assert(html.includes('spawnBulletTracer(localTracerVisualStart(player.pos, bulletDirection), endPt)'));
  assert(html.includes('spawnBulletTracer(start, end);'));
  assert(!html.includes('tracer.line.position.lerp('));
});