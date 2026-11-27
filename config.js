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
  for(const [id,width,depth,cover] of [
    ['arenaA',15,18,[[-6,-4],[6,4],[0,0]]],
    ['arenaB',20,14,[[-9,0],[9,0],[-2,5],[2,-5]]],
    ['arenaC',17,21,[[-8,-7],[8,7],[6,-4],[-6,4],[0,0]]]
  ]){
    const a=[0,depth-3],b=[0,3-depth];
    maps[id]={outlines:[[[-width,-depth],[width,-depth],[width,depth],[-width,depth]]],
      labels:{'Attacker Side Spawn':a,'Defender Side Spawn':b},sites:{},plant:{},gates:[],
      floor:{'Attacker Side Spawn':0,'Defender Side Spawn':0},routes:{attack:[[a,[0,0],b]],defense:[[b,[0,0],a]]}};
    fixtures[id]=cover.map(([x,z])=>['crate',x,z,3,2.5,2.4]);
  }
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
      const wallSegments=[];
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
        const streetWall=id==='haven'&&!low&&(z>0||x>35||x< -32);
        const wallKind=streetWall?'havenPlaster':style;
        box(wallKind,cx,cz,len+.04,thick,-5,h,angle);
        wallSegments[i]={dx:dx/len,dz:dz/len,nx,nz,thick,h,kind:wallKind};
        if(streetWall){
          const base=Math.min(height(id,ax,az),height(id,bx,bz));
          box('foundation',cx,cz,len+.05,thick+.12,-5,base+.62,angle);
          box('redwood',cx,cz,len+.06,thick+.18,h-.52,h-.32,angle);
          if(len>5){
            const count=Math.ceil(len/6);
            for(let i=0;i<count;i++){
              const u=(i+.5)/count-.5;
              box('lattice',x+u*dx-nx*.095,z+u*dz-nz*.095,1.05,.2,h-2.2,h-1.37,angle);
            }
          }
        }
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
      // Seal gaps at outward-facing bends in the Ascent outline. Fill only
      // the wedge between adjacent wall ends, not the playable corridor.
      if(id==='ascent')for(let i=0;i<loop.length;i++){
        const a=wallSegments[(i+loop.length-1)%loop.length],b=wallSegments[i];
        if(!a||!b||a.dx*b.dz-a.dz*b.dx<=.015)continue;
        const [x,z]=loop[i];
        const ax=a.nx*a.thick,az=a.nz*a.thick,bx=b.nx*b.thick,bz=b.nz*b.thick;
        const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
        if(len<.04)continue;
        const mx=(ax+bx)/2,mz=(az+bz)/2;
        const depth=Math.abs(mx*dz-mz*dx)/len;
        if(depth<.025)continue;
        const angle=-Math.atan2(dz,dx),h=Math.min(a.h,b.h),slices=8;
        for(let j=0;j<slices;j++){
          const t=(j+.5)/slices,outer=(j+1)/slices;
          box(a.kind,x+mx*t,z+mz*t,len*outer+.035,depth/slices+.035,-5,h,angle);
        }
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
    if(id==='ascent'){
      // Rafters: a continuous raised timber gallery with the lower recess left open.
      // The rear approach rises from the defender-side corridor, not from the site.
      const top=height(id,60.7,-42.6)+3.05;
      box('deck',59.9,-42.55,20.9,4.5,top-.38,top);
      // Continue the upper landing to the existing front wall near (47,-40).
      box('deck',47.35,-41.55,4.35,5.7,top-.38,top);
      // In-game screenshots show a narrow flight next to a timber ramp,
      // approached through a stone arch. Dimensions fitted to our existing world.
      // User-reported stair center (40,-53); ascend along the rear
      // corridor, then turn toward the existing gallery on a level landing.
      const x=40,z=-53,w=7.6,d=3.25;
      const entry=height(id,x-w/2,z),rise=top-entry;
      const rampD=d-1.5,rampZ=z-(d-rampD)/2;
      // Extend treads into the adjoining south masonry, rather than
      // leaving a narrow drop beside the stair (photo 1).
      const treadNear=rampZ+rampD/2,treadFar=-50.95;
      const stairD=treadFar-treadNear,stairZ=(treadNear+treadFar)/2;
      map.stairs.push({x,z:(z+d/2+treadFar)/2,w,d:treadFar-(z+d/2)+.02,axis:'x',near:entry,far:top});
      map.stairs.push({x,z,w,d,axis:'x',near:entry,far:top});
      for(let i=0;i<22;i++){
        const f=(i+1)/22;
        box('step',x-w/2+(i+.5)*w/22,stairZ,w/22+.012,stairD,entry-.35,entry+rise*f);
      }
      // Extend the ramp to the rear masonry at z=-56.47, not just to
      // the old narrow stair footprint. Both pieces share the same slope.
      const rearEdge=-56.50,innerEdge=rampZ+rampD/2;
      const fullRampD=innerEdge-rearEdge,fullRampZ=(innerEdge+rearEdge)/2;
      box('step',x,fullRampZ,fullRampD,w,(entry+top)/2-.38,(entry+top)/2,Math.PI/2,rise/w);
      const stripEdge=z-d/2;
      map.stairs.push({x,z:(rearEdge+stripEdge)/2,w,d:stripEdge-rearEdge+.02,axis:'x',near:entry,far:top});
      // Join the extended ramp to the upper landing and the rear wall.
      box('deck',46.57,-53.94,5.70,5.12,top-.38,top);
      // Widen the passage floor westward to the masonry face at x=44.25.
      box('deck',46.68,-48.64,5.69,8.74,top-.38,top);
      // Close the small notches where the adjoining masonry turns diagonally.
      // These slabs continue the same floor elevation, rather than blocking the walkway.
      box('deck',44.02,-51.09,.64,.97,top-.38,top);
      box('deck',44.03,-44.54,.72,.82,top-.38,top);
      // The connector runs along the existing Garden partition on its west side.
      box('deck',44.50,-43.38,1.18,2.25,top-.38,top);
      box('deck',44.52,-40.54,1.20,3.68,top-.38,top);
      // Bridge the actual 0.055-0.085 m discontinuity between the
      // west connector and the east landing visible in photo 2.
      // The slab union below removes all coincident top faces.
      box('deck',45.08,-41.60,.34,5.80,top-.38,top);
      // The entrance arch follows the relocated stair, clear of the tread.
      const archX=x-w/2-.5,base=height(id,archX,z),half=d/2;
      for(const side of [-1,1])
        box('limestone',archX,z+side*(half+.18),.72,.48,base-.3,base+3.25);
      for(let i=0;i<18;i++){
        const u=(i+.5)*d/18-half,b=base+2.85+.9*Math.sqrt(1-(u/half)**2);
        // Overlap the curved stone slices vertically so the arch has no open seams.
        box('limestone',archX,z+u,.72,d/18+.024,b,b+.36);
      }
      // Architectural reconstruction of the gallery: broad end screens,
      // a low central timber sill, and connected rear and side surfaces.
      // Reference proportions are approximate; preserve the existing floor.
      for(const [l,r,h] of [[49.43,55.22,2.55],[65.13,70.39,2.55]]){
        const px=(l+r)/2,span=r-l;
        box('tarp',px,-40.43,span,.20,top-.04,top+h);
        for(const u of [l,px,r]){
          box('beam',u,-40.43,.17,.31,top-.38,top+h+.15);
        }
        box('beam',px,-40.43,span+.17,.29,top+h-.10,top+h+.10);
        box('beam',px,-40.43,span+.17,.29,top-.04,top+.13);
      }
      box('beam',60.175,-40.43,9.99,.24,top-.025,top+.19);
      // Back cladding stays against the building and joins the end frame.
      for(const [l,r] of [[49.43,54.7],[54.7,60],[60,65.2],[65.2,70.39]]){
        box('tarp',(l+r)/2,-44.48,r-l+.03,.20,top-.04,top+2.6);
        box('beam',l,-44.48,.17,.30,top-.38,top+2.76);
      }
      box('beam',70.39,-44.48,.17,.30,top-.38,top+2.76);
      box('tarp',70.32,-42.45,.22,4.25,top-.04,top+2.55);
      box('beam',70.32,-42.45,.31,4.25,top+2.43,top+2.65);
      // Garden window: the raised carved stone base and inset wooden frame
      // follow the first-person Garden screenshot, not the overhead minimap.
      const wx=39.6,wz=-42.3,gy=height(id,wx,wz),sill=gy+1.42,head=sill+2.2;
      const wallTop=gy+4.95;
      box('gardenWall',37.68,wz,1.04,.58,-5,wallTop);
      box('gardenWall',42.68,wz,3.36,.58,-5,wallTop);
      // Close the missing Garden side-wall segment reported at (44,-40).
      // Join the window facade to the existing masonry return under the roof.
      box('gardenWall',43.88,-40.12,.64,4.42,-5,wallTop);
      box('limestone',43.88,-40.12,.76,4.42,-5,gy+.54);
      box('gardenWall',wx,wz,2.86,.58,head,wallTop);
      // Tie the raised sill to the facade, below the actual window opening.
      box('gardenWall',wx,wz,2.86,.58,-5,sill);
      box('gardenPlinth',39.95,-41.88,4.45,1.48,gy-.2,sill-.12);
      box('gardenPlinth',39.95,-41.88,4.64,1.62,sill-.12,sill);
      // Decorative limestone bands and recessed timber opening.
      for(const px of [38.08,41.12])box('beam',px,wz,.25,.74,sill,head+.18);
      box('beam',wx,wz,3.18,.74,head-.02,head+.21);
      box('limestone',wx,wz,3.2,.82,head+.2,head+.4);
      for(const px of [38.55,39.95,41.35]){
        box('limestone',px,-41.11,1.02,.13,gy+.18,sill-.23);
      }
      box('wood',41.85,-40.88,.95,.87,gy-.1,gy+.47);
      box('wood',41.85,-41.35,.9,.83,gy+.47,gy+.92);
      // Keep the window opening and landing connected, with small level changes.
      // Fit the raised Garden landing to the adjoining wall face instead
      // of floating in front of it (photo 3). Adjacent treads butt together.
      const gNear=-44.50,gFar=-42.30,gZ=(gNear+gFar)/2,gD=gFar-gNear;
      box('gardenPlinth',39.75,gZ,4.86,gD,sill-.28,sill);
      box('gardenPlinth',42.72,gZ,1.08,gD,sill-.24,sill+.23);
      box('gardenPlinth',43.65,gZ,.78,gD,sill-.15,sill+.46);
      box('gardenPlinth',44.52,gZ,.96,gD,sill-.06,top);
      box('roof',40.5,-40.65,7.15,4.05,wallTop-.22,wallTop);
      for(const px of [37.25,39.45,41.65,43.85])
        box('beam',px,-40.65,.18,4.05,wallTop-.42,wallTop-.22);
      // Replace the isolated lower partition with joined architectural
      // end sections; the central recess remains an open room.
      const soffit=top-.38;
      for(const [l,r] of [[49.43,55.22],[65.13,70.39]]){
        const px=(l+r)/2,span=r-l;
        box('gardenWall',px,-40.43,span,.42,-5,soffit+.03);
        box('beam',px,-40.43,span+.04,.48,soffit-.23,soffit+.02);
      }
      // Continue the lower return to the existing wall corner (photo 4).
      box('gardenWall',49.73,-41.64,.60,5.98,-5,soffit+.03);
      // Continue the site-facing portion of the lower side wall above
      // the gallery floor (photo 4). Leave the rear gallery entry open.
      box('gardenWall',49.73,-39.54,.60,1.92,soffit,top+2.55);
      box('gardenWall',70.24,-42.42,.44,4.42,-5,soffit+.03);
      // Union flat upper landing slabs before mesh generation. Identical
      // top faces previously overlapped and produced z-fighting (photos 1/2).
      // Partition on actual slab edges and merge adjacent occupied strips.
      const flat=map.parts.filter(p=>(p.kind==='deck'||p.kind==='gardenPlinth')&&
        p.angle===0&&p.slope===0&&Math.abs(p.t-top)<1e-6);
      const coord=n=>Math.round(n*1e8)/1e8;
      const xs=[...new Set(flat.flatMap(p=>[coord(p.x-p.w/2),coord(p.x+p.w/2)]))].sort((a,b)=>a-b);
      const zs=[...new Set(flat.flatMap(p=>[coord(p.z-p.d/2),coord(p.z+p.d/2)]))].sort((a,b)=>a-b);
      const sorted=flat.slice().sort((a,b)=>a.kind===b.kind? a.b-b.b : a.kind==='deck'?-1:1);
      const rects=[];
      for(let iz=0;iz<zs.length-1;iz++){
        const z0=zs[iz],z1=zs[iz+1],mz=(z0+z1)/2;
        let run=null;
        for(let ix=0;ix<xs.length-1;ix++){
          const x0=xs[ix],x1=xs[ix+1],mx=(x0+x1)/2;
          const covering=sorted.filter(p=>Math.abs(p.x-mx)<p.w/2+1e-8&&Math.abs(p.z-mz)<p.d/2+1e-8);
          const owner=covering[0];
          const key=owner?owner.kind+'|'+Math.min(...covering.map(p=>p.b)):'';
          if(run&&run.key!==key){rects.push(run);run=null;}
          if(owner){
            if(run)run.x1=x1;
            else run={x0,x1,z0,z1,key,kind:owner.kind,b:Math.min(...covering.map(p=>p.b))};
          }
        }
        if(run)rects.push(run);
      }
      const merged=[];
      for(const r of rects){
        const prev=merged.find(p=>p.key===r.key&&p.x0===r.x0&&p.x1===r.x1&&p.z1===r.z0);
        if(prev)prev.z1=r.z1;else merged.push(r);
      }
      map.parts=map.parts.filter(p=>!flat.includes(p));
      for(const r of merged)box(r.kind,(r.x0+r.x1)/2,(r.z0+r.z1)/2,r.x1-r.x0,r.z1-r.z0,r.b,top);
      // A slim timber fascia and joists beneath the open gallery.
      box('beam',59.9,-40.27,20.9,.18,top-.65,top-.38);
      for(const px of [51.2,54.7,58.2,61.7,65.2,68.7])
        box('beam',px,-42.55,.22,4.5,top-.62,top-.38);
    }
    if(id==='haven'){
      // Close the break between Sewer's west bank and the southeast corner of B hall.
      // Both ends overlap the existing masonry; A Link enters B farther north.
      box('havenPlaster',11.9,-19.0,1.1,6.8,-5,7.4);
      box('redwood',11.9,-19.0,1.22,6.9,7.4,7.7);
      // Frame Tower's site-facing opening above the dark recess under Heaven.
      const tower=height(id,47.2,-38.3)+6;
      for(const x of [44,50.4])box('redwood',x,-37,.42,.48,tower,tower+2.8);
      box('beam',47.2,-37,7,.64,tower+2.6,tower+3);
      box('shingles',47.2,-38.3,7.8,4.3,tower+3,tower+3.35);
      for(const x of [45,47.2,49.4])box('beam',x,-38.3,.23,3.5,tower-.62,tower-.4);
      // Sewer drops under a timber ceiling between Lobby and A.
      const sewer=height(id,17.1,-12.7)+3.6;
      box('roof',17.1,-12.7,5.8,8.2,sewer,sewer+.42);
      for(const z of [-15.9,-12.7,-9.5])box('redwood',17.1,z,5.85,.25,sewer-.22,sewer);
      // B hall and Garage have visible crossbeams and a ridge above each roof.
      for(const [x,z,w,d,h] of [[1,-28,17,15,7.6],[-16,-14,9,12,5.3]]){
        const y=height(id,x,z)+h;
        for(const side of [-1,1])box('shingles',x+side*w/4,z,d+.6,w/2+.42,y+.72,y+1.04,Math.PI/2,-side*2.6/w);
        for(const f of [-.4,-.2,0,.2,.4])box('redwood',x,z+f*d,w,.25,y-.74,y-.4);
      }
      // Grey industrial cover on B, segmented tarp with straps on C.
      const by=height(id,1.65,-27.2);
      for(const x of [-2.7,.25,3.1,6])for(const z of [-29.64,-24.76])
        box('steel',x,z,.18,.17,by+.08,by+3.88);
      const cy=height(id,-38.4,-26.65);
      for(const x of [-41.2,-38.4,-35.6])box('strap',x,-26.65,.16,2.25,cy-.12,cy+3.45);
      const doorsY=height(id,-16,3.8);
      for(const x of [-18.4,-13.6])box('redwood',x,3.8,.44,.65,doorsY-.15,doorsY+3.65);
      box('redwood',-16,3.8,5.55,.82,doorsY+3.25,doorsY+3.69);
      box('shingles',-16,3.8,5.9,1.05,doorsY+3.69,doorsY+3.94);
      // The raised mid window looks out through timber jambs over Courtyard.
      const windowY=height(id,2,10.7)+1.1;
      for(const x of [-.85,4.85])box('redwood',x,9.3,.26,.42,windowY-.06,windowY+2.5);
      box('redwood',2,9.3,6,.48,windowY+2.38,windowY+2.69);
      // Cloth covers the upper edge of the A stack, leaving its green lower panels visible.
      const ay=height(id,44,-27.5)+3.8;
      box('tarp',44,-27.5,4.14,2.5,ay,ay+.12);
      box('tarp',44,-28.72,4.14,.13,ay-.63,ay+.05);
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
      for(const [x,z,w,d,h,count] of [[-45,-38,5,13,4.2,6]]){
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
    }else if(id==='haven'){
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
      // The Toolshed bench faces Market across the B courtyard.
      const bx=-11.1,bz=-35.2,by=height(id,bx,bz);
      box('wood',bx,bz,1.22,2.9,by+.85,by+.99);
      for(const dx of [-.45,.45])for(const dz of [-1.22,1.22])
        box('steel',bx+dx,bz+dz,.13,.13,by-.2,by+.85);
      box('beam',bx-1.8,bz,.23,5.2,by-.25,by+3.6);
      box('roof',bx-.6,bz,3.15,5.35,by+3.55,by+3.8);
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
        box('beam',px,pz,.25,.25,extras.raisedFrame?y:height(id,px,pz)-.2,y+h+(extras.lift||0));
      }
      return {box:[x-w/2,x+w/2,y,y+h,z-d/2,z+d/2],...extras};
    }
    interactives[id]=id==='ascent'?{
      A_DOOR:panel(40.835,-25,3.95,.64,0,3.6,{switchAt:[43.6,-27.08],switchHeight:1.15,lift:3.6,hp:500}),
      B_DOOR:panel(3,-34,.44,4.5,0,3.6,{switchAt:[-10.8,-35.2],switchHeight:1.09,lift:4.2,hp:500}),
      GARDEN_GLASS:panel(39.6,-42.3,2.8,.15,1.42,2.2,{hp:1,raisedFrame:true})
    }:id==='haven'?{
      GARAGE_LEFT:panel(-18.05,3.05,.22,1.65,0,2.95,{hp:400}),GARAGE_RIGHT:panel(-13.95,3.05,.22,1.65,0,2.95,{hp:400})
    }:{};
  }
  function stopAtGate(map,team,oldX,oldZ,pos,radius) {
    for (const [axis,line,start,end,side] of gates[map] || []) {
      if (team !== side) continue;
      const other=axis==='x'?'z':'x';
      const old=axis==='x'?oldX:oldZ, oldAlong=axis==='x'?oldZ:oldX;
      const delta=pos[axis]-old, alongDelta=pos[other]-oldAlong;
      if (Math.abs(delta)<1e-8) continue;
      const direction=Math.sign(delta);
      const edge=line-direction*radius;
      const fraction=(edge-old)/delta;
      if (fraction>1 || (fraction<0 && (line-old)*direction<0)) continue;
      const t=Math.max(0,fraction);
      const along=oldAlong+alongDelta*t;
      if(along<start-radius || along>end+radius) continue;
      if((pos[axis]-edge)*direction>0) pos[axis]=edge;
    }
  }
  const CELL=8, INDEX_MARGIN=1.5;
  const cellKey=(x,z)=>Math.floor(x/CELL)+','+Math.floor(z/CELL);
  for(const map of Object.values(maps)){
    map.blockers=map.parts.map(({x,z,w,d,b,t,angle,slope,kind})=>{
      const box=[-w/2,w/2,b,t,-d/2,d/2];
      box.frame={x,z,kind,c:Math.cos(angle),s:Math.sin(angle),slope,radius:Math.hypot(w,d)/2};
      return box;
    });
    // Conservative broad-phase index. Keep the original ordering of colliders
    // and include the same bounding-circle margin as the narrow-phase scan.
    map.blockerCells=new Map();
    map.blockers.forEach((box,i)=>{
      const {x,z,radius}=box.frame,m=radius+INDEX_MARGIN;
      for(let cx=Math.floor((x-m)/CELL);cx<=Math.floor((x+m)/CELL);cx++)
        for(let cz=Math.floor((z-m)/CELL);cz<=Math.floor((z+m)/CELL);cz++){
          const key=cx+','+cz;
          let list=map.blockerCells.get(key);
          if(!list)map.blockerCells.set(key,list=[]);
          list.push(i);
        }
    });
  }
  function stairHeight(map,x,z,y){
    for(const stair of maps[map]?.stairs||[]){
      if(Math.abs(x-stair.x)>stair.w/2+.00001 || Math.abs(z-stair.z)>stair.d/2+.02)continue;
      const along=stair.axis==='x'?(x-stair.x)/stair.w:(z-stair.z)/stair.d;
      const t=Math.max(0,Math.min(1,along+.5));
      const surface=stair.near+(stair.far-stair.near)*t;
      if(surface<=y+.58)return surface;
    }
    return -Infinity;
  }
  function resolve(map,pos,y,r){
    const support=stairHeight(map,pos.x,pos.z,y);
    y=Math.max(y,support);
    const data=maps[map];if(!data)return;
    const indexed=r<=INDEX_MARGIN;
    let key='',list=[],cursor=0,last=-1;
    for(;;){
      if(indexed){
        const next=cellKey(pos.x,pos.z);
        if(key!==next){
          key=next;list=data.blockerCells.get(key)||[];cursor=0;
          while(cursor<list.length&&list[cursor]<=last)cursor++;
        }
        if(cursor>=list.length)break;
        last=list[cursor++];
      }else if(++last>=data.blockers.length)break;
      const box=data.blockers[last];
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
