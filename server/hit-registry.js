'use strict';
// Hit detection is deliberately aligned to the Three.js character meshes:
// body BoxGeometry(.76, 1.24, .44) at local y=.62, head (.42,.42,.42)
// at y=1.46, both rotated with group.rotation.y. A small tolerance accounts
// for rendering pixel edges and position rounding; walls remain authoritative.
const MAX_HISTORY_MS = 750;
const MAX_REWIND_MS = 320;
function recordPosition(player, at=Date.now()) {
  const sample={at, x:player.x, z:player.z, footY:player.footY, yaw:player.yaw};
  if (!player.positionHistory) player.positionHistory=[];
  const h=player.positionHistory;
  if (h.length && h[h.length-1].at===at) h[h.length-1]=sample;
  else h.push(sample);
  while (h.length>2 && h[1].at<at-MAX_HISTORY_MS) h.shift();
  if (h.length>35) h.splice(0,h.length-35);
}
function samplePosition(player, at) {
  const h=player.positionHistory;
  const actual={x:player.x,z:player.z,footY:player.footY,yaw:player.yaw};
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
        footY:a.footY+(b.footY-a.footY)*t,yaw:b.yaw};
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
  const fy=pos.footY;
  // The head mesh covers y=1.25..1.67; margin ~3.5 cm.
  const head=rayAabb(x,oy-fy,z,vx,dy,vz,-.245,.245,1.215,1.705,-.245,.245);
  // The body mesh covers y=0..1.24, shoulder width .76; slight margin.
  const body=rayAabb(x,oy-fy,z,vx,dy,vz,-.42,.42,-.03,1.27,-.28,.28);
  // Favor the head where the two tolerance volumes meet at the neck.
  if(Number.isFinite(head) && (head<=body+.10))return {distance:head,headshot:true};
  if(Number.isFinite(body))return {distance:body,headshot:false};
  if(Number.isFinite(head))return {distance:head,headshot:true};
  return null;
}
module.exports={recordPosition,samplePosition,rayCharacter,MAX_REWIND_MS};