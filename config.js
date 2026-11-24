// After the Render service is deployed, use its HTTPS origin (without /ws).
// This URL corresponds to the suggested Render service name in render.yaml.
if (typeof window !== "undefined") window.GAME_SERVER_URL = 'https://qkffhfksxm-realtime.onrender.com';
// Cross sections of the approach roads, in game metres (z, elevation).
(function () {
  const profile = [[-56,0],[-42,0],[-37,1.8],[-34,1.8],[-30,0],
    [20,0],[24,1.6],[28,2.4],[31,2.4],[38,0],[56,0]];
  function height(z) {
    for (let i=1;i<profile.length;i++) {
      const [end,high]=profile[i], [start,low]=profile[i-1];
      if (z>=start && z<=end) return low+(high-low)*(z-start)/(end-start);
    }
    return 0;
  }
  function hitDistance(x,y,z,dx,dy,dz,range) {
    let best=range;
    for (let i=1;i<profile.length;i++) {
      const [end,high]=profile[i], [start,low]=profile[i-1];
      const slope=(high-low)/(end-start);
      const denominator=dy-slope*dz;
      if (denominator>=0) continue;
      const t=(low+slope*(z-start)-y)/denominator;
      const at=z+dz*t;
      if (t>=0 && t<best && at>=start && at<=end && Math.abs(x+dx*t)<=56) best=t;
    }
    return best;
  }
  const ground={height,hitDistance};
  if (typeof module==='object') module.exports=ground;
  else window.AscentGround=ground;
})();
