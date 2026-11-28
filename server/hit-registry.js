'use strict';
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.CharacterHitboxes=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
const zones = [
  {zone:'head', min:[-.079,1.45,-.097], max:[.079,1.677,.114]},
  {zone:'body', min:[-.184,1.13,-.167], max:[.184,1.432,.193]},
  {zone:'body', min:[-.323,1.276,-.105], max:[-.127,1.446,.130]},
  {zone:'body', min:[.127,1.276,-.105], max:[.323,1.446,.130]},
  {zone:'body', min:[-.207,.795,-.135], max:[.207,1.165,.213]},
  ...[-1,1].flatMap(side=>[
    {zone:'leg', min:[side*.139-.097,.490,-.122], max:[side*.139+.097,.811,.152]},
    {zone:'leg', min:[side*.169-.088,.108,-.086], max:[side*.169+.088,.504,.146]},
    {zone:'leg', min:[side*.178-.070,0,-.135], max:[side*.178+.070,.125,.151]}
  ])
];
const crouchScale=.75;
function isCrouched(p) { return Number.isFinite(p.y) && p.y-p.footY<1.39; }
const MAX_HISTORY_MS = 750;
const MAX_REWIND_MS = 320;
function recordPosition(player, at=Date.now()) {
  const sample={at, x:player.x, z:player.z, footY:player.footY, yaw:player.yaw, crouched:isCrouched(player)};
  if (!player.positionHistory) player.positionHistory=[];
  const h=player.positionHistory;
  if (h.length && h[h.length-1].at===at) h[h.length-1]=sample;
  else h.push(sample);
  while (h.length>2 && h[1].at<at-MAX_HISTORY_MS) h.shift();
  if (h.length>35) h.splice(0,h.length-35);
}
function samplePosition(player, at) {
  const h=player.positionHistory;
  const actual={x:player.x,z:player.z,footY:player.footY,yaw:player.yaw,crouched:isCrouched(player)};
  if (!h?.length) return actual;
  const last=h[h.length-1];
  // Also covers server-side forced moves (teleport/round setup in tests).
  if (Math.hypot(last.x-player.x,last.z-player.z)>0.03 || Math.abs(last.footY-player.footY)>0.03)
    return actual;
  if (at>=last.at) return last;
  if (at<=h[0].at) return h[0];
  for (let i=h.length-1;i>0;i--) {
    const a=h[i-1],b=h[i];
    if (at>=a.at) {
      const t=Math.max(0,Math.min(1,(at-a.at)/(b.at-a.at||1)));
      return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,
        footY:a.footY+(b.footY-a.footY)*t,yaw:b.yaw,crouched:t<.5?a.crouched:b.crouched};
    }
  }
  return h[0];
}
function rayAabb(ox,oy,oz,dx,dy,dz,lx,hx,ly,hy,lz,hz) {
  let near=0,far=Infinity;
  for (const [origin,dir,lo,hi] of [[ox,dx,lx,hx],[oy,dy,ly,hy],[oz,dz,lz,hz]]) {
    if (Math.abs(dir)<1e-9) {if(origin<lo || origin>hi)return Infinity;continue;}
    const a=(lo-origin)/dir, b=(hi-origin)/dir;
    near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
    if (far<near) return Infinity;
  }
  return far>=0 ? near : Infinity;
}
function rayCharacter(ox,oy,oz,dx,dy,dz,target,at) {
  const pos=samplePosition(target,at);
  const angle=pos.yaw||0,c=Math.cos(angle),s=Math.sin(angle);
  const rx=ox-pos.x,rz=oz-pos.z;
  const x=c*rx-s*rz, z=s*rx+c*rz;
  const vx=c*dx-s*dz,vz=s*dx+c*dz;
  const scale=pos.crouched?crouchScale:1;
  let hit=null;
  for(const {zone,min,max} of zones){
    const distance=rayAabb(x,oy-pos.footY,z,vx,dy,vz,min[0],max[0],min[1]*scale,max[1]*scale,min[2],max[2]);
    if(Number.isFinite(distance)&&(!hit||distance<hit.distance)){
      hit={distance,headshot:zone==='head',legshot:zone==='leg'};
    }
  }
  return hit;
}
return {zones,crouchScale,isCrouched,recordPosition,samplePosition,rayCharacter,MAX_REWIND_MS};
});
