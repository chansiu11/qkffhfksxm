const assert=require('node:assert/strict');
const ground=require('../config.js');
for(const map of ['ascent','haven']){
  for(const [axis,line,start,end,team] of ground.gates[map]){
    const other=axis==='x'?'z':'x', mid=(start+end)/2;
    for(const dir of [-1,1]){
      const old={[axis]:line-dir*2,[other]:mid};
      const next={[axis]:line+dir*2,[other]:mid};
      ground.stopAtGate(map,team,old.x,old.z,next,.62);
      assert.ok((next[axis]-line)*dir<=-.61999, map+' '+team+' '+axis+' '+line);
    }
  }
}
const pos={x:0,z:10};ground.stopAtGate('range','attack',0,20,pos,.62);
assert.equal(pos.z,10);
console.log('buy phase gate checks passed');
