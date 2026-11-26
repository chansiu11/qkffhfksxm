/* First-person WEAPON-ONLY paper-plane viewmodel.
 * Each supplied transparent 2D texture lies on a single mathematically projected
 * rectangle in 3D camera space: muzzle edge far, rear/stock edge near. This is
 * a perspective warp of a flat photograph, NOT a 3D weapon or an arm model.
 */
(function () {
  'use strict';
  const styles = Object.freeze({
    bandit:{kind:'pistol',mark:'BANDIT'},warden:{kind:'rifle',mark:'WARDEN'},
    ares:{kind:'rifle',mark:'ARES'},odin:{kind:'rifle',mark:'ODIN'},
    knife:{kind:'blade',mark:'EDGE'},classic:{kind:'pistol',mark:'CLASSIC'},
    shorty:{kind:'short',mark:'SHORTY'},frenzy:{kind:'machine',mark:'FRENZY'},
    ghost:{kind:'pistol',mark:'GHOST'},sheriff:{kind:'revolver',mark:'SHERIFF'},
    stinger:{kind:'smg',mark:'STINGER'},spectre:{kind:'smg',mark:'SPECTRE'},
    bucky:{kind:'shotgun',mark:'BUCKY'},judge:{kind:'shotgun',mark:'JUDGE'},
    bulldog:{kind:'rifle',mark:'BULLDOG'},guardian:{kind:'rifle',mark:'GUARDIAN'},
    phantom:{kind:'rifle',mark:'PHANTOM'},vandal:{kind:'rifle',mark:'VANDAL'},
    marshal:{kind:'sniper',mark:'MARSHAL'},outlaw:{kind:'sniper',mark:'OUTLAW'},
    operator:{kind:'sniper',mark:'OPERATOR'}
  });
  // Stylized screen-space animation only: x, y, roll (degrees).
  // Each photo moves as one rigid visual element; no mechanical part animation.
  const equipMotion=Object.freeze({
    bandit: [[60,214,15],[18,39,-5],[-3,-7,1]],
    warden: [[112,254,-16],[22,55,6],[-6,-9,-2]],
    ares: [[164,280,14],[36,59,-3],[-7,-10,2]],
    odin: [[180,315,-17],[45,74,5],[-9,-12,-3]],
    knife:    [[145,230,-32],[36,46,12],[-12,-10,-5]],
    classic:  [[35,220,11],[8,35,-4],[-4,-6,1]],
    shorty:   [[100,235,19],[20,47,6],[-5,-8,-2]],
    frenzy:   [[75,205,-19],[15,31,8],[-5,-6,-2]],
    ghost:    [[-45,225,-12],[-10,40,3],[5,-8,0]],
    sheriff:  [[115,240,30],[25,45,-10],[-7,-8,3]],
    stinger:  [[120,225,15],[23,37,-5],[-6,-7,1]],
    spectre:  [[85,240,-10],[15,40,4],[-4,-7,-1]],
    bucky:    [[160,250,25],[42,56,9],[-7,-10,-2]],
    judge:    [[100,270,12],[26,62,-3],[-6,-7,1]],
    bulldog:  [[125,250,18],[32,44,-6],[-6,-8,2]],
    guardian: [[55,265,-17],[12,60,4],[-3,-9,-1]],
    phantom:  [[90,250,9],[20,39,-3],[-5,-6,1]],
    vandal:   [[140,250,-14],[30,50,5],[-8,-9,-2]],
    marshal:  [[-60,265,-24],[-15,55,-8],[7,-8,2]],
    outlaw:   [[150,285,21],[38,62,6],[-6,-10,-2]],
    operator: [[180,310,16],[48,75,-4],[-7,-12,1]]
  });
  function equipPose(id,progress,scale=1){
    if(id!=='knife'){
      const t=Math.max(0,Math.min(1,progress));
      return {x:0,y:220*scale*(1-t*t*(3-2*t)),roll:0};
    }
    const frames=equipMotion.knife;
    const t=Math.max(0,Math.min(1,progress));
    const times=[0,.48,.82,1],points=[...frames,[0,0,0]];
    let i=0;while(i<2&&t>times[i+1])i++;
    let u=(t-times[i])/(times[i+1]-times[i]);
    u=u*u*(3-2*u);
    const values=points[i].map((a,j)=>a+(points[i+1][j]-a)*u);
    return {x:values[0]*scale,y:values[1]*scale,roll:values[2]*Math.PI/180};
  }
  const referenceImages=Object.freeze({
    warden:'guardian',bandit:'bandit',classic:'classic',shorty:'shorty',frenzy:'frenzy',ghost:'ghost',
    sheriff:'sheriff',stinger:'stinger',spectre:'spectre',bucky:'bucky',judge:'judge',
    bulldog:'bulldog',guardian:'guardian',phantom:'phantom',vandal:'vandal',
    marshal:'marshal',outlaw:'outlaw',operator:'operator',ares:'ares',odin:'odin',knife:'knife'
  });
  const sourceSize=Object.freeze({
    warden:[671,159],bandit:[294,182],classic:[308,234],shorty:[668,231],sheriff:[444,246],
    ghost:[664,228],frenzy:[285,233],stinger:[647,255],spectre:[626,245],
    bucky:[653,138],judge:[623,214],bulldog:[663,222],guardian:[671,159],
    phantom:[669,181],vandal:[663,232],marshal:[672,129],operator:[661,143],
    ares:[677,151],odin:[638,211],knife:[658,136],outlaw:[680,160]
  });
  // From the edge-alpha pixels of the user's cutout images, NOT an arbitrary
  // center of the whole screenshot. Values are fractions of the source height.
  const muzzleEdgeY=Object.freeze({
    warden:.188,bandit:.138,classic:.171,shorty:.180,sheriff:.214,ghost:.151,frenzy:.151,
    stinger:.156,spectre:.150,bucky:.262,judge:.270,bulldog:.307,
    guardian:.188,phantom:.273,vandal:.226,marshal:.311,operator:.272,
    ares:.265,odin:.342,knife:.459,outlaw:.340
  });
  // Project the flat photo as an actual paper rectangle in first-person space.
  // Rear is closer to the eye: depth .76, muzzle is farther away: depth 2.9.
  // The plane is viewed from behind and diagonally, so its near end grows larger.
  const VIEW_ENDPOINTS=Object.freeze({
    rifle:{front:[.527,.587],rear:[1.105,.875],height:.47},
    sniper:{front:[.522,.585],rear:[1.105,.868],height:.36},
    smg:{front:[.562,.625],rear:[1.105,.864],height:.49},
    shotgun:{front:[.545,.610],rear:[1.102,.867],height:.48},
    pistol:{front:[.674,.668],rear:[1.093,.868],height:.60},
    machine:{front:[.670,.668],rear:[1.097,.865],height:.56},
    revolver:{front:[.667,.662],rear:[1.097,.874],height:.58},
    short:{front:[.634,.664],rear:[1.092,.876],height:.52},
    blade:{front:[.585,.668],rear:[1.092,.863],height:.42}
  });
  const FRONT_DEPTH=2.9, REAR_DEPTH=.76, FOV=75;
  function viewEndpoints(id,width,height){
    const kind=styles[id]?.kind||'rifle', cfg=VIEW_ENDPOINTS[kind]||VIEW_ENDPOINTS.rifle;
    // Anchor to the lower-right using one scale for both axes, including on tablets.
    const span=Math.min(width,height*16/9), unit=span/(16/9);
    const blade=kind==='blade',rearX=blade?.96:1.025;
    const tipX=blade?.68:cfg.front[0]+.065;
    const tipY=blade?.70:cfg.front[1]+.026;
    return {front:{x:width-(1-tipX)*span,y:height-(1-tipY)*unit},
      edge:{x:width-(1-rearX)*span,y:height-(1-(blade?.89:cfg.rear[1]))*unit},
      frontDepth:blade?1.22:FRONT_DEPTH,rearDepth:REAR_DEPTH,paperHeight:cfg.height*unit/height};

  }
  function focalLength(screenH,fov=FOV){return screenH/(2*Math.tan(fov*Math.PI/360));}
  function atDepth(screen,depth,w,h,focal){
    return {x:(screen.x-w*.5)*depth/focal,
      y:(h*.5-screen.y)*depth/focal,z:-depth};
  }
  function project(p,w,h,focal){
    const depth=-p.z;return {x:w*.5+p.x*focal/depth,y:h*.5-p.y*focal/depth};
  }
  // A proper planar projective transform from the source rectangle to FOUR
  // projected 3D corners, not a rotateZ() applied to a flat overlay.
  function quadToMatrix(corners,width,height){
    const [p0,p1,p2,p3]=corners;
    const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x;
    const dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
    const determinant=dx1*dy2-dx2*dy1;
    let g=0,h=0;
    if(Math.abs(dx3)>1e-8||Math.abs(dy3)>1e-8){
      if(Math.abs(determinant)<1e-8)throw Error('Degenerate paper quad');
      g=(dx3*dy2-dx2*dy3)/determinant;
      h=(dx1*dy3-dx3*dy1)/determinant;
    }
    const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x,c=p0.x;
    const d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y,f=p0.y;
    const arr=[a/width,d/width,0,g/width,b/height,e/height,0,h/height,
      0,0,1,0,c,f,0,1];
    return `matrix3d(${arr.map(v=>Number(v.toFixed(9))).join(',')})`;
  }
  function paperProjection(id,w,h,options={}){
    const endpoints=viewEndpoints(id,w,h),alpha=muzzleEdgeY[id]??.25;
    const fl=focalLength(h), recoil=options.recoil||0,motionX=options.motionX||0,
      motionY=options.motionY||0,drop=options.drop||0,swing=options.swing||0;
    const adsT=Math.max(0,Math.min(1,options.adsProgress||0));
    const mix=(a,b)=>a+(b-a)*adsT;
    // While ADS animates, the flat photo changes perspective: rear is below
    // camera and its muzzle edge converges to the middle of the display.
    // The central overlaid receiver completes the non-sniper sight picture.
    const adsFront={x:w*.50,y:h*.545};
    const adsRear={x:w*.50,y:h*1.23};
    const front={x:mix(endpoints.front.x,adsFront.x)+motionX*(1-adsT)+4*recoil+swing,
      y:mix(endpoints.front.y,adsFront.y)+motionY*(1-adsT)-12*recoil+drop};
    const rear={x:mix(endpoints.edge.x,adsRear.x)+motionX*(1-adsT)+12*recoil+swing*.42,
      y:mix(endpoints.edge.y,adsRear.y)+motionY*(1-adsT)+15*recoil+drop+(options.gripY||0)};
    const M=atDepth(front,endpoints.frontDepth,w,h,fl),R=atDepth(rear,REAR_DEPTH,w,h,fl);
    const upright=endpoints.paperHeight*(1-.38*adsT);
    const point=(u,v)=>({
      // Turn the flat sheet toward the viewer during ADS; its vertical paper
      // dimension becomes screen-width when the centerline is straight ahead.
      x:M.x+(R.x-M.x)*u+(.5-v)*upright*.48*adsT,
      y:M.y+(R.y-M.y)*u+(.5-v)*upright*(1-.65*adsT),
      z:M.z+(R.z-M.z)*u+(v-.5)*.035});
    // source v=alpha is the point where the leftmost muzzle pixels are centered.
    // Translate image height so exactly THAT location projects to `front`.
    const actual=(u,v)=>point(u,v-alpha+.5);
    const corners=[actual(0,0),actual(1,0),actual(1,1),actual(0,1)].map(p=>project(p,w,h,fl));
    const [iw,ih]=sourceSize[id]||sourceSize.classic;
    let muzzle=project(actual(0,alpha),w,h,fl);
    if(id==='knife'){
      const dx=rear.x-front.x,dy=rear.y-front.y;
      const corner=(u,v)=>({x:front.x+dx*u-dy*(v-alpha)*ih/iw,y:front.y+dy*u+dx*(v-alpha)*ih/iw});
      corners.splice(0,4,corner(0,0),corner(1,0),corner(1,1),corner(0,1));
    }
    // Rotate and translate the entire projected image, including its visual anchor.
    const pose=options.equipPose;
    let renderedFront=front,renderedRear=rear;
    if(pose&&(pose.x||pose.y||pose.roll)){
      const c=Math.cos(pose.roll),s=Math.sin(pose.roll);
      const transform=p=>{const x=p.x-rear.x,y=p.y-rear.y;return {
        x:rear.x+x*c-y*s+pose.x,y:rear.y+x*s+y*c+pose.y};};
      for(let i=0;i<corners.length;i++)corners[i]=transform(corners[i]);
      muzzle=transform(muzzle);renderedFront=transform(front);renderedRear=transform(rear);
    }
    return {matrix:quadToMatrix(corners,iw,ih),corners,muzzle,
      frontDepth:endpoints.frontDepth,rearDepth:REAR_DEPTH,source:{width:iw,height:ih},front:renderedFront,rear:renderedRear};
  }
  function makeSvg(id){
    // Keep a compatibility SVG public method for existing tooling; the real HUD
    // uses an <img> warped with the paper's four projected corners.
    const name=Object.hasOwn(referenceImages,id)?id:'classic';
    const [w,h]=sourceSize[name];return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><title>${styles[name]?.mark||name}</title><image class="weapon-texture" data-weapon-id="${name}" href="assets/weapons/${referenceImages[name]}.webp" width="${w}" height="${h}"/></svg>`;
  }
  function referencePlacement(id){const [w,h]=sourceSize[id]||sourceSize.classic;return {x:0,y:0,width:w,height:h};}
  function create(THREE,catalog={}){
    const group=new THREE.Group(); // compatibility-only; no 3D gun meshes or limbs
    const flash={visible:false,material:{opacity:0}};
    const layer=document.getElementById('fps-weapon-sprite-layer');
    if(!layer)throw Error('Missing weapon sprite layer');
    let shown='',photo=null,flashNode=null,fireAt=-100000,reloadAt=-100000,
      switchAt=-100000,reloading=false,fireMode='light',lastVisible=false,
      lastTransform='',lastViewport='',muzzleScreen=null;
    let equipMs=750,combo=0,inspectAt=-Infinity,visualKickStart=0;
    // Rendering-only envelope, shared by the sprite and model overlays.
    function getVisualKick(now=performance.now()){
      const age=Math.max(0,now-fireAt);
      const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
      if(age<35)return visualKickStart+(1-visualKickStart)*smooth(age/35);
      return 1-smooth((age-35)/100);
    }
    function inspect(){
      const now=performance.now();
      if(shown==='knife' && now-switchAt>=equipMs && now-fireAt>=(fireMode==='heavy'?560:330))inspectAt=now;
    }
    function setWeapon(id,equipTime){
      id=Object.hasOwn(styles,id)?id:'classic';
      if(id===shown)return;
      equipMs=Math.max(1,(equipTime??catalog[id]?.equipTime??(id==='knife'?.6:1))*1000);fireAt=-100000;visualKickStart=0;combo=0;
      inspectAt=-Infinity;shown=id;switchAt=performance.now();reloading=false;
      const [w,h]=sourceSize[id];
      layer.innerHTML=`<img class="fps-paper-weapon" src="assets/weapons/${referenceImages[id]}.webp" width="${w}" height="${h}" alt="" draggable="false" aria-hidden="true">`+
        `<span class="weapon-shot-flash" aria-hidden="true"></span>`;
      photo=layer.querySelector('.fps-paper-weapon');
      flashNode=layer.querySelector('.weapon-shot-flash');
      muzzleScreen=null;lastTransform='';lastViewport='';
      layer.classList.toggle('weapon-knife',shown==='knife');
    }
    function fire(mode='light'){
      const now=performance.now();
      inspectAt=-Infinity;
      combo=mode==='heavy'||now-fireAt>850?0:(combo+1)%3;
      visualKickStart=getVisualKick(now);
      fireMode=mode==='heavy'?'heavy':'light';fireAt=now;
    }
    function beginReload(){if(shown!=='knife'){reloadAt=performance.now();reloading=true;}}
    function stopReload(){reloading=false;}
    function update(dt,player,state){
      const visible=!!(player?.alive&&state?.inMatch);
      if(visible!==lastVisible){layer.classList.toggle('weapon-visible',visible);lastVisible=visible;}
      if(!visible||!photo){inspectAt=-Infinity;return;}
      const now=performance.now(),w=window.innerWidth||1440,h=window.innerHeight||900;
      const moving=Math.min(1,Math.hypot(player.vel?.x||0,player.vel?.z||0)/7.6);
      const bob=Math.sin(now*.010)*2.8*moving;
      const breath=Math.sin(now*.0011)*1.3;
      const firing=Math.max(0,1-(now-fireAt)/(shown==='knife'?255:135));
      const reloadProgress=reloading?Math.min(1,(now-reloadAt)/1170):0;
      const drop=reloading?Math.sin(Math.PI*reloadProgress)*78:0;
      const scale=Math.min(w,h*16/9)/1440;
      const drawProgress=Math.min(1,Math.max(0,(now-switchAt)/equipMs));
      const drawPose=equipPose(shown,drawProgress,scale);
      const phase=Math.min(1,(now-fireAt)/(fireMode==='heavy'?560:330));
      const stroke=shown==='knife'?Math.sin(Math.PI*phase)**2*scale:0;
      const swing=stroke*(fireMode==='heavy'?-106:[-148,128,-80][combo]);
      const adsT=shown==='knife'?0:Math.max(0,Math.min(1,player.adsProgress||0));
      const args={recoil:shown==='knife'?0:getVisualKick(now),motionX:bob,
        gripY:stroke*18,motionY:Math.abs(bob)+breath-stroke*(fireMode==='heavy'?48:30),drop,swing,adsProgress:adsT,equipPose:{x:drawPose.x*(1-adsT),y:drawPose.y*(1-adsT),roll:drawPose.roll*(1-adsT)}};
      if(shown==='knife'){
        const age=(now-inspectAt)/1000;
        const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
        const lift=smooth(age/.35)*(1-smooth((age-1.75)/.42));
        const turn=smooth((age-.60)/.32)*(1-smooth((age-1.48)/.30));
        const cut=Math.sin(Math.PI*phase)**2;
        const wind=Math.sin(Math.PI*Math.min(1,phase/.23));
        const direction=combo===1?-1:1;
        args.equipPose.x+=scale*(-210*lift+(fireMode==='heavy'?-90:-52*direction)*cut);
        args.equipPose.y+=scale*(-118*lift-25*turn+(fireMode==='heavy'?-32:12)*cut);
        args.equipPose.roll+=.61*lift-.52*turn+(fireMode==='heavy'?.13:direction*.68)*cut-direction*.18*wind;
      }
      const p=paperProjection(shown,w,h,args);
      if(p.matrix!==lastTransform){photo.style.transform=p.matrix;lastTransform=p.matrix;}
      const viewport=`${w}x${h}`;if(viewport!==lastViewport){
        photo.style.width=p.source.width+'px';photo.style.height=p.source.height+'px';
        lastViewport=viewport;
      }
      // Side photo gradually folds toward the eye. The ADS receiver and sight
      // stay visible for non-snipers; sniper photos disappear inside the scope.
      const sniper=['marshal','outlaw','operator'].includes(shown);
      photo.style.opacity=sniper?String(1-adsT):String(1-.96*adsT*adsT);
      layer.classList.toggle('weapon-sniper-full',sniper&&adsT>=.999);
      muzzleScreen={x:p.muzzle.x,y:p.muzzle.y,depth:p.frontDepth};
      if(flashNode){
        flashNode.style.left=p.muzzle.x.toFixed(1)+'px';
        flashNode.style.top=p.muzzle.y.toFixed(1)+'px';
        flashNode.style.opacity=shown!=='knife'&&!player.isScoped&&firing>.45?
          String(Math.min(1,(firing-.45)*2.0)):'0';
      }
      layer.classList.toggle('weapon-aiming',adsT>.01);
    }
    function getMuzzleScreenPosition(){return muzzleScreen?{...muzzleScreen}:null;}
    function getMuzzleWorldPosition(camera){
      if(!muzzleScreen||!camera||!THREE.Vector3)return null;
      const w=window.innerWidth||1440,h=window.innerHeight||900;
      const focal=focalLength(h,camera.fov||FOV),z=muzzleScreen.depth;
      const world=new THREE.Vector3((muzzleScreen.x-w/2)*z/focal,
        (h/2-muzzleScreen.y)*z/focal,-z);
      camera.updateMatrixWorld?.(true);
      return camera.localToWorld(world);
    }
    setWeapon('classic');
    return {group,flash,setWeapon,inspect,fire,beginReload,stopReload,update,getVisualKick,
      getMuzzleScreenPosition,getMuzzleWorldPosition,
      get isReloading(){return reloading;},get current(){return shown;},styles};
  }
  window.WeaponViewmodels={create,styles,makeSvg,referenceImages,sourceSize,referencePlacement,
    viewEndpoints,paperProjection,quadToMatrix,muzzleEdgeY,equipPose};
})();
(function () {
  const {create:createSprite,referenceImages,sourceSize}=window.WeaponViewmodels;
  const files = {
    phantom:'Phantom_Rifle', vandal:'Tactical_Rifle_Menu', bulldog:'Bulldog_Rifle', guardian:'Guardian', warden:'Valorant_New_Gun_Warden', knife:'Tactical_Shadow_Blade',
    classic: 'Black_Semi_Automatic_Pistol', shorty: 'Shadowbreaker',
    frenzy: 'Tactical_Shadow_SMG', ghost: 'Shadow_Sentinel',
    bandit: 'Shadowline_Pistol', sheriff: 'Shadowhawk_Revolver'
  };
  // Extra uploaded archives are first-person cosmetic assets only.
  const heldOnlyArchives = {
    "stinger": "refs/classic/Meshy_AI_Shadow_Carbine_20261126_texture_fbx.zip",
    "spectre": "refs/classic/Meshy_AI_Shadowline_SMG_20261126_texture_fbx.zip",
    "bucky": "refs/classic/Meshy_AI_Tactical_Shotgun_20261126_texture_fbx.zip",
    "judge": "refs/classic/Meshy_AI_Drum_Fed_Tactical_Shotgun_20261126_texture_fbx.zip",
    "marshal": "refs/classic/Meshy_AI_Scoped_Lever_Action_Rifle_20261126_texture_fbx.zip",
    "operator": "refs/classic/Meshy_AI_Shadowline_Sniper_20261126_texture_fbx.zip",
    "outlaw": "refs/classic/Meshy_AI_Scoped_Tactical_Rifle_20261126_texture_fbx.zip",
    "ares": "refs/classic/Meshy_AI_Ares_Combat_Shotgun_20261126_texture_fbx (1).zip",
    "odin": "refs/classic/Meshy_AI_Shadowbreaker_Cannon_20261126_texture_fbx.zip"
  };
  const hasHeldModel=id=>Object.hasOwn(files,id)||Object.hasOwn(heldOnlyArchives,id);
  const poses = {
    classic: {scale:.40, right:.168, height:-.143, inspectYaw:.95, turnRoll:1.04, reloadDrop:.25, reloadRoll:.54},
    shorty:  {scale:.73, right:.146, height:-.143, inspectYaw:.95, turnRoll:1.04, reloadDrop:.12, reloadRoll:.54},
    frenzy:  {scale:.55, right:.156, height:-.157, inspectYaw:.84, turnRoll:.73, reloadDrop:.17, reloadRoll:.38},
    ghost:   {scale:.66, right:.151, height:-.148, inspectYaw:1.12, turnRoll:.82, reloadDrop:.18, reloadRoll:.51},
    bandit:  {scale:.52, right:.163, height:-.145, inspectYaw:1.02, turnRoll:.94, reloadDrop:.16, reloadRoll:.46},
    sheriff: {scale:.61, right:.154, height:-.155, inspectYaw:1.21, turnRoll:.62, reloadDrop:.12, reloadRoll:.86}
  };
  const riflePose={scale:1.04,right:.17,height:-.15,inspectYaw:.85,turnRoll:.66,reloadDrop:.17,reloadRoll:.47};
  Object.assign(poses,{
    phantom:{...riflePose}, vandal:{...riflePose},
    bulldog:{...riflePose,scale:.875,right:.210,height:-.128,yaw:.32},
    guardian:{...riflePose,scale:.867,right:.210,height:-.131,yaw:.37},
    warden:{...riflePose,scale:.939,right:.198,height:-.122,yaw:.34},
    knife:{...riflePose,scale:.684,right:.106,height:-.158,yaw:1.03}
  });
  // These FBXs have detached lettering above/below the prop in local Z.
  function removeLabelBands(mesh,id,T){
    if(!['knife','bulldog','vandal'].includes(id))return;
    mesh.traverse(node=>{
      if(!node.isMesh)return;
      const src=node.geometry.index?node.geometry.toNonIndexed():node.geometry;
      src.computeBoundingBox();
      const bottom=src.boundingBox.min.z, height=src.boundingBox.max.z-bottom;
      const positions=src.attributes.position, keep=[];
      for(let i=0;i<positions.count;i+=3){
        const z=((positions.getZ(i)+positions.getZ(i+1)+positions.getZ(i+2))/3-bottom)/height;
        if(id==='knife'?z>.36:id==='vandal'?z<.85:z>.16 && z<.71)keep.push(i,i+1,i+2);
      }
      const cleaned=new T.BufferGeometry();
      for(const [key,attr] of Object.entries(src.attributes)){
        const size=attr.itemSize, values=new attr.array.constructor(keep.length*size);
        keep.forEach((v,j)=>values.set(attr.array.subarray(v*size,(v+1)*size),j*size));
        cleaned.setAttribute(key,new T.BufferAttribute(values,size,attr.normalized));
      }
      node.geometry=cleaned;
    });
  }

  // Strip disconnected decorative islands from the nine newly uploaded display assets.
  function retainedPropFaces(parts,strict=false) {
    let count=0, lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
    for(const a of parts){count+=a.length/9;for(let i=0;i<a.length;i++) {const k=i%3;lo[k]=Math.min(lo[k],a[i]);hi[k]=Math.max(hi[k],a[i]);}}
    if(!count||!Number.isInteger(count))return null;
    const extent=Math.max(...hi.map((v,k)=>v-lo[k]));if(!(extent>0&&Number.isFinite(extent)))return null;
    const eps=extent*1e-5,parent=new Int32Array(count),rank=new Uint8Array(count),seen=new Map();
    for(let i=0;i<count;i++)parent[i]=i;
    function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
    function join(a,b){a=root(a);b=root(b);if(a===b)return;if(rank[a]<rank[b]){const t=a;a=b;b=t;}parent[b]=a;if(rank[a]===rank[b])rank[a]++;}
    let face=0;
    for(const a of parts)for(let i=0;i<a.length;i+=9,face++){
      for(let j=i;j<i+9;j+=3){const key=Math.round((a[j]-lo[0])/eps)+','+Math.round((a[j+1]-lo[1])/eps)+','+Math.round((a[j+2]-lo[2])/eps);const old=seen.get(key);if(old===undefined)seen.set(key,face);else join(face,old);}
    }
    seen.clear();
    const groups=new Map();face=0;
    for(const a of parts)for(let i=0;i<a.length;i+=9,face++){
      const r=root(face);let g=groups.get(r);if(!g){g={area:0,lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]};groups.set(r,g);}
      const x=a[i+3]-a[i],y=a[i+4]-a[i+1],z=a[i+5]-a[i+2],u=a[i+6]-a[i],v=a[i+7]-a[i+1],w=a[i+8]-a[i+2];
      g.area+=Math.hypot(y*w-z*v,z*u-x*w,x*v-y*u)/2;
      for(let j=i;j<i+9;j++){const k=(j-i)%3;g.lo[k]=Math.min(g.lo[k],a[j]);g.hi[k]=Math.max(g.hi[k],a[j]);}
    }
    if(groups.size<=1)return null;
    let main=null, best=null;for(const [r,g] of groups)if(!best||g.area>best.area){main=r;best=g;}
    const length=Math.max(...best.hi.map((v,k)=>v-best.lo[k]));if(!(length>0&&best.area>0))return null;
    const cell=length*.02,grid=new Map(),key=(x,y,z)=>x+','+y+','+z;
    const cellCoord=(v,k)=>Math.floor((v-best.lo[k])/cell);
    face=0;
    for(const a of parts)for(let i=0;i<a.length;i+=9,face++)if(root(face)===main){
      for(let j=i;j<i+9;j+=3){const k=key(cellCoord(a[j],0),cellCoord(a[j+1],1),cellCoord(a[j+2],2));let bucket=grid.get(k);if(!bucket){bucket=[];grid.set(k,bucket);}bucket.push(a[j],a[j+1],a[j+2]);}
    }
    const keep=new Set([main]),distance=new Map();
    for(const [r,g] of groups)if(r!==main){
      const gap=strict?(g.area>=best.area*.025?length*.004:length*.0015):(g.area>=best.area*.025?length*.02:length*.007);
      if(g.lo.some((v,k)=>v>best.hi[k]+gap||g.hi[k]<best.lo[k]-gap))continue;
      distance.set(r,gap*gap);
    }
    function near(x,y,z,limit){
      const cx=cellCoord(x,0),cy=cellCoord(y,1),cz=cellCoord(z,2);
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){
        const bucket=grid.get(key(cx+a,cy+b,cz+c));if(!bucket)continue;
        for(let i=0;i<bucket.length;i+=3){const dx=x-bucket[i],dy=y-bucket[i+1],dz=z-bucket[i+2];if(dx*dx+dy*dy+dz*dz<=limit)return true;}
      }return false;
    }
    face=0;
    for(const a of parts)for(let i=0;i<a.length;i+=9,face++){
      const r=root(face),limit=distance.get(r);if(limit===undefined||keep.has(r))continue;
      for(let j=i;j<i+9;j+=3)if(near(a[j],a[j+1],a[j+2],limit)){keep.add(r);break;}
    }
    face=0;
    return parts.map(a=>{const out=[];for(let i=0;i<a.length;i+=9,face++)if(keep.has(root(face)))out.push(i/3,i/3+1,i/3+2);return out;});
  }
  function removeDetachedDecorations(mesh,T,strict=false){
    mesh.updateMatrixWorld(true);
    const nodes=[],parts=[],p=new T.Vector3();
    mesh.traverse(node=>{
      if(!node.isMesh||!node.geometry?.attributes?.position)return;
      const src=node.geometry.index?node.geometry.toNonIndexed():node.geometry;
      const pos=src.attributes.position;
      if(!pos.count||pos.count%3!==0)return;
      const world=new Float64Array(pos.count*3);
      for(let i=0;i<pos.count;i++){
        p.fromBufferAttribute(pos,i).applyMatrix4(node.matrixWorld);
        world[i*3]=p.x;world[i*3+1]=p.y;world[i*3+2]=p.z;
      }
      nodes.push({node,src});parts.push(world);
    });
    const selected=retainedPropFaces(parts,strict);if(!selected)return;
    for(let n=0;n<nodes.length;n++){
      const {node,src}=nodes[n],keep=selected[n];
      if(keep.length===src.attributes.position.count)continue;
      if(!keep.length){node.parent?.remove(node);continue;}
      const cleaned=new T.BufferGeometry();
      for(const [name,attr] of Object.entries(src.attributes)){
        const size=attr.itemSize;
        const array=attr.isInterleavedBufferAttribute?attr.data.array:attr.array;
        const stride=attr.isInterleavedBufferAttribute?attr.data.stride:size;
        const offset=attr.isInterleavedBufferAttribute?attr.offset:0;
        const values=new array.constructor(keep.length*size);
        for(let i=0;i<keep.length;i++)for(let j=0;j<size;j++)values[i*size+j]=array[keep[i]*stride+offset+j];
        cleaned.setAttribute(name,new T.BufferAttribute(values,size,attr.normalized));
      }
      cleaned.computeBoundingBox();cleaned.computeBoundingSphere();
      node.geometry=cleaned;
    }
    mesh.updateMatrixWorld(true);
  }
  let dependencies;
  function script(src) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src; tag.onload = resolve; tag.onerror = reject;
      document.head.appendChild(tag);
    });
  }
  async function loadModel(id, T) {
    dependencies ||= script('https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js')
      .then(() => script('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js'));
    try { await dependencies; } catch(error){ dependencies=null; throw error; }
    const objective=id==='spikeFolded'||id==='spikeOpen';
    const objectiveArchive=objective?'refs/classic/Meshy_AI_'+(id==='spikeFolded'?'Armored_Teapot_Tank':'Frostspire_Beacon')+'_20261126_texture_fbx.zip':null;
    const archive = objectiveArchive || heldOnlyArchives[id] || 'refs/classic/Meshy_AI_' + files[id] + (id==='knife'||id==='guardian'?'_20261126':'_20261125') + '_texture_fbx' + (id === 'classic' ? ' (1)' : '') + '.zip';
    const response = await fetch(archive);
    if (!response.ok) throw Error(archive);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const entries = Object.hasOwn(heldOnlyArchives,id)
      ? fflate.unzipSync(bytes,{filter:entry=>/\.fbx$|_texture\.png$/i.test(entry.name)})
      : fflate.unzipSync(bytes);
    const names = Object.keys(entries);
    const mesh = new T.FBXLoader(new T.LoadingManager()).parse(entries[names.find(n => /\.fbx$/i.test(n))].buffer, '');
    removeLabelBands(mesh,id,T);
    if(Object.hasOwn(heldOnlyArchives,id))removeDetachedDecorations(mesh,T,id==='stinger');
    const textureName = names.find(n => /_texture\.png$/i.test(n));
    const url = URL.createObjectURL(new Blob([entries[textureName]], {type:'image/png'}));
    let texture;
    try { texture = await new T.TextureLoader().loadAsync(url); }
    finally { URL.revokeObjectURL(url); }
    texture.encoding = T.sRGBEncoding;
    const material = new T.MeshStandardMaterial({map:texture, roughness:.57, metalness:.18});
    mesh.traverse(node => { if (node.isMesh) node.material = material; });
    const body = new T.Group();
    body.add(mesh);
    const box = new T.Box3().setFromObject(body), size = box.getSize(new T.Vector3());
    mesh.position.sub(box.getCenter(new T.Vector3()));
    if(objective){body.scale.setScalar(1/Math.max(size.x,size.y,size.z));return body;}
    if (size.x > size.z) body.rotation.y = Math.PI / 2;
    body.scale.setScalar(.52 / Math.max(size.x,size.y,size.z));
    // Orient the grip toward the camera using the lower silhouette.
    body.updateMatrixWorld(true);
    let sum=0, count=0;
    const p=new T.Vector3();
    mesh.traverse(node => {
      if (!node.isMesh) return;
      const pos=node.geometry.attributes.position;
      for(let i=0;i<pos.count;i+=5){
        p.fromBufferAttribute(pos,i).applyMatrix4(node.matrixWorld);
        if(p.y < -.06){sum+=p.z; count++;}
      }
    });
    if(files[id] && ['knife','bulldog','guardian','warden','vandal','phantom'].includes(id))body.rotation.y=-Math.PI/2;
    else if(count && sum<0) body.rotation.y+=Math.PI;
    // User-reported reversed cosmetic model orientation; no simulation changes.
    if(['stinger','bucky','marshal','outlaw','operator','ares'].includes(id))body.rotation.y+=Math.PI;
    body.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(body);
    const cap=new T.Box3();
    const cutoff=bounds.min.z+.025*(bounds.max.z-bounds.min.z);
    mesh.traverse(node=>{
      if(!node.isMesh)return;
      const vertices=node.geometry.attributes.position;
      for(let i=0;i<vertices.count;i++){
        p.fromBufferAttribute(vertices,i).applyMatrix4(node.matrixWorld);
        if(p.z<=cutoff)cap.expandByPoint(p);
      }
    });
    const tip=cap.getCenter(new T.Vector3());
    tip.z=bounds.min.z;
    body.userData.muzzle=body.worldToLocal(tip);
    return body;
  }
  WeaponViewmodels.create = function(T,catalog) {
    const api=createSprite(T,catalog), cache=new Map();
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(55,1,.01,5);
    const pivot=new T.Group();
    scene.add(pivot,new T.HemisphereLight(0xffffff,0x89909d,1.35));
    const light=new T.DirectionalLight(0xffffff,1.4);
    light.position.set(-1,2,1); scene.add(light);
    let selected, model, visible=false, equipped=0, inspected=-Infinity, fired=-Infinity;
    let duration=750, reloadStarted=0, startModelDraw=false;
    function getModel(id){
      if(!cache.has(id))cache.set(id,loadModel(id,T).catch(err=>{cache.delete(id);throw err;}));
      return cache.get(id);
    }
    api.remoteModel=async id=>{
      if(!hasHeldModel(id)&&id!=='spikeFolded'&&id!=='spikeOpen')return null;
      const asset=await getModel(id);
      return asset?.clone(true);
    };
    api.preloadJobs=()=>[...Object.keys(files),...Object.keys(heldOnlyArchives)].map(id=>()=>getModel(id));
    // Cosmetic scene props reuse existing resources and never affect simulation.
    api.createGroundDisplay=(id,group)=>{
      if(!Object.hasOwn(referenceImages,id)||!sourceSize[id])return;
      let active=true, sprite=null, clone=null;
      const [w,h]=sourceSize[id];
      const texture=new T.TextureLoader().load('assets/weapons/'+referenceImages[id]+'.webp',tex=>{
        if(!active){tex.dispose();return;}
        tex.encoding=T.sRGBEncoding;
      },undefined,()=>{});
      const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:T.DoubleSide});
      const geometry=new T.PlaneGeometry(.85,.85*h/w);
      sprite=new T.Mesh(geometry,material);sprite.rotation.x=-Math.PI/2;
      group.add(sprite);
      if(files[id])getModel(id).then(asset=>{
        if(!active||!asset)return;
        // Rotate the display as a whole so the broad side faces up.
        const side=new T.Group();side.rotation.z=Math.PI/2;
        clone=asset.clone(true);side.add(clone);group.add(side);
        group.updateMatrixWorld(true);
        const bounds=new T.Box3().setFromObject(side);
        if(!Number.isFinite(bounds.min.y)){group.remove(side);return;}
        side.position.y+=group.position.y-bounds.min.y;
        sprite.visible=false;
      }).catch(()=>{});
      return ()=>{active=false;group.clear();geometry.dispose();material.dispose();texture.dispose();};
    };
    function select(id) {
      if(selected===id)return;
      startModelDraw=hasHeldModel(id);
      selected=id; equipped=performance.now(); inspected=fired=-Infinity;
      pivot.clear(); model=null; visible=false;
      if(!hasHeldModel(id))return;
      getModel(id).then(asset=>{if(asset && selected===id){model=asset;pivot.add(asset);}}).catch(err=>console.warn('Pistol model',id,err));
    }
    const set=api.setWeapon, update=api.update, fire=api.fire, inspect=api.inspect, reload=api.beginReload;
    let modelLoadingEnabled=false;
    api.enableModelLoading=()=>{modelLoadingEnabled=true;select(api.current);};
    api.setWeapon=(id,time)=>{set(id,time);duration=(time??catalog[id]?.equipTime??.75)*1000;if(modelLoadingEnabled)select(api.current);};
    api.hasRenderedModel=id=>visible && selected===id && !!model;
    const releasePosition=new T.Vector3(),releaseRotation=new T.Quaternion();
    let releaseTime=-Infinity,releaseModel=null;
    function interruptInspect(){
      if(Number.isFinite(inspected) && model && performance.now()-inspected<=((capturedClips[selected]?.[1] || inspectTracks[selected])?.at(-1)?.[0]??3)*1000){
        releasePosition.copy(pivot.position);
        releaseRotation.copy(pivot.quaternion);
        releaseTime=performance.now();
        releaseModel=model;
      }
      inspected=-Infinity;
    }
    api.inspect=()=>{inspect();if(model&&!api.isReloading && performance.now()-equipped>=duration)inspected=performance.now();};
    api.fire=(mode)=>{startModelDraw=false;interruptInspect();fired=performance.now();fire(mode);};
    api.beginReload=()=>{startModelDraw=false;interruptInspect();reloadStarted=performance.now();reload();};
    // Seconds, tip x/y and a second point along the blade or barrel, sampled
    // in the 186 x 104 gameplay rectangle of the 200 px reference frames.
    // Hip-fire muzzle anchors in normalized 16:9 capture coordinates and model scale.
    const framing = {
      classic: [0.631, 0.626, 0.4],
      shorty: [0.627, 0.617, 0.72],
      frenzy: [0.646, 0.622, 0.48],
      ghost: [0.637, 0.612, 0.55],
      bandit: [0.636, 0.628, 0.5],
      sheriff: [0.626, 0.605, 0.61],
      stinger: [0.611, 0.622, 0.85],
      spectre: [0.604, 0.615, 0.91],
      bucky: [0.597, 0.624, 0.98],
      judge: [0.611, 0.619, 1.03],
      bulldog: [0.609, 0.614, 0.875],
      guardian: [0.595, 0.61, 0.867],
      warden: [0.6, 0.603, 0.939],
      phantom: [0.585, 0.61, 0.99],
      vandal: [0.594, 0.618, 0.98],
      marshal: [0.588, 0.592, 1.01],
      outlaw: [0.579, 0.593, 1.06],
      operator: [0.572, 0.605, 1.12],
      ares: [0.555, 0.602, 1.1],
      odin: [0.547, 0.598, 1.17]
    };
    // Each 30 Hz frame contains two screen-space anchors on the visible silhouette.
    const capturedClips = Object.fromEntries(Object.entries({
  "classic": [
    "17129b5617129c5517129c541811a0541810a0541810a054190e9854190e9552190e9152190e9153180e9157180e9157180e9054190e8d54190e8b5a190e8b5a190e8b52180e8b51180e8b51180e8b51180e8b51180e8b51180e8b51180e8b51180e8b51",
    "1714915c1715915b1715925b1715925a1715935a1715935a1715925a1715925a1715925a1715925a1715935a1715935a1615935a1715935a1615925a1715935a1615935a1715935a1715935a1715935a1715925a1715925a1715925a1715925a1715925a1713935b1713935b18119455180e9955180e99591714995a17149c5916129c5816119c5616119c5616119c5616119c5617109c5617109c5616109c5616109c5617109c5617109c5617109c5617109c5617109c5617109c5617149d5617149e561714a0561714a0561714a0561714a0561714a0561714a0561714a0561713a0551713a0551713a0551713a0551713a05516139f5616139f5616139f5616139f5616139f5616139f5616139f5516139f5516139f5616139f561611885b1710845b190e7f58190c7f52190c7f50190c8150190c8551190c8953190d8a53190d8a53190e8b56",
    "180d8b52180d8b52180d8b52180d8b52160ba01b160ba01b160ca01c160c9c22170c8257170f8257170f9057180e9c56180d9c55180d9b55190d9b55190d9b55190d8856190d8857180e8d5a18109d5a17109d5817109d5817109c5817109c5818109c571810a054180fa254190ea555190ea555190e9a54190e9a54190c924f190c924f190e9256190e9257190e9157190e9051190e8e50"
  ],
  "shorty": [
    "2618a5572518a5572118a5571f18a3571c16a1581c16a1581c15a1581b159f581b159f581a159c581a15995818158b5c17158b5c1811825c1811825c1810835c1810865c18128b5c16148e5c1815915a1815915a1815945b1815975c1815975c1815955c1715945c",
    "16138c5d16128c5d15128c5d15148d5d15168e5b16168e5b1616905c1716905c1616925c1616935c1616945c1616945c1616945c1716945c1816945c1816945c1816945c1816945c1816945c1816945c1816945c1816945c1816945c1816945c1816945c1816945c1816945c1816935c1816935c1816935c1716935c1716935c1716935c1716935c1716935c1716935c1716935c1716935c1715935c1815935c1815935c1715935c1715935c1715935c1716935c1716935c1715935c1715935c1615935d1615915d1614905d16138d5d16118b5d17108b5d17108c5c16108f5c1612935b16149453161594521615974e18169b4919169b4919169e491c16a2511c16a2511c16a2531c16a2531c16a2531c16a1531b16a1521a16a0521a16a0521a16a0511a16a0511a15a0511a15a0511a15a0511a16a0511a16a0511a16a0511a15a0521a15a0521a16a0521a16a0521a16a0521916a0521916a0521916a0521916a0521916a0521916a0521916a1521916a1521916a1521a16a1521a16a1521a16a1521a16a1521a16a15219169e53181699561616925915158c591513895a1513885b1513885c15138a5c15148a5c16158f5c1615915c1615915c1615915c1615915c",
    "1615915c1615915c1615915c1615915c1615915c1615915c160c9939160c9939180c6e58180c6e58170c9456160ca11d160ca11d160ca11d170da01e180d9f39191490581d15905821169e572217a2572217a5582117a5581d17a2571c15a1571c15a1581b15a1581c15a0581a159e581a159e5819159b581615945916158b5c16158b5c1610835c1610835c1611885d1611895d"
  ],
  "frenzy": [
    "1615885c1615885c16158a5c16158c5c16158c5c1915935b19159b5b16159e5b16159f5b1615a25b1615a35b1614a35b15138c5d15138c5d15138e5a1613965915139c5915139c5915139a5616109256161092551610925516109254",
    "16109154161091541611905416129056161492591615935b1616945c1816975c1a16995a1a169a5a1a169b591a169c581a169c581a169c571a169c571a169c571a169c571b169c571b169c581b169c581c169c581d189c581d189c581d199c581d199c581c199c581c199c581c199c581d199c581d199c581d199c581d199c591d199c591d199b5b1c18995b1c1597561c1598561c15985a1c15ac5a1914ac591814ac581714ab581714ab581714ab581714ab581714ab581714ab581616aa581616aa581616aa581616aa581616aa571618aa571618aa571619a8571619a7571619a6571619a6571519a6581519a6581519a6571519a6571519a4581519a4581519a45819139957191299571a1298571b1298571c1198571c1198571c1198571c1199571c1198571c1198571c1198571c1198571c1198581c1098581c0f96581c0c91521c0c8d521c0c8d541c0c8d541c0e8d541c0e8f521d0e8f521d0e8f521d0e90521d0e90521d0e90521d0e90521d0e90521d0e90521d0e90521d0e90521d0e9052",
    "1a0c78321a0c694a1b0c69561b0c73561a0ca11b1a0ca11b1c0cac581c0cac5c1e108d5c1e118c5c1e12895c1e12885c1e12875c1e12875c1e12885c1e12895c1e128c5c1e128c5c1e12905b1e129d5b1e129d5b1e129d5b1e12a05b1e12a35b1e12a35c1e118f5c1e0f8e5b1e0f8e5a1e1097591e119c591e119c591e0f94521e0f94521d0e91531d0e91531d0e90521d0e9052"
  ],
  "ghost": [
    "23129252231292522312925223129252231292521e0d93521e0d93521e0d94521e0c94521e0c95521e0f96541d0f96541d10954f1d10954f1d10954f1d10954f1d0f954d1d0f954d1d0f954d1d0e99521d0e99541d0d93561d0c8e581c0c8e581c0d8f581b0d90501b0d90501b0d90501b0d9050",
    "1a0f90511a0f90511a0f90501a0f91501a0f91521a109257191192591912905a1914905b1915905b19178f5a1a178f591a168f591a168f5919178f5919178f5919178f5918178f5918178f5919178f5919178f5919178f5919178f5919178f5919178f5919178f5919178f5918188f5918188f5918188f5919188f5918188f5919188f591817905a1813975a18129e5a1912a3561913a3561813a3561813a3561812a3561812a2571812a2571812a2571812a2571912a2571912a2571912a2571912a2571912a2571912a2571912a2571912a2571912a2571912a2571912a2571812a3571812a3571812a3571812a3571912a3571912a3571912a3571912a3571912a3571912a3571912a3571912a3571912a3571912a4571912a4571912a3571912a3571812a3571912a3571812a4571912a4581912a3581912a2581912a1591a109e591a0f91561b0f8e521a0f8e521a0f91521a1091521a109152",
    "1a0e785a1a10a35a1912a35a1912915419129154191291541910935419109354191094541910955419109554191298561913985919139559191395531913955219139552191395521912954f1912964e1912994f19129956191196571a0f91591a0f8c5a1a108c591a1090591a1090521a1090511a109051"
  ],
  "bandit": [
    "1b0e754c1c0e754c1b0e784f1b0f81521b0f85541b0f8f561b0f8f561a0f8c571a0f8c571b0f8f501b0f92501b0f92511b0f92511b0f92511b0f92511b1092511b1092511b1092511b1092511b1092511a1092511910925119109251191192511911925119119251",
    "1d17955a1e1795591e1795581d1795581d1795581d1795581d1796591d1796591d179659211796582117955821179558211795582117955820179558201795582017955820179558201795592017965920179659201796591d1796591d17965a1918985a161aa259151aac57151aac4d151aaa4d151aa74e161aa550161aa550151aa550151aa550151aa550151aa550151aa550151aa550161aa550161aa550161aa550161aa550161aa550161aa550151aa650151aa751151aa852151aa953151aa954151aa954151aa954151aaa541519aa541519aa541519aa541519aa541518aa541518aa541518aa541519aa54151aaa54151aaa54151aaa54151aaa54151aaa54151aaa54151aaa56151aa8581517a75a1517a75a1812a35a1812925618129153181291521713935216139352161393521613925218129251181292511812925118129251181292511812925218129252",
    "151d8550151b8250151a7f53151a7f54151881541517835415178354151783541517815216137e5019107a4c19107a4c1910794c1910774c1910764c1910764d1811784f1812845418128454181290571812905818128c5818128c58181290511812925118129251181292511812925118129251"
  ],
  "sheriff": [
    "15208a4915208a4915208a49152089491520894c1520894c161c884b161c884b161c884b151e884b161e894c181e8e531f188e5521178f5521179155211792551f19925516208b4e16208b4e16208b4e17208b4e171f8b4e171f8b4e161e8b4e161f8b4e",
    "18199f55181a9f55181a9f55181a9f55181a9f5518199f5518199f5518199f5518199f55181a9f55181a9f55181a9f55181a9f55181a9f55181a9f55181a9f55181a9f55181a9f55181a9e5518139e57181299581912995819129958191299581812965b1812965e1813995e18139a5e18159c5d18189c5c18189c5c18189c5c18189c5c18189c5c18189c5c18189c5c18199c5c18199c5c19199c5c19189c5c19199c5c181a9c5c171a9d5c181a9d5c18189d5c19189c5c19189c5c19189c5c19189c5c18189d5c18189d5c18189e5b18189e5b18189e5b18189e5b18189e5a18189e5a18189e5a18179e5a18179e5a18179e5a18189e5a18189e5a18189e5a18189e5a18189e5a18189e5a18189e5a18139b59181299581812945818138f5818138f5818128954181289501812894c1812894c18128a4c18128a4c18128a4c18128a4c18128a4c18128a4c18128a4c18128a4c",
    "1f0ea21e200ca21f200ca21f1810695a1810695a190ca149190ca1491813a25b161a9f5b161a9f5a1a1a9f5a1a189f5b1a189c5b181a905b181a8f4a181a8c46181a8c46171a8a48171a8a49181a8a49181a8a49181a8a49181a8a49181a894b181a894c1818884c1818884a1818884a181a884a181a894c191a9056191a9056181a9055171392551813925517138d5018138c4e"
  ],
  "stinger": [
    "191a6b5e181a6b5e181a6b5e181a725e191a7c5e191a7c5e1b198f5e1b198f5e1b198f5d1c18905d1c17955d21179b5d22169b5d22169b5d22169a5d22169a5d2216995d2216995d2216995d2216995d2216995d2116995d2116995d2116995d2116995d2116995d2116995d2116995d",
    "2216995d2116985d19168d5d18127e5d17127a5c17137a5c18177b5c181a815c181a815c1c18815c2018815c2018805b2016805b2016805b2016815b2017815b1e17815b1e17825b1e17825b1d18825b1d18825b1d18825b1e17825a1e17825a2017825a2017825a2017825a2017825a2017825a2017825a1d18825a1c18815a1c18815a1c18825a1c18825a1c18825a1c18825a1d17815a1d18815a1d17815a1d18815a2018815a2018815a2018815a2018815a2018815b2117815b2117805b21177f5b21177f5c20177f5c1d187f5c181a7d5c161a7a5c1617745c1615715c1613705c1813705c1813745918137a591f178c5b2218935b26189858281a9b57281aa057281ba257281ba257281aa357281aa357281aa357281aa357281aa357281aa357281aa357281aa357281aa357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ba357281ca357271fa357271fa357271fa357271ca357261ba257261aa158261aa158261aa05926199f5a25199f5a2218995b2118935b1f188c5c1c188c5c1a1a8c5d1a1a8d5d1c19905d",
    "16179e5616179e561613845d1813845d1e18855b1e18855b1e18855b23188858281a9258281a925d2317885e2117755e1f17735f1a18715f181a6d5f181a6b5e161b6b5e181a735e181a7a5e191a7f5e1b188c5e1d188f5e1e18905d2117925d2317985d23179b5d24179b5d24179b5d23179a5d23179a5d23179a5d2317995d2217995d2217995d23179a5d"
  ],
  "spectre": [
    "1e187b5b1c18795b151e6c5d151e6c5d151e6d5d151e745d151b7a5d1c1a8d5e1c188d5e2018925e2118985c2218985b2218985b2218985b2118945b2118945b2118955b2118955b2218955b2218955b2118955b2118955b2118955b2118955b2118955b2118955b",
    "2118945b2118945b2118935b19188c5c15187d5c15187a5c151a7a5c171a7d5c1d1a835c221a895c261a895d281a845d281a845d281a845d281a845d281a845d2718845d2618855d2618855d2618865d2718865d2718865c2719865c2819865c2819865d2819865d2819865d281a865d281a865d281a865d291a865c291a865c291a865c291a865c2918865c2a18865c2a18865c2918855c2918855c2918855c2a18855c2a18855c2a18855c2918855c2a18855c2a18855c2a17855c2a17855c2a17855c2817865d2817875d2817885d2817885d2517875d2117835c1f197b5c181a745d171a6f5d171a6f5c171a765b181a805a211889592818915832189756341a9e56341aa256341aa356341aa356331aa456331aa456331aa456331aa456331aa456331aa356331aa356331aa356331aa356321aa4562818a4562618a4562619a456261aa456251aa456241aa456231aa456231aa456241aa456241aa456241aa456241aa456241aa456241aa4562818a4562818a4562818a4562818a4562817a3572816a2592816a2592816a2592616a05b25159e5c2115965c2017945c19178f5b19178f5b1c16905d2016995d2016995d2115925c2115925b2115935a",
    "2215945b2115945b2115945b2115945b190ca01b190ca01b190ca01b190c9920190c745a1913745a19167958211679582315785b2315785b2016835b2017855b1e17855b1e17825b1e16805b1e167f5b1c167d5b1c167c5b1916795b18136c5d18136c5d18136d5d18136f5d1617785d161a885e191a8f5e2018935e2117945b2117945b2118965b2018965b2017945b2017945b"
  ],
  "bucky": [
    "22139352221393522213935222139352161f445b1520435b1420445b1421485b14214a5b13214a5b13214a5b1320495b1320495b1320495b111f475b111e475b121e475b121e465a121e455b121c455b111b425b111b425c151b4e5c151c595d151a6a5d1c18895c1c188d5c2018905a2018915a2118965a2118965a2118965a2118935a2118925a2118925a",
    "1812685c1812615c1712535c15174a5b15184a5b151a4a5b151a4e5b151a4e5b151a4e5b151a4e5b151a4e5b151a4e5b151a4f5b151a4f5b151a4f5b151b525b151b525b151a525b151a525b151a525b151a515a151a515a151a515a151a515a161a4f5a161a4f5a161a4f5a161a505a151a525b151b5a5c15205c5c15205c5c15205c5c151f5c5c151f5d5c151f5d5c151e5d5c151e5d5c15205d5c15205d5c151e5d5c151e5d5c151e5e5c161a5e5c171a5e5c161a5e5c161a5e5c161b5f5c161c5f5c161c5f5c161c5e5c161e5e5c151f5c5c151f5c5c161e5c5c161e5b5c161e5a5c161e575c161e565c161c565c161c4e5b161a4b5b1518455b1517455b1517485b15134b5a15134e5a1513525a151a5a5c161a6a5c181a6f5c21177c5c2617835c2e1b885b2e20895b24218a5b23228c5b22228d5b22228d5b22228d5b22228d5b23218c5b23218c5b24218c5b23218c5b23218c5b23218c5b23218c5b23218c5b23218c5b23228c5b23228c5b23228c5b23218c5b23218c5b23208c5b23208c5b23218c5b23218c5b23218c5b23208c5b25208c5b2a1a8d5b2a1a8d5b281e8f5c281e8f5c25198f5b24188f5a221788582217885822178b5a22178c5a",
    "190ca11a190ca11a180f6f5818116f5818116f5d1818475c181b475c151e465c151e445b151e445b1323445c1323445c13214a5b13204a5b13204a5b1320495b1320495b1320495b1220475b121e475b131e465b131e465b131e465b121e445b111a435c111a425c111a425c1818555c1a186f5c22158b5c22158d5c2216905a2216915a2416955a2416955a2316955a2217935a2217935a2217925a2217925a2217935a2217935a2118935a2118935a"
  ],
  "judge": [
    "2216965a2216975b33229b5b34229b5b39219c5740219f574421a258451fa359451ea3593f1da05a3f1c9e5a3e1c9e5a381c9c5b341a975d3417975d3417975d351ea25d3522a65c3522a65b3722a65b401fa65b401fa65b3e1fa65b3c20a65b3a21a65b3a20a55b3a20a55b3820a55b3920a55b",
    "3822a45c3722a35c3722a25c36239c5d3323945e3222825e261f6c5e261f655e2821645c2823625a28266158252961582429615823286058222860582227605821276058212760582127605821275f5821285f5821285f5821285f5821285f5821285f5821285f5821285f58212860582128605821286058212860582128605821286058212860582128605821286058212860582128605821286058212860582128605821285f5820295e5720295c5620285a56202558582623535b2e23535c2e24595d2226705d2226735d2226795d1e278f5d1e28905d1e28905d202c935c202c945c202d955c202d965c202d965c1f2c965c1e2c965c1e2c955c1e2c955c1e2c955c1e2b955c1e2b955c1e2b955c1e2b955c1e2b955c1e2b955c1e2b955c1e2b955c1e2b955c1e2b955c1e2a955c1e2a955c1f2a965c2029975c2028985c2128995c2227995c2527995c2527995c2527985c2527985c2527985c2527985c2527985c2527975c2527975c2527975c2627975c2627975c2627975c2627975c2627975c2627975c2627975c2627975c2726965c2a26955c32258c5c32247d5b3323725b3623725a3822825a3822885b3822995c38229d5d37229f5d3322a15c3323a25c3323a35c3821a45c3821a65b3821a65b3822a65b3822a65b3821a65b3821a65b3821a65b3822a65b3822a65b3822a65b3822a65b",
    "3822a65b3822a65b3822a65b3822a65b3822a65b1810a01e1810a01e1810a021141a675c141c675c13219a571421a2571d10a2221d10a2221d10a2221d10a2221d10a2221812b03a1618b05e1620b05e1e20ad5e1e20ad5e2121ad5d3224a55c3224975c3224975e33249b5e3a229b5b41229b5b6a249e596b24a3596b21a3595e1ea35a501e9f5a501e9f5a411d9d5b3c1d9c5b331a975d331d975d331a9a5e331d9c5e3722a65c3722a75c3822a75b3a21a65b3d21a65b3d21a65b3a21a65b3821a65b3821a65b"
  ],
  "bulldog": [
    "331a9c543821a5573822a5583822a5583823a4583823a4583823a4583823a4584423a4584e22a5594e22a5596223a5596223a5596a22a5596a22a5596a23a5596a23a5596a23a5595022a5594122a65a3622a85b3323a85c3323a85c3323a85c3323a75c3323a55c3423a55c3423a45c3323a45d3323a45d3323a35d3323a35d3323a35d3324a35d3324a35d3324a35d3324a35d3324a35d3324a35d3324a35d",
    "522ba1584c2aa058412a9a583b279a5939259b592c259b5a27258d5b2723645c3222645d32226e5d3223775d32248d5d2c26945c2c26945c2628945c262a955b252b955b252b955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b242a955b252a955b262a975b262a975b2926975b3323845d3323845d3323935e3222945e2620945e20208d5e20208d5e3221945e38219f5c3c1c9f5b3d1b9e5b3d1b9d5b3d1b9b5b3a1c9a5c3a1d985c3a1d975c3a1d975c3a1d985c3a1d985c3a1d995c3a1c995c3a1c9a5c3c1c9a5c3c1c9b5c3c1c9b5c3c1c9b5c3d1b9b5c3d1b9b5c3d1b9b5c3e1a9b5c3e1a9b5c3e1a9b5c3e1a9b5c3e1a9b5c3e1a9b5c3d1a9b5c3d1a9b5c3d1a9b5c3d1a9b5c3d1a9b5c3d1a9b5c3d1c9b5c3d1c9b5c3c1c9c5b3a1d9d5b3a1d9d5b38219c5b3322965c2622965c2622995c3222a45d3222a45d3222a85d3323aa5c3323aa5c3422aa5c",
    "3323a35d3323a35d3323a35d3323a35d3323a35d1d10a01e1d10a01e18124f5c16184f5c141c6c5b1421845a4024a35a4525a35a4e25a4584e25a4584e23a4583e22a5573d22a5573823a4583823a4583823a4583a23a4583a23a4584423a5584b23a5585023a5595923a5595f23a5595f23a5596423a5596a23a5596a23a5596a23a5596a23a5593a22a65b3722a85b3323a85c3323a95c3324a95c3324a65c3323a55c3323a55c3323a45c3423a45c"
  ],
  "guardian": [
    "2213935222139352221393522213935238218f5f3822895f3323865e3323865e3323855e3323855e3323865e3322865e3322865e3322865e3321795f3321795f33227d5f3323855f3323895f3324915e3324915e3324915e3821a55c3821a55c3820a75b3820a75b3820a85b3820a85b3820a85b3622a45c3323a15d33239e5d33239e5d33239f5d33239f5d33239e5d33239e5e33239e5e",
    "32239b5e33249e5e3324a15d3f23a65a4323a65a4329a2593b29975927268159272681592726815927268159272681592029865c1e2a875c1e2a875c1e2a895d1e2a8a5d1d298b5d1d298b5d1d298b5c1d298b5c1d298b5c1d298b5c1c298b5c1c298b5c1c298a5c1c288a5c1d288a5c1d288a5c1d288a5c1d288a5c1d288a5c1e288a5c1e288a5c1d288a5c1d298a5c1d298a5c1d298a5c1d298a5c1e298a5c1e298b5c1e298b5c1e298b5c1e288b5c1e288b5c2a258f5d2e258f5d32258f5d32258d5d3325825d33247e5d3224715b3224685a3223685a39236a5a3921705c391d705c31196f5c2b156a5c2713665b2513665b2313665c2313665c2313675c2313685c2413685c2413685c2413695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2513695c2514695c2514695c2414695c2414695c2414695c231a685c231e675c2825645c2825645c2223645c2222735d22227b5d3223915e3223915e3223955e3223955e32249c5e32249c5e",
    "32249d5e32249d5e32249e5e32249e5e32249e5d220fa01d220fa01d220fa01d17176b5b171c6b5c3223aa5c3323aa5c33239e5c33239a5e3822895f3822895f3324855e3324855e3324855e3324855e3324855e3324875e3223875e3223845f3223785f3223785f32237e5f32238c5f3224915e3324915e3324975e3323a35c3622a45c3722a65b3722a75b3622a85b3623a85b3323a75c3323a65c"
  ],
  "warden": [
    "3323a05a3323a05a3323a05a3323a05a3323a05a3323a05a3324a05b3324a05b33249e5a33249e5a33249e5a33249e5b32249d5b32249b5b32239b5b1821935b1821935c2021905c21208e5c2120895d2120895e2222905e2a22915e3223945e3223965d3224995d",
    "2c23985d2e23985d3223985d32239a5d33229c5c38229c5c3c279b583c278f573c278f572e2790582028905b1d288b5c1d25815c2025815c2025815c1e26865c1d27875c1c28875c1b2a875c1b2a875c1b2a875c1b2a875c1b29875c1b29875c1b29875c1b29875c1b29875c1b29875c1b29875c1b29875c1b29875c1b29875c1b29875c1b29865c1b29865c1b29865c1b29875c1b29865c1b29865c1b29865c1b29865c1b29865c1b29865c1b29865c1b29865c1c28875c1e27875c2025855c2225835c25257c5c26257a5c2d25765c2d236d5b2122645a2122645a39226c5a3b216d5a3b1e6d5a3319665a2f19625a2b18605a28185f5a26185f5a25185f5a25185f5a25185e5a26195e5a26195e5a27195e5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185f5a27185e5a26185e5a26185e5a26195f5a251b5f5a251e5f5a2a24605a2a24605a20215e5c13215e5c13215e5c21238e5e32249d5e3224a45d3225a45d3224a05d32249c5d32249a5d32249a5d32249d5d32249d5d32249d5d32249d5d32259c5d32259c5d32249b5d32249b5d32259b5d32259b5d",
    "32249b5d32249b5d32249b5d32249b5d32249b5d1610a11d1410a11d1412645b1319645b13227e5b13229d591322a1571221a2591221a15912219f5912219f581221a1581221a1581322a15c2122a35c3224a35b3224a0593322a0583322a05833229f5833229f5833229f5933229f5933249f5a3324a05a3324a05a3323a05a3323a05a3322a05b3322a05b34229f5b34229e5a34229e5a33239e5b33249e5b33239d5b32239a5b2721965c211a945c211a945c32248f5d32258a5d32258a5e32258b5e3226915e3326925e3326935e"
  ],
  "phantom": [
    "22139352221393523325a95d3625a95d3e22a65c3e22a35c3c22a35c38239a5d38249a5d3825985e3825985e38259a5d38259a5d38259a5d38259a5e54259a5e54259a5e54259a5e38259c5d38259c5d38259c5d3825a25c3825a25c3825a75d3825a75d3825a75d3825a55d38259f5d38259f5d38259f5d38259e5d38259e5d38259e5d38259d5d38259d5d38259d5d38259d5d38259d5d",
    "33269b5e33259b5d37259c5d38259e5d5828a15c5828a15c492b955a3e2b8f5a38298f5a3029975a222a975b1f2c8f5c1c2c885c142c885d142c885d1d2d8b5d1d2d8b5d1e2d8c5c1e2d8c5c1a2c8b5c1a2c8b5c1a2c8c5c1a2c8c5c1a2c8c5c1a2c8c5c1a2c8c5c1a2c8c5c1a2c8c5c1a2c8c5c1a2c8c5c1a2c8b5c1a2c8b5c1a2c8b5c1a2c8b5c1b2c8b5c1c2d8b5c1c2d8b5c1c2d8b5c1c2c8b5c1b2c8b5c1b2d8b5c1b2d8b5c1b2d8b5c1c2d8b5c1c2d8b5c1c2d8d5c1c2c905c1c29905c2029805c2829805d3229805d34287b5c3426715c33266c5933266c593e24765a3e22775a3c22775a3821765a331f725c2f1d705c2e1d6f5c2d1d6f5c2d1e705c2d1e725c2d1f735c2e1f735c2f1f735c2f1f735c2f20735c2f20735c2f20735c2f20745c2f20745c2f20745c2f20735c2f20735c3020735c3020735c3020735c3020735c3021735c3021735c3021735c3020745c2f20745c2f21735c2f21735c2f20735c2f20735c2e20725c2e20715c2a216c5c2a216c5c2b266b5d2e286a5d3228685c3228685c3227755e3226805e3226875e36258f5d38249b5d3c239e5d3d239e5d3d239f5d3d239f5d3d239f5d3c239e5d3a239e5d3a239d5d3a239d5d3a239d5d",
    "3725ac5d3725ac5d4423a65c4422a65c4422a65c3d22a65c3c23a65c3c23a65c3a239a5d3a23995d3c23985e3e23985e3e239c5c37259c5c37259c5e4425995e5525995e55259b5e45249d5d39249d5d38249d5d38249d5d3a23a35d3a23a35d3c23a85d4523a85c4523a85c3b23a35d38239d5d38239d5d3a239e5d3b239e5d3b239e5d3a239e5d3a239d5d3a239d5d3a239d5d3a239d5d3a239d5d39249d5d"
  ],
  "vandal": [
    "22139352221393522213935222139352221393522213935232248f5c38248f5c4421905c6a1e945a701d9659701d9658701e96586c1e96596c1b96596c1995596c1995593724925a3725915a3625905a3525905a33258f5a33258d5a33238d593d1e91594a1891596a18925a6a18925a6a18925a5c1d925b3824915d3226915d3226915e3226965e3725a05e3824a25d3c23a25d3c23a35d3c23a35d3d23a35d",
    "501e9a4e491a9b4d441a9b4f341a9a53322497582c2e855d2831795d2437785d243a785d233a7d5d2339825d2437875d2435895d26338a5d26318a5c252f8a5c252e8a5c252e8a5c252e8a5c252e8a5c252e8a5c252e8a5c252e8a5c252e8a5c252e8a5c252e8a5c262e8a5c262f8a5c262e8a5c262e8a5c262e8a5c262e8a5c262e8a5c262e8a5c262e8a5c272f8a5c272f8a5c272f8a5c272f8a5c272f8a5c262f8a5c26308d5d27318e5d3234955c3234955c3b31915b3c31915b402f8f5b422f8d5c432d7e5c442a745b4425745844237558401c7559401b75593a17715b37176f5b34176f5b32176f5b3217705b3117705b31176f5b31176f5b31176f5b31176f5b31166e5b31166e5b30166e5b30166e5b30156e5b30156e5b30166e5b30166e5b30166e5b30166e5b30166e5b30166e5b30166e5b30166e5b30166e5b30166e5b30166d5b30166d5b30166d5b30166d5b30166d5b30166d5b311b6d5c34256b5c372a6a5c382e695c3c2e685d4232685d5146875f5648975f5c48a25e6747a85d6e43a85d723ea65d733ea45e",
    "783ca15e783ca15e783ca15e783ca15e783ca15e783ca15e0f0ea22a0f0da22a140e715d3625715d3625715d36257c5d36257c6036267c60772d8d5d772d8d5d7d21925c801e935b861b9759871b9759881a9759881a9759881a9759881a97598719955a8619945b8419925b8418905b8418905b84188f5b84188f5b84188f5b80168f597f1692597f18925a7f18925a7f18925a7b1e935c7b1e935c7632935d7540945e75409b5e773ca35d773ca35d773ca35d793ba55d793ba55d783ba35d783ba25e783ba15e783ca15e783ca15e773ba15e"
  ],
  "marshal": [
    "0e34555b0e33565b0e31565c0e2f575c0e2e575c0f2d575c0f2d575c0f35575c0e3b4f5e0f3b4f5e103b595e133b615e143a615e143a635e143a635e143a645e153a645e153a645e153a635e103b565e0f3b555e103d4f5d113d4f5d2434565e472e845f772e8c5f772e8c5f85379d5e8537a05d8436a05d8432a05c8432a05c8433a25c8435a25d82369f5d82369e5d82369d5d81369d5d81369d5d",
    "7c38985d7b38975d75398e5c6d3a855b663b855b5c3c8a5c523e955c493e955a304675562c4673562b4572562b4472562b4472562b4373562a4373562a4472562a4472562a4472562a4472562a4572562a4572562a4572562a4572562a4572562b4472562b4472562b4472562b4472562c4372562c4372562c4372562c4372562c4371562a4471562a4471562a4471572a4471572a4471572a4571572a4571572b4572572b4472572e4172573441755835408159363e8c5a363a8f5b3a388f5b4d329c5c512f9f5c532ea15b552ea35b552ea95c552ea95c4d32935b4733765b4433765b4033765b39398257383ba9563740a95636419e5c36429b5c36429b5c35429a5c35429a5c35429a5c35429a5c36429a5c36429a5c36429a5c36429a5c35429a5c35429a5c35429a5c35429a5c35429a5c35429a5c3542995c3542995c3542995c3542995c3542995c3542995c3542995c3543995c3543995c3543995c3543995c3543995c3543995c3543995c3543995c3543995c3543995c3543995c3543995c3543995c3543995c3543985c3543985c3643985c3643985c3a42985c403fa25a453bad59493aad595138a95d5a2b7a5d622b7a5d7030855e77398d5e793a905e",
    "211a7a423625715d3625715d41288c5941288c5910288c59102f425e103f425e103f455e123d475d123c4d5d123c4d5d0e38565c0e34575c0d31575c0d31575c0e2f575c0e2f575c0e2d595c0e2d595c0f39595c0f3c545e123c545e143b615e143b615e143a615e143a645e143a645e153a655e153a655e153a645e103b595e103b575e103e4e5d1643465d1643465d3b3b7b5e843b9a5e843b9a5e86399e5d86399e5d86389f5d8435a05d8433a05c8433a25c8434a25c8336a25d82369f5d82369e5d"
  ],
  "outlaw": [
    "742e7b5e742e7b5e742e7b5e7028795e6c26785e661f785e361d765f361d745f3624725f5e26725f5e26725f7a268c5b7a25985885229e587d12a4588112a7587d12a7587d12a4587914a3577914a3577914a3577814a3587614a3587415a05870189d596c1b995b6a1f935c6725905d672b835e682e835e743c8d5e793c925c7a39935b7b36975b7b359c5b7a359f5c79369f5c79379f5c7a379e5d7a379c5d",
    "224d9057204d8a571e4b85571d4a84571d4a84581d4984581e4984581d4984581d4984581d4a84581d4a84581d4a84581e4a83581e4a83581e4a82581d4a82581d4a82581d4a82581c4a82581c4a82581d4982581d4982581d4a82581c4a82581c4a82581c4a82581e4984581e4984581d4a83571d4a83571e4b85571e4b85571e4c86571c4f88571c5092571e509457204f9458264b95592b48955a363c955b3b369f5b4e32a45b4f30a45b5130a45b5531a95b5531a95b5033a95b4a33825b4531775b4431775b3c34aa5b3938ab58373dab58373fa9593640a8593640a5593641a3593642a1593642a1593641a1593641a1593641a1593641a1593641a1593641a1593641a1593642a1593642a1593642a0593642a05a3642a05a3642a05a3642a05a3642a05a3642a05a3642a05a3642a05a36429f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a36439f5a37429f5a3a409f5a3e3e9f5a493aa75a503aab5b503aab5b5a3a7e5e672d7e5e6a2d805e702f855e763d8d5e763d8d5e7e359c5c7f349c5c7f349c5c7b369a5c77369a5d77369a5d78369a5d",
    "7637995d7637995d7637995d7636995d0d0ea21e0d0ea21e0d1a5460312454606c35805f7939825f7937825f77377f5f75377d5f732e7b5f732e7b5e74307b5e74307b5e74307b5e732e7a5e6c26795e6c26795e3c24765e3624735f3624735f3625735f6128745f7128875d71249a5884229f587e12a4588112a5588112a6588113a6587914a3577914a3577814a4577814a4587515a1587515a1587515a1586f199c5a6b1d955c6723915d672b815e672c815f6d2f895f733a8c5e793a925b7b3696597b3597597a359e5b79369e5c79369e5c"
  ],
  "operator": [
    "18109d400e0ea8340e0ea834140e7a61140e7a61361b7c5e5c257c5e5c307c5e5c447f5f5c44815f5e41865e5e40875d6040875d6040865d6040845e6041835e6041835e6041845e5f40885d5f3f8a5d5e3e8a5d5e3b835c5e3a835c5f3a845c6139865c6238875c6438875c6438875c6438865b6339865b633a8d5c633b8d5d633e8b5d63408b5d6441895e6543895e6644875e6645875f67467f5f6a477f5f6a477f5f6c477f5f6f45845f7044865f723d915e75389b5e7833a25d7831a35c7b2ba55b7c2aa55b",
    "2e28595c2d29595c1e36595b1c36595b1b35595b1b355a5b1b325a5b1b315b5b1b305b5b1b2f5c5b1c2f5c5b1d2f5c5b1d2f5c5b1e2e5c5b1e2e5c5b1d2e5c5b1d2e5c5b1d2e5c5b1d2e5c5b1e2e5c5b1e2e5c5b1e2e5c5b1e2e5c5b1e2e5c5b1e2e5c5b1e2f5c5b1e2f5c5b1e2f5c5b1e2f5c5b1e2f5c5b1e2f5c5b1e2f5c5b232f5c5b242e5a5c3024595c3422595e34206d5f34207f5f34208b5f3422905f3425935e2f2a935e2f2d795e2f2f6d5e2e30695d2e32695d2e356b5d2d366c5d2d366d5d2e356d5d2e356d5d2e356c5d2f346c5d2f346c5d2f346b5d2f346a5d2e346a5d2e346a5d2e34695d2e34695d2f34695d2f34695d2f34695d2f34695d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d2f346a5d30356a5d30356a5d30356d5d3136745d3438895d3438945d4a2ea55c4d2ca55c4d26a45c5220985d6c1e985d6c1e9b5d6c1e9b5c6c209b5c6c209b5c6c209b5c6c1e9b5c6c1d9b5c6c1d9c5c6c1d9c5c6c1d9c5d6c1d9c5d6c1d9c5d",
    "1610a02a1610a02b12157b5f12157b5f34227a5b34227a5b351e7f5e3d1d845e3d1d865d3c1d865d3a1d855d361d835d351d825e351d825e351f825e351f835e431f875d511f875d541f815c591f815c5b22845b5d23865b5d24865b5d23865b5c22865b5921865b5921865b56228d5c4d228d5d431f8b5d351f885d351f885d351f865e351f865e351f865e34207f5e34227f5e34227f5e34237f5e34237f5e341f875e431f925e6821975e6b259e5d7227a35c7627a45b7726a45b7725a45b7724a45b7624a25b7425a15c7126a05c6e269f5c6c269c5d6a259a5d6a249a5d"
  ],
  "ares": [
    "21139352211393522113935221139352211393522113ae5e2113af5e2f13af5e2f14af5e2f16af5e2f16af5e2013a25e1d13a25c1d16a75b331ba75b3b1fa75b3b1fa75b3a1ea75b3a1ea75b391ea85b391ea85b391da85b381da85b381da85b381da85b391fa85b3e21a75b6825a65a6825a65a6a25a65a722ca55a722ca55a7132a45a7033a35a6d34a35a6a35a15b6a35a05c6a32a05c",
    "332b845c2e33805b25347b5b2134695b2132675b212d645b212c635b212b635b2329635b2429635a252a645b252a645b252a645b242a645b242b645b242b645b242b645b242b655b242b655b242b655b242b645b242b645b242b645b242b645b252b645b252b645b252a645b242a635b242a635b242a635b242a635b242a635b242a645b242a645b242a645b252a635b252a635b262a635b282b635b2c2e665a342f795a3a2f845b48248f5c4821925c431d965d371c995d351c995d341b985d341b985d341ca65d3920a65b681da25a701d9e59771b9d587d199d587d189d577c189c577c189c577c189d577c189d577c189d577c189d577c199d577c199d577c199d577c199d577c199d577c199d577c199d577c199d577c199d577c199d577d199d577d199d577d199d577d199d577d199d577d199d577d199d577e199d577e199d577e199d577e199d577e199d577e199c587d199c59771b9c59721e9c596a209e576a20a0574320a057351f9d58341f9b5931209b5a24209a5c2420985d341d985d371d9c5d4d23a45c6926a55b6a28a55b6a29a45b",
    "180f9f25180f9f25180f9f251811715d1815715d1c169a581e16a6582116a85e211bad5e231bae5e3017ae5e3017ae5e3118af5e3119af5e3120af5e3120af5e3120af5e3120af5e19168d5d18168d5b1816955b4319a75b4d22a75b4d24a75b4d24a75b4d24a85b4d24a85b4c23a85b4c23a85b4723a85b4622a85c4622a85c4c23a85b6624a75b6a27a65a6c2aa65a792ca55a792ea55a7533a45a7334a45a7034a45a7034a45a6e34a35a6a339f5c681f965c431b955d431b955d431b955d431f985d46249d5c46249e5c4624a05c4724a05c4c25a05c4d26a05c4d26a05c4d26a05c4d26a05c4e26a05c"
  ],
  "odin": [
    "0f1ca85f0f1aa85f0f19a65e2013a65d2112a85d3412a85a34269958342699582f2594582f2594582f2594581e1897591e1897591714975a1612855c1612855c16127e5d16137e5e16157e5e16157e5e1615825e1c0f865e1e0f905e1e0f905e1e0f905e1e0f905e341c9d5e351ca55d351aa65d3919a65c3b15a55b3b15a55b3a15a55b3518a45a3319a45a2f1ea35a2520a05c25209e5c23209e5c2a20995c2a22995c2f22995c3022995d32209e5d32209e5d341d9f5d341c9f5d341c9f5d341c9f5d",
    "3022a05e30239e5d30239e5d351d965b361d945a361e945a30259459302694582c2795582c2795583024915c3024915c341d945c341d945c391da05b431da05b4922a05b4922a05b4922a05b46229f5b44229f5b381da05b381ca05b391ca15b391ca15b341ea25c341fa25c3320a35c3020a35c3020a35c3022a35c3022a35c3622a05b3920995a39209759392097593a2097594021975a422297594323975a4323975942229859422298594121985941219859412198594121985941219859412198594121985941219859412198594121985941219859412198594121985941219859412198594121985941219859412198594121985941219859412198594121985940209859401f98593f1e98593c1b9759391996593818965838189658381b9a5a361fa35b311fa75c3020a95c3022a95c3022a95c3022a95c3023a95c3023a95c3023a95c3023a95c3023a95c3023a95c3023a95c3023a95c3023a95c3022a95c3022a95c3022a95c3022a95c3022a95c",
    "3022a95c3020a95d3018a75e3018a75e3018a75e301ba85d3020a85d3021a25b3021a25b3422a15b3423a25b3024a15b2c269f5b222a8653222a8653222a8653232d8953232d8953232d8853232c8753232c8753232987532329855423298554232985542329855423298554232984542329845423298554232985542329855423298654232986542329865423298654232985542328855423288653232986532329865323298653232986532429865324298653242986532429865324298653242986532429865324288654242886542428865424288654252887552c258b572c258b573025985a3024985a3024985a3421995b341f9a5b341f9b5c341e9c5c341f9c5c341f9c5c341f9d5c341f9d5b3c219e5b3f24a05b3f24a25a3f24a25a3924a45a3722a45a371fa45a341fa65b3022a65c3022a45d3022a45d3022a45d3022a45d3019a35e3019a35e3018a35e3018a35e3018a35e3020a55d3020a55d3020a55c301fa45c331ea35c341da05c341d9f5c341d9e5c321e9e5d311e9e5d301f9e5d30209e5d30209e5d30209e5d30209e5d30209f5d30209f5d301fa05d301fa05d301fa05d331ea15c341ca15c341ca15c341da05c341da05c341da05c341da05c341da05c"
  ]
}).map(([id, clips]) => [
      id, clips.map((hex, action) => {
        const bytes = hex.match(/../g).map(pair => parseInt(pair, 16));
        const count = bytes.length / 4;
        const anchor = action === 0 ? bytes.slice(-4) : bytes.slice(0, 4);
        const rows = [];
        rows.anchor = anchor;
        for (let i = 0; i < count; i++) {
          rows.push([i / 30, ...bytes.slice(4*i, 4*i+4)]);
        }
        return rows;
      })
    ]));
    const inspectTracks={
      classic: [[0,117,65,152,96],[1,80,51,144,86],[2,67,63,144,96],[3.1,117,65,152,96]],
      shorty: [[0,117,64,152,96],[0.7,111,12,159,92],[1.8,96,50,158,95],[3.1,117,64,152,96]],
      frenzy: [[0,120,65,152,96],[0.9,120,38,163,61],[1.8,98,79,147,49],[3.1,120,65,152,96]],
      ghost: [[0,118,64,152,96],[0.8,121,19,142,96],[1.9,98,51,159,82],[3.1,118,64,152,96]],
      bandit: [[0,118,65,152,96],[0.8,106,37,158,69],[1.8,90,67,141,92],[3.1,118,65,152,96]],
      sheriff: [[0,116,63,152,96],[0.9,106,29,157,64],[2,100,53,160,91],[3.1,116,63,152,96]],
      stinger: [[0,114,65,152,96],[0.7,104,12,160,93],[1.8,69,60,151,83],[3.1,114,65,152,96]],
      spectre: [[0,112,64,152,96],[0.8,113,12,162,89],[2,60,44,153,80],[3.1,112,64,152,96]],
      bucky: [[0,111,65,152,96],[0.8,23,46,144,91],[1.8,9,27,145,89],[3.1,111,65,152,96]],
      judge: [[0,114,64,152,96],[0.8,17,50,152,85],[2,53,49,155,70],[3.1,114,64,152,96]],
      phantom: [[0,109,63,152,96],[0.8,26,52,151,81],[2,10,40,147,79],[3.1,109,63,152,96]],
      vandal: [[0,110,64,152,96],[0.9,24,51,150,87],[2,20,41,152,80],[3.1,110,64,152,96]],
      marshal: [[0,109,62,152,96],[0.9,18,59,140,83],[1.9,24,49,153,81],[3.1,109,62,152,96]],
      outlaw: [[0,108,62,152,96],[0.8,15,55,135,69],[2,34,41,153,80],[3.1,108,62,152,96]],
      operator: [[0,106,63,152,96],[0.8,12,42,143,86],[2,24,36,149,80],[3.1,106,63,152,96]],
      ares: [[0,103,63,152,96],[0.8,102,16,153,95],[2,33,51,150,89],[3.1,103,63,152,96]],
      odin: [[0,102,62,152,96],[0.8,45,56,145,76],[2,38,58,151,82],[3.1,102,62,152,96]],
      knife:[[0,96,70,145,91],[1,145,43,143,84],[2,92,66,139,75],[3,96,65,143,91]],
      bulldog:[[0,120,62,150,97],[.5,19,52,117,98],[1,26,42,154,88],[2,148,6,132,82],[3,120,62,150,97]],
      guardian:[[0,115,62,152,97],[.5,34,40,154,80],[1.5,19,44,151,90],[2.5,35,20,88,99],[3.5,115,62,152,97]],
      warden:[[0,114,61,153,95],[1,47,36,160,79],[2,19,43,151,91],[3,31,13,89,100],[4,82,76,169,100],[5,114,61,153,95]]
    };
    const forward=new T.Vector3(0,0,-1), direction=new T.Vector3(), correction=new T.Quaternion();
    function readMuzzle(){
      model.updateWorldMatrix(true,false);
      return model.localToWorld(tip.copy(model.userData.muzzle));
    }
    const cameraAxis = new T.Vector3(0,0,1);
    const originTip = new T.Vector3(), desiredTip = new T.Vector3();
    const restAxis = new T.Vector3(), desiredAxis = new T.Vector3();
    const screenRoll = new T.Quaternion();
    function applyCapture(track,time){
      const frame = time*30;
      if(frame<0 || frame>track.length-1+1e-6)return;
      const i=Math.min(track.length-1,Math.floor(frame));
      const a=track[i], b=track[Math.min(i+1,track.length-1)];
      const value=k=>a[k]+(b[k]-a[k])*(frame-i);
      const [x,y,rearX,rearY]=track.anchor;
      const units=2*Math.tan(camera.fov*Math.PI/360)/104;
      originTip.copy(readMuzzle());
      const depth=-originTip.z, rearDepth=depth*.76;
      const u=originTip.x/depth, v=originTip.y/depth;
      const ru=u+(rearX-x)*units, rv=v-(rearY-y)*units;
      restAxis.set(u*depth-ru*rearDepth,v*depth-rv*rearDepth,rearDepth-depth);
      const tu=u+(value(1)-x)*units, tv=v-(value(2)-y)*units;
      const bu=ru+(value(3)-rearX)*units, bv=rv-(value(4)-rearY)*units;
      // Choose the closer rear depth on its camera ray. At full side view,
      // move both endpoints towards the camera to preserve the rigid span.
      const k=1+bu*bu+bv*bv;
      const center=depth*(1+tu*bu+tv*bv)/k;
      const span=restAxis.length();
      desiredAxis.set(tu*depth-bu*center,tv*depth-bv*center,center-depth);
      const closest=desiredAxis.length();
      const factor=closest>span ? span/closest : 1;
      const back=center*factor-Math.sqrt(Math.max(0,span*span-closest*closest)/k);
      desiredTip.set(tu*depth*factor,tv*depth*factor,-depth*factor);
      desiredAxis.set(desiredTip.x-bu*back,desiredTip.y-bv*back,back-depth*factor).normalize();
      const roll=Math.atan2(tv-bv,tu-bu)-Math.atan2(v-rv,u-ru);
      screenRoll.setFromAxisAngle(cameraAxis,roll);
      restAxis.normalize().applyQuaternion(screenRoll);
      correction.setFromUnitVectors(restAxis,desiredAxis).multiply(screenRoll);
      pivot.quaternion.premultiply(correction);
      pivot.position.add(desiredTip.sub(readMuzzle()));
    }
    function applyRecordedInspect(track,time){
      if(track.anchor){applyCapture(track,time);return;}
      const end=track.findIndex(row=>row[0]>=time);
      if(end<=0)return;
      const a=track[end-1], b=track[end], mix=(time-a[0])/(b[0]-a[0]);
      const sample=k=>a[k]+(b[k]-a[k])*mix;
      const dx=sample(1)-sample(3), dy=sample(4)-sample(2);
      const first=track[0], baseAngle=Math.atan2(first[4]-first[2],first[1]-first[3]);
      direction.copy(forward).applyQuaternion(pivot.quaternion);
      const azimuth=Math.atan2(direction.y,direction.x)+Math.atan2(dy,dx)-baseAngle;
      const side=Math.min(1,Math.hypot(direction.x,direction.y)*Math.hypot(dx,dy)/Math.max(1,Math.hypot(first[1]-first[3],first[4]-first[2])));
      readMuzzle();
      const px=tip.x/-tip.z, py=tip.y/-tip.z;
      const target=new T.Vector3(side*Math.cos(azimuth),side*Math.sin(azimuth),-Math.sqrt(1-side*side));
      pivot.quaternion.premultiply(correction.setFromUnitVectors(direction,target));
      readMuzzle();
      const units=2*Math.tan(camera.fov*Math.PI/360)/104;
      pivot.position.x+=(-tip.z)*(px+(sample(1)-first[1])*units)-tip.x;
      pivot.position.y+=(-tip.z)*(py-(sample(2)-first[2])*units)-tip.y;
    }
    api.update=(dt,player,state)=>{
      update(dt,player,state);
      visible=!!(model&&player?.alive&&state?.inMatch);
      if(!visible)return;
      const now=performance.now(), age=(now-inspected)/1000;
      if(startModelDraw){equipped=now;startModelDraw=false;}
      const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
      const aim=Math.max(0,Math.min(1,player.adsProgress||0));
      if(aim>0 || player.adsRequested) interruptInspect();
      const clips=capturedClips[selected];
      const track=clips?.[1] || inspectTracks[selected];
      const lift=(track?0:1-aim)*smooth(age/.34)*(1-smooth((age-2.54)/.38));
      const turn=(track?0:1-aim)*smooth((age-1.12)/.42)*(1-smooth((age-2.48)/.40));
      const equip=Math.min(1,(now-equipped)/duration);
      const draw=clips?0:1-smooth(equip);
      const reloadT=api.isReloading?Math.min(1,(now-reloadStarted)/(1000*(catalog[selected]?.reloadTime||1.1))):1;
      const legacyReload = clips ? 1 : reloadT;
      const liftProgress = legacyReload;
      const liftBarrel = Math.sin(Math.PI * liftProgress) * (1 - liftProgress);
      const dip=smooth(legacyReload/.28)*(1-smooth((legacyReload-.39)/.28));
      const seat=smooth((legacyReload-.34)/.29)*(1-smooth((legacyReload-.73)/.27));
      const shorty=selected==='shorty';
      // Hold the broad side in view, then turn back upright for the second pose.
      const shortyInspect=shorty?lift:0;
      const shortyTurn=shorty?turn:0;
      const shortyReload=shorty?smooth(legacyReload/.22)*(1-smooth((legacyReload-.72)/.28)):0;
      const shot=(now-fired)/1000, kick=selected==='knife'?(shot<.25?Math.sin(Math.PI*Math.min(1,shot/.055)/2)*Math.exp(-shot*18):0):.4*api.getVisualKick(now);
      const move=Math.min(1,Math.hypot(player.vel?.x||0,player.vel?.z||0)/7.6);
      const aspect=innerWidth/Math.max(1,innerHeight);
      if(camera.aspect!==aspect){camera.aspect=aspect;camera.updateProjectionMatrix();}
      // Reference at 23.5–24.5 s: Classic grip sits below and right of the crosshair.
      const pose=poses[selected]||riflePose;
      const frame=framing[selected];
      pivot.scale.setScalar(frame ? frame[2] : pose.scale);
      let offsetX=0, offsetY=0;
      if(frame){
        pivot.rotation.set(.12,pose.yaw??.30,-.06);
        pivot.position.set(pose.right*Math.min(camera.aspect,2.1)/1.78,pose.height,-.54);
        readMuzzle();
        const halfHeight=-tip.z*Math.tan(camera.fov*Math.PI/360);
        offsetX=(frame[0]-.5)*2*(16/9)*halfHeight-tip.x;
        offsetY=(.5-frame[1])*2*halfHeight-tip.y;
      }
      pivot.position.set(pose.right*Math.min(camera.aspect,2.1)/1.78-.013*lift-.087*turn-.033*shortyInspect,
        pose.height+.048*lift-.08*turn-.26*draw-pose.reloadDrop*dip+.015*seat+.003*move*Math.sin(now*.01),
        -.54+.05*lift+.045*kick);
      pivot.position.x+=offsetX;
      pivot.position.y+=offsetY;
      pivot.rotation.set(.12+.30*kick+.20*lift+(selected==='classic'?0:.73*liftBarrel+.48*seat),
        (pose.yaw??.30)+pose.inspectYaw*lift-.45*turn+.16*dip+.25*shortyInspect-.56*shortyTurn,-.06-.24*lift-pose.turnRoll*turn-pose.reloadRoll*dip-.22*seat-.47*shortyReload);
      if(selected==='knife'){
        const slash=Math.sin(Math.PI*Math.min(1,shot/.33))**2;
        pivot.position.x-=.20*slash+.045*lift;
        pivot.rotation.y+=.37*turn;
        pivot.rotation.x-=.25*turn;
        pivot.rotation.z+=1.14*slash;
      } else if(catalog[selected]?.canScope){
        pivot.rotation.y+=.32*turn;
        pivot.position.z+=.045*lift;
        pivot.rotation.z-=.22*lift;
        const ads=smooth(aim);
        pivot.rotation.x*=1-ads;
        pivot.rotation.y*=1-ads;
        pivot.rotation.z*=1-ads;
        pivot.position.z+=.075*ads;
        // Align the actual model tip with the sight line in the overlay camera.
        readMuzzle();
        pivot.position.x-=tip.x*ads;
        const sightDrop=-tip.z*Math.tan(camera.fov*Math.PI/360)*.055;
        pivot.position.y-=(tip.y+sightDrop)*ads;
      }
      if(aim===0){
        if(clips && api.isReloading)applyRecordedInspect(clips[2],reloadT*clips[2].at(-1)[0]);
        else if(track && Number.isFinite(inspected))applyRecordedInspect(track,age);
        else if(clips && equip<1)applyRecordedInspect(clips[0],Math.max(0,equip)*clips[0].at(-1)[0]);
      }
      if(model===releaseModel && now-releaseTime<150){
        const remaining=1-smooth((now-releaseTime)/150);
        pivot.position.lerp(releasePosition,remaining);
        pivot.quaternion.slerp(releaseRotation,remaining);
      }
      const photo=document.querySelector('#fps-weapon-sprite-layer .fps-paper-weapon');
      if(photo)photo.style.opacity='0';
      const flash=photo?.nextElementSibling;
      if(flash && now-fired<135){
        const muzzle=projectTip();
        flash.style.left=muzzle.x+'px';
        flash.style.top=muzzle.y+'px';
      }
    };
    const spriteScreen=api.getMuzzleScreenPosition, spriteWorld=api.getMuzzleWorldPosition;
    const tip=new T.Vector3();
    function projectTip(){
      readMuzzle();
      const depth=-tip.z;
      tip.project(camera);
      return {x:(tip.x+1)*innerWidth/2,y:(1-tip.y)*innerHeight/2,depth};
    }
    api.getMuzzleScreenPosition=()=>visible&&model?projectTip():spriteScreen();
    api.getMuzzleWorldPosition=worldCamera=>{
      if(!visible||!model||!worldCamera)return spriteWorld(worldCamera);
      const {depth}=projectTip();
      worldCamera.updateWorldMatrix(true,false);
      const ray=new T.Vector3(tip.x,tip.y,.5).unproject(worldCamera);
      worldCamera.worldToLocal(ray);
      return worldCamera.localToWorld(ray.multiplyScalar(-depth/ray.z));
    };
    api.renderModel=renderer=>{
      if(!visible)return;
      const clear=renderer.autoClear;
      renderer.autoClear=false;
      try {renderer.clearDepth();renderer.render(scene,camera);}
      finally {renderer.autoClear=clear;}
    };
    return api;
  };
})();
