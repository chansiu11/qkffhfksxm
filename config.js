// After the Render service is deployed, use its HTTPS origin (without /ws).
// This URL corresponds to the suggested Render service name in render.yaml.
if (typeof window !== "undefined") window.GAME_SERVER_URL = 'https://qkffhfksxm-realtime.onrender.com';
(function () {
  const maps = typeof module === 'object' ? require('./match-plans.js') : matchPlans;
  const limit = 90, step = 2, count = limit * 2 / step + 1;
  const gates = {range: []}, interactives = {};
  // Decks, stairs, covered approaches and freestanding cover, in game metres.
  const fixtures = {
    ascent: [
      ['generator',54,-31,2.6,6.3,3.7], ['crate',62.2,-32.3,1.9,1.9,2.4], ['crate',64.1,-31.7,1.9,1.9,2.4],
      ['crate',-32,-36.5,2.1,2.1,2.2],['crate',-32,-38.6,2.1,2.1,2.2],['wood',-27,-45.5,2.2,2,1.6],
      ['deck',60.7,-42.6,17,4.6,3.05],['stairs',54,-37.3,3.5,6,3.05],
      ['roof',53,-7.6,8,7,5.5],['roof',-21,-19,8,8,5.2],['roof',10,-34,8,7,4.7],
      ['roof',-45,-38,5,13,4.2],['wood',-19,-16,2,1.7,1.6]
    ],
    haven: [
      ['crate',44,-27.5,4,2.4,3.8],['wood',47,-27.5,2,2.4,1.7],
      ['generator',1.65,-27.2,9.8,4.8,3.9],['generator',1.65,-23.7,3.5,2.2,2.3],
      ['tarp',-38.4,-26.65,7.9,2.2,3.4],['crate',-42.5,-27,2,2.8,2.1],
      ['deck',47.2,-38.3,6.8,3.5,6],['towerStairs',45.7,-45.05,3,10,6],
      ['roof',1,-28,17,15,7.6],['roof',-16,-14,9,12,5.3],['roof',17,-13,5,11,4.2],
      ['deck',2,10.7,6,3,1.1],['wood',-19,-12,2,2,1.6]
    ]
  };
  function height(map,x,z) {
    if(!maps[map]) return 0;
    const grid=maps[map].grid;
    const gx=Math.max(0,Math.min(count-1.00001,(x+limit)/step));
    const gz=Math.max(0,Math.min(count-1.00001,(z+limit)/step));
    const i=Math.floor(gx), j=Math.floor(gz), a=gx-i, b=gz-j, idx=j*count+i;
    const tl=grid[idx],tr=grid[idx+1],bl=grid[idx+count],br=grid[idx+count+1];
    return a+b<=1 ? tl+(tr-tl)*a+(bl-tl)*b : br+(bl-br)*(1-a)+(tr-br)*(1-b);
  }
  function inside(points,x,z) {
    let odd=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [a,b]=points[i],[c,d]=points[j];
      if((b>z)!==(d>z) && x<(c-a)*(z-b)/(d-b)+a)odd=!odd;
    }
    return odd;
  }
  function siteAt(map,x,z,y) {
    if(!maps[map] || Math.abs(y-height(map,x,z))>1.25)return null;
    return Object.keys(maps[map].plant).find(k=>inside(maps[map].plant[k],x,z))||null;
  }
  function hitDistance(map,x,y,z,dx,dy,dz,range) {
    if(Math.min(y,y+dy*range)>maps[map].maxHeight)return range;
    for(let t=0;t<=range;t+=.5){
      if(y+dy*t>height(map,x+dx*t,z+dz*t))continue;
      let a=Math.max(0,t-.5),b=t;
      for(let i=0;i<10;i++){const m=(a+b)/2;if(y+dy*m>height(map,x+dx*m,z+dz*m))a=m;else b=m;}
      return b;
    }
    return range;
  }
  for(const [id,map] of Object.entries(maps)){
    gates[id]=map.gates;
    map.grid=new Float32Array(count*count);
    const anchors=Object.entries(map.floor).map(([name,h])=>[...map.labels[name].slice(0,2),h]);
    for(let j=0;j<count;j++)for(let i=0;i<count;i++){
      const x=i*step-limit,z=j*step-limit; let sum=0,weights=0;
      for(const [ax,az,h] of anchors){
        const d=Math.max(.12,Math.hypot(x-ax,z-az)-3.5),w=1/(d*d*d*d);
        sum+=w*h;weights+=w;
      }
      map.grid[j*count+i]=sum/weights;
    }
    map.maxHeight=Math.max(...map.grid);
    map.parts=[];
    map.stairs=[];
    function box(kind,x,z,w,d,b,t,angle=0,slope=0) {
      map.parts.push({kind,x,z,w,d,b,t,angle,slope});
    }
    for(const loop of map.outlines){
      for(let i=0;i<loop.length;i++){
        const [ax,az]=loop[i],[bx,bz]=loop[(i+1)%loop.length];
        const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
        if(len<.04)continue;
        const x=(ax+bx)/2,z=(az+bz)/2,nx=dz/len,nz=-dx/len,angle=-Math.atan2(dz,dx);
        const low=id==='ascent'? x>18&&x<31&&z>-12&&z<18 : x< -30&&z>0&&z<17;
        // Street-level masonry differs from upper residential facades.
        const courtyard=x>0&&x<38&&z>-34&&z<18;
        const garden=x>30&&x<45&&z>=-43&&z<-13;
        const style=low?'wall':id==='haven'?'temple':garden?'gardenWall':courtyard?'plaster':
          x<0?(z< -14?'brick':'salmon'):x>40?(z>0?'clay':'ochre'):'pink';
        const thick=low?.55:2.4;
        const h=Math.max(height(id,ax,az),height(id,bx,bz))+(low?(id==='ascent'&&len>20?1.1:3.1):id==='haven'?7.6:9.2);
        const cx=x+nx*thick/2,cz=z+nz*thick/2;
        box(style,cx,cz,len+.04,thick,-5,h,angle);
        box(low?'stonecap':id==='haven'?'eave':'tiles',cx,cz,len+.24,thick+.5,h,h+(low?.24:.48),angle);
        if(!low){
          // The ridge rises away from the street. Local +Z points into the street.
          box(id==='haven'?'shingles':'tiles',x+nx*1.85,z+nz*1.85,len+.18,4.35,h+1.22,h+1.48,angle,-.42);
        }
        if(id==='ascent'&&['gardenWall','plaster','salmon','clay'].includes(style)){
          const base=Math.min(height(id,ax,az),height(id,bx,bz));
          box('limestone',cx,cz,len+.06,thick+.13,-5,base+.54,angle);
        }
        if(id==='ascent'&&!low&&len>=8&&(z>16||z< -48||garden||courtyard)){
          // Place entries on the street face of long residential walls.
          const px=x-nx*.11,pz=z-nz*.11,base=height(id,px,pz);
          box('doorfront',px,pz,2.05,.18,base-.12,base+2.7,angle);
          box('limestone',px,pz,2.43,.32,base+2.7,base+2.95,angle);
          for(const sign of [-1,1]){
            box('limestone',px+sign*dx/len*1.13,pz+sign*dz/len*1.13,.2,.31,base-.12,base+2.74,angle);
          }
        }
        if(!low)box(id==='haven'?'beam':'stonecap',cx,cz,len+.08,thick+.12,h-.95,h-.68,angle);
      }
    }
    for(const [kind,x,z,w,d,h] of fixtures[id]){
      const y=height(id,x,z);
      const bottom=Math.min(y,...[-1,1].flatMap(sx=>[-1,1].map(sz=>height(id,x+sx*w/2,z+sz*d/2))))-.25;
      if(kind==='stairs'||kind==='towerStairs'){
        const tower=kind==='towerStairs',landingX=tower?47.2:60.7,landingZ=tower?-38.3:-42.6;
        const entry=height(id,x,z+(tower?-d/2:d/2)),top=height(id,landingX,landingZ)+h;
        map.stairs.push({x,z,w,d,near:tower?entry:top,far:tower?top:entry});
      }
      if(kind==='towerStairs'){
        // Enter from defender spawn, then climb toward the site-facing landing.
        const entry=height(id,x,z-d/2),landing=height(id,47.2,-38.3)+h;
        for(let i=0;i<32;i++)box('step',x,z-d/2+(i+.5)*d/32,w,d/32+.015,bottom,entry+(landing-entry)*(i+1)/32);
      }else if(kind==='stairs'){
        const stair=map.stairs[map.stairs.length-1];
        for(let i=0;i<24;i++)box('step',x,z-d/2+(i+.5)*d/24,w,d/24+.01,bottom,stair.near+(stair.far-stair.near)*i/24);
      }else if(kind==='deck'||kind==='roof'){
        box(kind,x,z,w,d,y+h-.4,y+h);
        for(const sx of [-1,1])for(const sz of [-1,1]){
          const px=x+sx*(w/2-.25),pz=z+sz*(d/2-.25);
          box('beam',px,pz,.42,.42,height(id,px,pz)-.25,y+h-.4);
        }
      }else box(kind,x,z,w,d,bottom,y+h);
    }
    if(id==='haven'){
      // The thin partition below C Link borders the raised Garage window.
      // Leave the western end open for the turn into C Link.
      const x=-15.15,z=-26.4,y=height(id,x,z);
      box('temple',x,z,10.3,.42,-4,y+4.6);
      box('beam',x,z,10.4,.54,y+4.6,y+4.9);
    }
    if(id==='ascent'){
      // A cross-section perpendicular to travel. Keep the opening clear down to the floor.
      function arch(x,z,width,depth,spring,rise,sideways,wallKind,top){
        const base=height(id,x,z), half=width/2, slices=20;
        for(let i=0;i<slices;i++){
          const u=(i+.5)*width/slices-half, bottom=base+spring+rise*Math.sqrt(1-(u/half)**2);
          const px=x+(sideways?0:u),pz=z+(sideways?u:0);
          const w=sideways?depth:width/slices+.008,d=sideways?width/slices+.008:depth;
          box('limestone',px,pz,w,d,bottom,bottom+.28);
          box(wallKind,px,pz,w*.99,d*.99,bottom+.28,base+top);
        }
      }
      arch(-40.4,-38.5,5,.72,2.1,2.5,true,'brick',5.4);
      for(const side of [-1,1]){
        box('limestone',-40.4,-38.5+side*2.7,.72,.42,-5,height(id,-40.4,-38.5)+2.65);
        arch(53,-7.6+side*3,7.5,.55,3,1.55,false,'plaster',5.1);
        arch(-21,-19+side*3.45,7.5,.65,2.75,1.52,false,'brick',4.8);
        arch(10+side*3.5,-34,6.5,.5,2.7,1.15,true,'plaster',4.3);
      }
      // Transverse beams visible from underneath rafters and the boathouse.
      for(const [x,z,w,d,h,count] of [[60.7,-42.6,17,4.6,3.05,7],[-45,-38,5,13,4.2,6]]){
        const y=height(id,x,z)+h-.4,alongX=w>d;
        for(let i=0;i<count;i++){
          const t=(i+.5)/count-.5;
          box('beam',x+(alongX?t*w:0),z+(alongX?0:t*d),alongX?.26:w,alongX?d:.26,y-.22,y);
        }
      }
      // Recessed-looking shopfronts against the existing solid end walls.
      for(const [x,z,width] of [[74.6,-7.4,4.2],[19.53,-32.8,4.8]]){
        const y=height(id,x,z);
        box('doorfront',x,z,.18,width,y-.15,y+3.05);
        arch(x-.14,z,width,.28,1.85,.92,true,'plaster',3.15);
        for(const side of [-1,1])box('limestone',x-.14,z+side*width/2,.32,.27,y-.15,y+2.12);
      }
      const stackBase=height(id,-32,-38.6)+2.2;
      box('crate',-32,-38.6,2.1,2.1,stackBase,stackBase+2.1);
      // A deep eave and exposed joists line the B lobby approach.
      const lobbyX=-14.1,lobbyZ=25,lobbyY=height(id,lobbyX,lobbyZ)+3.7;
      box('beam',lobbyX,lobbyZ,2.8,6.4,lobbyY,lobbyY+.16);
      box('tiles',lobbyX,lobbyZ,6.6,3,lobbyY+.28,lobbyY+.44,Math.PI/2,.08);
      for(const z of [22.4,24.9,27.5])box('beam',lobbyX,z,2.8,.17,lobbyY-.18,lobbyY);
      const genY=height(id,54,-31);
      for(const side of [-1,1]){
        for(const z of [-33.4,-31,-28.6])box('steel',54+side*1.32,z,.16,.22,genY+.15,genY+3.65);
      }
      box('generatorCap',54,-31,2.8,6.45,genY+3.7,genY+3.84);
    }
    // Towers behind the playable boundary give each skyline its own profile.
    if(id==='ascent'){
      for(const [x,z,w,d,h] of [[-56,-37,10,12,13],[78,-37,12,14,14],[33,-75,6,6,20]]){
        box('ochre',x,z,w,d,-4,h);
        box('stonecap',x,z,w+.7,d+.7,h,h+.65);
        for(const side of [-1,1]){
          box('tiles',x,z+side*d/4,w+1,d/2+.5,h+1.15,h+1.55,0,-side*.35);
        }
      }
    }else{
      for(const [x,z,w,h] of [[-62,-32,10,12],[63,-40,12,16],[30,-70,9,18]]){
        box('temple',x,z,w,w,-4,h);
        for(let level=0;level<2;level++){
          const span=w+3-level*2,base=h+level*2;
          box('beam',x,z,span,span,base,base+.4);
          box('shingles',x,z,span-.5,span-.5,base+.4,base+.85);
          box('temple',x,z,span-3,span-3,base+.85,base+2);
        }
      }
    }
    if(id==='ascent'){
      // Market cross-section at x=3 runs from z=-39.45 to -27.18.
      for(const [start,end] of [[-39.65,-36.25],[-31.75,-26.98]]){
        box('brick',3,(start+end)/2,.8,end-start,-5,8);
      }
    }
    function panel(x,z,w,d,b,h,extras={}){
      const y=height(id,x,z)+b;
      const alongX=w>d, half=(alongX?w:d)/2;
      for(const side of [-1,1]){
        const px=x+(alongX?side*(half+.12):0),pz=z+(alongX?0:side*(half+.12));
        box('beam',px,pz,.25,.25,height(id,px,pz)-.2,y+h+(extras.lift||0));
      }
      if(extras.switchAt){
        const [sx,sz]=extras.switchAt,base=height(id,sx,sz);
        box('beam',sx,sz,.28,.28,base-.2,base+1.4);
      }
      return {box:[x-w/2,x+w/2,y,y+h,z-d/2,z+d/2],...extras};
    }
    interactives[id]=id==='ascent'?{
      A_DOOR:panel(40.835,-25,3.95,.64,0,3.6,{switchAt:[41.9,-26.2],lift:3.6,hp:500}),
      B_DOOR:panel(3,-34,.44,4.5,0,3.6,{switchAt:[4,-33],lift:4.2,hp:500}),
      MID_PANEL:panel(20,4,2.8,.18,.2,2.2,{hp:400}),LINK_PANEL:panel(-4,-3,2,.18,.2,2.2,{hp:400}),
      GARDEN_GLASS:panel(39.6,-42.3,2.8,.15,.7,2.2,{hp:1})
    }:{
      GARAGE_LEFT:panel(-17,3.8,1.8,.18,.4,2.2,{hp:400}),GARAGE_RIGHT:panel(-15,3.8,1.8,.18,.4,2.2,{hp:400}),
      WINDOW_PANEL:panel(2,9.2,2.8,.18,1,1.8,{hp:400})
    };
  }
  function stopAtGate(map,team,oldX,oldZ,pos,radius) {
    for (const [axis,line,start,end,side] of gates[map]) {
      if (team !== side) continue;
      const old = axis==='x' ? oldX : oldZ;
      const delta = pos[axis]-old;
      if (!delta) continue;
      const edge = line-Math.sign(delta)*radius;
      if ((edge-old)/delta < -0.00001 || (edge-old)/delta > 1) continue;
      const along = axis==='x' ? pos.z : pos.x;
      if (along >= start-radius && along <= end+radius) pos[axis]=edge;
    }
  }
  for(const map of Object.values(maps)){
    map.blockers=map.parts.map(({x,z,w,d,b,t,angle,slope,kind})=>{
      const box=[-w/2,w/2,b,t,-d/2,d/2];
      box.frame={x,z,kind,c:Math.cos(angle),s:Math.sin(angle),slope,radius:Math.hypot(w,d)/2};
      return box;
    });
  }
  function stairHeight(map,x,z,y){
    for(const stair of maps[map]?.stairs||[]){
      if(Math.abs(x-stair.x)>stair.w/2 || Math.abs(z-stair.z)>stair.d/2+.02)continue;
      const t=Math.max(0,Math.min(1,(z-stair.z)/stair.d+.5));
      const surface=stair.near+(stair.far-stair.near)*t;
      if(surface<=y+.58)return surface;
    }
    return -Infinity;
  }
  function resolve(map,pos,y,r){
    const support=stairHeight(map,pos.x,pos.z,y);
    y=Math.max(y,support);
    for(const box of maps[map]?.blockers||[]){
      const {x,z,c,s,radius}=box.frame,dx=pos.x-x,dz=pos.z-z;
      if(Math.abs(dx)>radius+r||Math.abs(dz)>radius+r)continue;
      if(box.frame.kind==="step" && Number.isFinite(support))continue;
      const lx=c*dx-s*dz,lz=s*dx+c*dz;
      const offset=box.frame.slope*lz;
      if(y+1.62<=box[2]+offset||y+(box.frame.kind==="step"||box.frame.kind==="deck"?.58:.33)>=box[3]+offset)continue;
      const vx=lx-Math.max(box[0],Math.min(lx,box[1])),vz=lz-Math.max(box[4],Math.min(lz,box[5]));
      const dist=Math.hypot(vx,vz);
      if(dist>=r)continue;
      let px,pz;
      if(dist>.00001){px=vx*(r/dist-1);pz=vz*(r/dist-1);}
      else if(box[1]-Math.abs(lx)<box[5]-Math.abs(lz)){px=(lx<0?-1:1)*(box[1]+r-Math.abs(lx));pz=0;}
      else{px=0;pz=(lz<0?-1:1)*(box[5]+r-Math.abs(lz));}
      pos.x+=c*px+s*pz;pos.z+=-s*px+c*pz;
    }
  }
  const ground={stairHeight,resolve,maps,gates,interactives,stopAtGate,height,hitDistance,siteAt,limit};
  if(typeof module==='object')module.exports=ground;
  else window.AscentGround=ground;
})();
