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
assert.equal(ground.gates.ascent.length,8);
assert.equal(ground.gates.haven.length,9);
assert.ok(ground.gates.ascent.some(([axis,line,,,team])=>axis==='x'&&line===-9.2&&team==='attack'));
assert.ok(ground.gates.ascent.some(([axis,line,,,team])=>axis==='x'&&line===29.3&&team==='attack'));
assert.ok(!Object.hasOwn(ground.interactives.ascent,'MID_PANEL'));
assert.ok(!Object.hasOwn(ground.interactives.ascent,'LINK_PANEL'));
console.log('buy phase gate checks passed');
