/* Fictional game locomotion. Units are game-world metres and seconds. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GameMovement=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const settings=Object.freeze({groundAccel:45,groundBrake:60,airAccel:7.5,airCap:1.04,landingKeep:.76,jumpBufferMs:120,jumpSpeed:7.6});
  function clampSpeed(v,max){
    const speed=Math.hypot(v.x,v.z);
    if(speed>max&&speed>0){const scale=max/speed;v.x*=scale;v.z*=scale;}
  }
  function approach(v,x,z,amount){
    const dx=x-v.x,dz=z-v.z,d=Math.hypot(dx,dz);
    if(d<=amount){v.x=x;v.z=z;}
    else if(d>0){v.x+=dx*amount/d;v.z+=dz*amount/d;}
  }
  function advance(v,wx,wz,max,grounded,dt,locked=false){
    if(locked){v.x=v.z=0;return;}
    dt=Math.max(0,Math.min(.05,dt));max=Math.max(0,max);
    const magnitude=Math.min(1,Math.hypot(wx,wz));
    if(grounded){
      const opposing=v.x*wx+v.z*wz<0;
      const slowing=magnitude<.001||opposing||Math.hypot(v.x,v.z)>max*magnitude+.01;
      approach(v,wx*max,wz*max,(slowing?settings.groundBrake:settings.groundAccel)*dt);
      clampSpeed(v,max);
    }else{
      // Preserve horizontal momentum when input is released; air steering is weaker.
      if(magnitude>.001)approach(v,wx*max,wz*max,settings.airAccel*dt);
      clampSpeed(v,max*settings.airCap);
    }
  }
  function land(v){v.x*=settings.landingKeep;v.z*=settings.landingKeep;}
  function collision(v,dx,dz,actualX,actualZ){
    const cx=actualX-dx,cz=actualZ-dz,d=Math.hypot(cx,cz);
    if(d<.0001)return;
    const nx=cx/d,nz=cz/d,into=v.x*nx+v.z*nz;
    if(into<0){v.x-=nx*into;v.z-=nz*into;}
  }
  function queueJump(p,now){p.jumpQueuedUntil=now+settings.jumpBufferMs;}
  function consumeJump(p,now,allowed=true){
    if(!allowed){p.jumpQueuedUntil=0;return false;}
    if(!p.jumpQueuedUntil||now>p.jumpQueuedUntil){p.jumpQueuedUntil=0;return false;}
    if(!p.onGround)return false;
    p.jumpQueuedUntil=0;p.vel.y=settings.jumpSpeed;p.onGround=false;
    p.audioJumped=true;p.audioPeak=p.footY;p.audioAirTime=0;
    return true;
  }
  function reset(p){
    p.vel.x=p.vel.y=p.vel.z=0;p.onGround=true;p.jumpQueuedUntil=0;
  }
  return {settings,advance,land,collision,queueJump,consumeJump,reset};
});
