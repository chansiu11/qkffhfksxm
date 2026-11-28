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
  const {create:createSprite,referenceImages,sourceSize,styles}=window.WeaponViewmodels;
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
  // Height/depth fractions measured on each model for the right and support hands, then hand scale.
  const gripProfiles={
    knife:[0.648,0.258,0.522,0.786,0.720],
    classic:[0.356,0.181,0.633,0.695,0.700],
    shorty:[0.289,0.090,0.544,0.629,0.710],
    frenzy:[0.422,0.143,0.611,0.652,0.690],
    ghost:[0.333,0.076,0.567,0.614,0.690],
    bandit:[0.378,0.200,0.633,0.614,0.690],
    sheriff:[0.322,0.119,0.567,0.619,0.690],
    stinger:[0.400,0.376,0.644,0.748,0.750],
    spectre:[0.389,0.267,0.644,0.619,0.740],
    bucky:[0.367,0.262,0.500,0.681,0.790],
    judge:[0.300,0.229,0.500,0.714,0.790],
    bulldog:[0.333,0.252,0.622,0.657,0.760],
    guardian:[0.256,0.267,0.644,0.652,0.770],
    phantom:[0.278,0.286,0.656,0.667,0.770],
    warden:[0.300,0.276,0.644,0.638,0.770],
    vandal:[0.344,0.295,0.667,0.662,0.770],
    marshal:[0.300,0.352,0.467,0.624,0.760],
    outlaw:[0.333,0.286,0.522,0.605,0.770],
    operator:[0.244,0.205,0.456,0.576,0.770],
    ares:[0.289,0.257,0.533,0.676,0.790],
    odin:[0.311,0.267,0.600,0.648,0.800]
  };
  const poses = {
    classic: {scale:.40, right:.168, height:-.143, inspectYaw:.95, turnRoll:1.04, reloadDrop:.25, reloadRoll:.54},
    shorty:  {scale:.73, right:.146, height:-.143, inspectYaw:.95, turnRoll:1.04, reloadDrop:.12, reloadRoll:.54},
    frenzy:  {scale:.55, right:.156, height:-.157, inspectYaw:.84, turnRoll:.73, reloadDrop:.17, reloadRoll:.38},
    ghost:   {scale:.66, right:.151, height:-.148, inspectYaw:1.12, turnRoll:.82, reloadDrop:.18, reloadRoll:.51},
    bandit:  {scale:.52, right:.163, height:-.145, inspectYaw:1.02, turnRoll:.94, reloadDrop:.16, reloadRoll:.46},
    sheriff: {scale:.61, right:.154, height:-.155, inspectYaw:1.21, turnRoll:.62, reloadDrop:.12, reloadRoll:.86}
  };
  const riflePose={scale:1.04,right:.17,height:-.15,inspectYaw:.85,turnRoll:.66,reloadDrop:.17,reloadRoll:.47};
  function reloadMotion(id,slot){
    if(id==='sheriff')return {reach:.22,back:.64,dip:.21,pitch:.52,roll:.46,drop:.036};
    if(id==='shorty'||id==='bucky')return {reach:.16,back:.77,dip:.17,pitch:.45,roll:.28,drop:.032};
    if(id==='marshal'||id==='outlaw'||id==='operator')return {reach:.17,back:.75,dip:.24,pitch:.48,roll:.27,drop:.040};
    if(id==='odin'||id==='ares'||id==='judge')return {reach:.21,back:.70,dip:.28,pitch:.32,roll:.43,drop:.044};
    return slot==='secondary'
      ? {reach:.15,back:.66,dip:.18,pitch:.40,roll:.29,drop:.022}
      : {reach:.18,back:.68,dip:.23,pitch:.36,roll:.35,drop:.035};
  }
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
      const timer=setTimeout(()=>{tag.remove();reject(new Error('Loader timeout: '+src));},12000);
      tag.src=src;
      tag.onload=()=>{clearTimeout(timer);resolve();};
      tag.onerror=()=>{clearTimeout(timer);tag.remove();reject(new Error('Loader unavailable: '+src));};
      document.head.appendChild(tag);
    });
  }
  async function loadModel(id, T) {
    dependencies ||= script('vendor/fflate-0.6.9.min.js')
      .then(() => script('vendor/FBXLoader-r128.js'))
      .then(()=>{
        if(!window.fflate?.unzipSync||!T.FBXLoader)throw new Error('3D model loaders did not initialize');
      });
    try { await dependencies; } catch(error){ dependencies=null; throw error; }
    const objective=id==='spikeFolded'||id==='spikeOpen';
    const objectiveArchive=objective?'refs/classic/Meshy_AI_'+(id==='spikeFolded'?'Armored_Teapot_Tank':'Frostspire_Beacon')+'_20261126_texture_fbx.zip':null;
    const archive = objectiveArchive || heldOnlyArchives[id] || 'refs/classic/Meshy_AI_' + files[id] + (id==='knife'||id==='guardian'?'_20261126':'_20261125') + '_texture_fbx' + (id === 'classic' ? ' (1)' : '') + '.zip';
    const response=await fetch(archive,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}: ${archive}`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    const entries=fflate.unzipSync(bytes);
    const names = Object.keys(entries);
    const fbx=entries[names.find(n=>/\.fbx$/i.test(n))];
    if(!fbx)throw new Error('FBX missing: '+archive);
    const mesh=new T.FBXLoader(new T.LoadingManager()).parse(fbx.buffer.slice(fbx.byteOffset,fbx.byteOffset+fbx.byteLength),'');
    removeLabelBands(mesh,id,T);
    if(Object.hasOwn(heldOnlyArchives,id))removeDetachedDecorations(mesh,T,id==='stinger');
    const textureName=names.find(n=>/_texture\.png$/i.test(n))||names.find(n=>/\.(?:png|jpe?g|webp)$/i.test(n));
    let texture=null;
    if(textureName){
      const url=URL.createObjectURL(new Blob([entries[textureName]]));
      try {texture=await new T.TextureLoader().loadAsync(url);texture.encoding=T.sRGBEncoding;}
      catch(error){console.warn('Model texture unavailable:',id,error);}
      finally {URL.revokeObjectURL(url);}
    }
    if(!textureName||!texture)console.warn('Using untextured model:',id);
    const material=new T.MeshStandardMaterial({map:texture,color:texture?0xffffff:0x64717e,roughness:.57,metalness:.18});
    mesh.traverse(node => { if (node.isMesh) node.material = material; });
    const body = new T.Group();
    body.add(mesh);
    const box = new T.Box3().setFromObject(body), size = box.getSize(new T.Vector3());
    mesh.position.sub(box.getCenter(new T.Vector3()));
    if(objective){body.scale.setScalar(1/Math.max(size.x,size.y,size.z));return body;}
    if (size.x > size.z) body.rotation.y = Math.PI / 2;
    body.scale.setScalar(.52 / Math.max(size.x,size.y,size.z));
    body.userData.viewScale=body.scale.x;
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
    const grip=bounds.getCenter(new T.Vector3());
    grip.y-=.20*(bounds.max.y-bounds.min.y);
    grip.z+=.30*(bounds.max.z-bounds.min.z);
    body.userData.inspectGrip=body.worldToLocal(grip);
    const span=bounds.getSize(new T.Vector3());
    const mid=bounds.getCenter(new T.Vector3());
    const pistol=styles[id]?.kind==='pistol'||styles[id]?.kind==='revolver'||id==='frenzy';
    const short=id==='shorty';
    const blade=id==='knife';
    const bullpup=id==='bulldog'||id==='phantom';
    const heavy=['judge','ares','odin'].includes(id);
    const point=(height,depth)=>body.worldToLocal(new T.Vector3(mid.x,bounds.min.y+span.y*height,bounds.max.z-span.z*depth));
    const holdHeight=blade?.49:pistol?.36:short?.30:heavy?.34:.35;
    const hold=point(holdHeight,blade?.21:pistol?.20:short?.21:bullpup?.36:.29);
    const profile=gripProfiles[id];
    if(profile)hold.copy(point(profile[0],profile[1]));
    else if(!blade){
      const y=bounds.min.y+span.y*holdHeight;
      const points=[];
      mesh.traverse(node=>{
        if(!node.isMesh)return;
        const a=node.geometry.attributes.position;
        for(let i=0;i<a.count;i++){
          p.fromBufferAttribute(a,i).applyMatrix4(node.matrixWorld);
          if(Math.abs(p.y-y)<=span.y*.031)points.push(p.z);
        }
      });
      points.sort((a,b)=>a-b);
      const groups=[];
      let begin=0;
      for(let end=1;end<=points.length;end++){
        if(end<points.length&&points[end]-points[end-1]<span.z*.019)continue;
        if(end-begin>=Math.max(12,points.length*.035)&&points[end-1]-points[begin]>span.z*.012)
          groups.push([points[begin],points[end-1]]);
        begin=end;
      }
      const rear=groups.at(-1);
      if(rear)hold.copy(body.worldToLocal(new T.Vector3(mid.x,y,(rear[0]+rear[1])/2)));
    }
    body.userData.handAnchors={
      hold,
      support:profile?point(profile[2],profile[3]):point(heavy?.59:.62,bullpup?.66:short?.64:.68),
      reload:point(.28,heavy?.48:bullpup?.26:.43),
      gripSize:profile?.[4]??(blade?.68:pistol?.70:short?.72:heavy?.82:.76)
    };
    body.userData.inspectCorners=[];
    for(const x of [bounds.min.x,bounds.max.x])
      for(const y of [bounds.min.y,bounds.max.y])
        for(const z of [bounds.min.z,bounds.max.z])
          body.userData.inspectCorners.push(body.worldToLocal(new T.Vector3(x,y,z)));
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
    let rightHand,leftHand;
    const leftContact=new T.Vector3(), leftRelease=new T.Vector3(), bladePosition=new T.Vector3();
    const gripAxis=new T.Vector3(), gripRadial=new T.Vector3(), gripCross=new T.Vector3(), gripOffset=new T.Vector3();
    const gripBasis=new T.Matrix4(), inverseFrame=new T.Quaternion(), carryRotation=new T.Quaternion();
    const handFacing=new T.Vector3(), targetFacing=new T.Vector3(), fingerDirection=new T.Vector3();
    const handSide=new T.Vector3(), rollCorrection=new T.Quaternion();
    const wristSocket=new T.Vector3(), armDirection=new T.Vector3(), armNormal=new T.Vector3();
    const armCross=new T.Vector3(), armScale=new T.Vector3(), takeoff=new T.Vector3();
    const armStretch=new T.Matrix4();
    const editMove=new T.Vector3(),editTurn=new T.Quaternion(),editAngles=new T.Euler(),editMatrix=new T.Matrix4();
    const editScale=new T.Vector3(1,1,1),editPivot=new T.Vector3(),editWrist=new T.Vector3();
    const heldPoses=new Map();
    let modelParts, defaultHands, previewEdits, showSupport;
    api.setPreviewEdits=(edits,support=false)=>{previewEdits=edits;showSupport=support;};
    const activeEdits=()=>previewEdits??heldPoses.get(selected)?.edits;
    api.setHeldPose=(id,edits,hands)=>{
      heldPoses.set(id,{edits,hands});
      if(selected===id)attachSelectedHands();
    };
    function readEdit(values,scale=1){
      editMove.set(values[0],values[1],values[2]).multiplyScalar(scale);
      editAngles.set(...values.slice(3,6).map(T.MathUtils.degToRad));
      editTurn.setFromEuler(editAngles);
      editScale.setScalar(values[6]??1);
    }
    function editHand(hand,key){
      const values=activeEdits()?.[key];
      if(!values)return;
      readEdit(values);
      editWrist.copy(hand.userData.wrist).multiply(hand.scale);
      editPivot.copy(editWrist).applyQuaternion(hand.quaternion);
      hand.quaternion.multiply(editTurn);
      hand.scale.multiply(editScale);
      editWrist.multiply(editScale);
      editPivot.sub(editWrist.applyQuaternion(hand.quaternion));
      hand.position.add(editPivot).add(editMove);
    }
    function splitEditableModel(body,knife){
      body.updateWorldMatrix(true,true);
      const inverse=body.matrixWorld.clone().invert();
      const source=[];
      body.traverse(object=>{if(object.isMesh)source.push(object);});
      const keys=knife?['blade','guard','handle']:['front','body','grip'];
      const groups=Object.fromEntries(keys.map(key=>[key,new T.Group()]));
      const bounds=Object.keys(groups).map(()=>new T.Box3());
      const point=new T.Vector3(),center=new T.Vector3();
      const extents=new T.Box3();
      for(const corner of body.userData.inspectCorners)
        extents.expandByPoint(point.copy(corner).applyQuaternion(body.quaternion).multiplyScalar(body.scale.x));
      for(const mesh of source){
        const toBody=inverse.clone().multiply(mesh.matrixWorld);
        const vertices=mesh.geometry.attributes.position;
        const index=mesh.geometry.index;
        const indices=bounds.map(()=>[]);
        for(let i=0;i<(index?.count??vertices.count);i+=3){
          const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
          center.set(0,0,0);
          for(const vertex of [a,b,c])center.add(point.fromBufferAttribute(vertices,vertex));
          center.multiplyScalar(1/3).applyMatrix4(toBody).applyQuaternion(body.quaternion).multiplyScalar(body.scale.x);
          // Longitudinal limits measured along the displayed knife, in model-view units.
          const zone=knife?(center.z<.032?0:center.z<.082?1:2):
            center.y<extents.min.y+(extents.max.y-extents.min.y)*.42&&center.z>extents.min.z+(extents.max.z-extents.min.z)*.43?2:
            center.z<extents.min.z+(extents.max.z-extents.min.z)*.38?0:1;
          indices[zone].push(a,b,c);
          for(const vertex of [a,b,c])bounds[zone].expandByPoint(point.fromBufferAttribute(vertices,vertex).applyMatrix4(toBody));
        }
        Object.values(groups).forEach((group,zone)=>{
          if(!indices[zone].length)return;
          const geometry=mesh.geometry.clone();
          geometry.setIndex(indices[zone]);
          geometry.clearGroups();
          const fragment=new T.Mesh(geometry,mesh.material);
          fragment.matrixAutoUpdate=false;
          fragment.matrix.copy(toBody);
          group.add(fragment);
        });
        mesh.visible=false;
      }
      const weapon=new T.Group();
      body.add(weapon);
      Object.values(groups).forEach((group,zone)=>{
        if(!group.children.length)return;
        bounds[zone].getCenter(group.position);
        group.userData.rest=group.position.clone();
        for(const mesh of group.children)mesh.matrix.setPosition(point.setFromMatrixPosition(mesh.matrix).sub(group.position));
        weapon.add(group);
      });
      groups.weapon=weapon;
      weapon.userData.rest=new T.Vector3();
      return groups;
    }
    function editWeapon(){
      const edits=activeEdits();
      if(!edits)return;
      modelParts??=splitEditableModel(model,selected==='knife');
      for(const [key,part] of Object.entries(modelParts)){
        if(!part.userData.rest)continue;
        part.position.copy(part.userData.rest);
        part.quaternion.identity();
        part.scale.setScalar(1);
        if(!edits[key])continue;
        readEdit(edits[key],1/model.scale.x);
        part.position.add(editMove);
        part.quaternion.copy(editTurn);
        part.scale.copy(editScale);
      }
    }
    function aimForearm(hand,side){
      const arm=hand.forearm;
      if(!arm)return;
      hand.updateWorldMatrix(true,false);
      hand.localToWorld(wristSocket.copy(hand.userData.wrist));
      hand.getWorldScale(armScale);
      // Start just inside the wrist so the cuff covers the seam on both hands.
      hand.getWorldQuaternion(rollCorrection);
      arm.position.copy(wristSocket).addScaledVector(armNormal.copy(hand.userData.palmDirection).applyQuaternion(rollCorrection),.014);
      takeoff.set(side*(.31*camera.aspect),side===1?-.37:-.33,-.37);
      const extension=T.MathUtils.clamp(takeoff.distanceTo(arm.position)/(arm.userData.length*armScale.x),1,2.3)-1;
      armDirection.copy(takeoff).sub(wristSocket).normalize();
      armNormal.copy(arm.userData.normal).applyQuaternion(rollCorrection);
      armNormal.addScaledVector(armDirection,-armNormal.dot(armDirection)).normalize();
      armCross.crossVectors(armDirection,armNormal);
      gripBasis.makeBasis(armDirection,armNormal,armCross);
      arm.quaternion.setFromRotationMatrix(gripBasis);
      armDirection.copy(arm.userData.axis);
      armNormal.copy(arm.userData.normal).addScaledVector(armDirection,-arm.userData.normal.dot(armDirection)).normalize();
      armCross.crossVectors(armDirection,armNormal);
      inverseFrame.setFromRotationMatrix(gripBasis.makeBasis(armDirection,armNormal,armCross)).invert();
      arm.quaternion.multiply(inverseFrame);
      arm.scale.copy(armScale);
      const {x,y,z}=arm.userData.axis;
      const thickness=side===1?.78:.87;
      const axial=1+extension-thickness;
      armStretch.set(
        thickness+axial*x*x,axial*x*y,axial*x*z,0,
        axial*x*y,thickness+axial*y*y,axial*y*z,0,
        axial*x*z,axial*y*z,thickness+axial*z*z,0,
        0,0,0,1
      );
      arm.updateMatrix();
      arm.matrix.multiply(armStretch);
      const values=activeEdits()?.[side===1?'forearmL':'forearmR'];
      if(values){
        readEdit(values);
        arm.matrix.multiply(editMatrix.compose(editMove,editTurn,editScale));
      }
      arm.visible=true;
    }
    const reloadRotation=new T.Quaternion(), reloadEuler=new T.Euler();
    function fitGrip(hand,contact,size,ax,ay,az,rx,ry,rz) {
      gripAxis.set(ax,ay,az).normalize();
      gripRadial.set(rx,ry,rz).addScaledVector(gripAxis,-(rx*gripAxis.x+ry*gripAxis.y+rz*gripAxis.z)).normalize();
      gripCross.crossVectors(gripAxis,gripRadial).normalize();
      gripBasis.makeBasis(gripRadial,gripCross,gripAxis);
      inverseFrame.copy(hand.userData.gripFrame).invert();
      hand.quaternion.setFromRotationMatrix(gripBasis).multiply(inverseFrame);
      hand.scale.setScalar(size);
      gripOffset.copy(hand.userData.gripCenter).multiplyScalar(size).applyQuaternion(hand.quaternion);
      hand.position.copy(contact).sub(gripOffset);
    }
    function fitKnifeHand(hand,contact,size) {
      fitGrip(hand,contact,size,0,0,-1,.85,-.52,0);
      handFacing.copy(hand.userData.palmNormal).applyQuaternion(hand.quaternion);
      handFacing.addScaledVector(gripAxis,-handFacing.dot(gripAxis)).normalize();
      targetFacing.set(.62,-.78,0).normalize();
      const sin=gripCross.crossVectors(handFacing,targetFacing).dot(gripAxis);
      const cos=handFacing.dot(targetFacing);
      hand.quaternion.premultiply(rollCorrection.setFromAxisAngle(gripAxis,Math.atan2(sin,cos)));
      gripOffset.copy(hand.userData.gripCenter).multiplyScalar(size).applyQuaternion(hand.quaternion);
      hand.position.copy(contact).sub(gripOffset);
    }
    function faceFreeKnifeHand(hand,slash,inspect) {
      const normal=hand.userData.palmNormal, fingers=hand.userData.palmDirection;
      handSide.crossVectors(fingers,normal).normalize();
      gripBasis.makeBasis(fingers,normal,handSide);
      inverseFrame.setFromRotationMatrix(gripBasis).invert();
      targetFacing.set(.47+.09*slash,-.76,-.44-.05*inspect).normalize();
      fingerDirection.set(.56+.14*slash,.71,-.44);
      fingerDirection.addScaledVector(targetFacing,-fingerDirection.dot(targetFacing)).normalize();
      handSide.crossVectors(fingerDirection,targetFacing);
      gripBasis.makeBasis(fingerDirection,targetFacing,handSide);
      hand.quaternion.setFromRotationMatrix(gripBasis).multiply(inverseFrame);
    }
    api.setHands=(right,left)=>{
      defaultHands=[right,left];
      attachSelectedHands();
    };
    function attachSelectedHands(){
      if(!defaultHands)return;
      const [right,left]=heldPoses.get(selected)?.hands??defaultHands;
      rightHand?.parent?.remove(rightHand);
      leftHand?.parent?.remove(leftHand);
      rightHand?.forearm?.parent?.remove(rightHand.forearm);
      leftHand?.forearm?.parent?.remove(leftHand.forearm);
      rightHand=right;
      leftHand=left;
      for(const hand of [rightHand,leftHand]){
        if(!hand.forearm)continue;
        hand.forearm.visible=false;
        scene.add(hand.forearm);
      }
      // The free knife hand belongs to the overlay camera, independent of blade rotation.
      scene.add(leftHand);
      leftHand.visible=false;
    }
    function relaxHand(hand,amount,knifeGrip=0){
      for(const part of hand.children){
        const weights=part.morphTargetInfluences;
        if(!weights)continue;
        weights[0]=amount;
        if(weights.length>1)weights[1]=knifeGrip;
      }
    }
    function weaponPoint(target,local){
      return target.copy(local).multiply(model.scale).applyQuaternion(model.quaternion).add(model.position);
    }
    const ease=value=>{
      const t=T.MathUtils.clamp(value,0,1);
      return t*t*(3-2*t);
    };
    function syncHands({reloadT,draw,aim,age,shot,stride}){
      if(!rightHand||!leftHand||!model?.userData.inspectGrip)return;
      if(rightHand.parent!==pivot)pivot.add(rightHand);
      const {inspectGrip,muzzle,handAnchors}=model.userData;
      const grip=handAnchors?.hold||inspectGrip;
      const knife=selected==='knife', pistol=catalog[selected]?.slot==='secondary'&&selected!=='shorty';
      const modelScale=model.scale.x/(model.userData.viewScale||model.scale.x);
      const size=(handAnchors?.gripSize??.74)*modelScale*(pistol?1.09:1);
      const inspect=Number.isFinite(age)?ease(age/.24)*(1-ease((age-2.55)/.33)):0;
      const slash=knife&&shot>=0&&shot<.38?Math.sin(Math.PI*shot/.38)**2:0;
      weaponPoint(leftContact,grip);
      if(knife)fitKnifeHand(rightHand,leftContact,size);
      else fitGrip(rightHand,leftContact,size,0,1,pistol?-.25:-.12,.39,-.42,.84);
      rightHand.visible=true;
      relaxHand(rightHand,0,knife?1:0);

      const motion=reloadMotion(selected,catalog[selected]?.slot);
      const offGun=ease((reloadT-.06)/motion.reach)*(1-ease((reloadT-motion.back)/(1-motion.back)));
      leftHand.visible=knife||!pistol||offGun>.04;
      if(knife){
        if(leftHand.parent!==scene)scene.add(leftHand);
        bladePosition.set(-.208*Math.min(camera.aspect,2.1)/1.78+.032*slash+.016*inspect,
          -.145-.19*draw-.052*slash+.004*stride-.069*inspect,-.49+.024*inspect-.038*slash);
        leftHand.position.copy(bladePosition);
        faceFreeKnifeHand(leftHand,slash,inspect);
        leftHand.scale.setScalar(.59);
        relaxHand(leftHand,.97-.33*slash);
        editHand(rightHand,'handL');
        editHand(leftHand,'handR');
        editWeapon();
        aimForearm(rightHand,1);
        aimForearm(leftHand,-1);
        return;
      }
      if(rightHand.forearm)rightHand.forearm.visible=false;
      if(leftHand.forearm)leftHand.forearm.visible=false;
      if(leftHand.parent!==pivot)pivot.add(leftHand);
      const support=handAnchors?.support||muzzle;
      weaponPoint(leftContact,support);
      if(!handAnchors)leftContact.lerp(rightHand.position,.61);
      leftContact.y-=.016*modelScale;
      const loading=handAnchors?.reload||grip;
      weaponPoint(leftRelease,loading);
      // Travel below the receiver before coming back up to the support point.
      const travel=ease((reloadT-.11)/motion.reach)*(1-ease((reloadT-.40)/.23));
      leftRelease.x-=(.037+.055*travel)/pivot.scale.x;
      leftRelease.y-=(.012+motion.dip*.22*travel)/pivot.scale.x;
      leftRelease.z+=(.012+.024*travel)/pivot.scale.x;
      fitGrip(leftHand,leftContact,size*.97,0,0,-1,-.63,-.77,0);
      if(pistol||offGun>.001){
        carryRotation.copy(leftHand.quaternion);
        reloadEuler.set(.81-.11*aim,Math.PI-.56,.70);
        reloadRotation.setFromEuler(reloadEuler);
        const release=pistol?1:offGun;
        leftHand.position.lerp(leftRelease,release);
        leftHand.quaternion.copy(carryRotation).slerp(reloadRotation,release);
      }
      relaxHand(leftHand,Math.max(travel*.66,.18*inspect*offGun));
      if(activeEdits()){
        leftHand.visible ||= showSupport||heldPoses.has(selected);
        editHand(rightHand,'handL');
        editHand(leftHand,'handR');
        editWeapon();
        aimForearm(rightHand,1);
        if(leftHand.visible)aimForearm(leftHand,-1);
      }
    }
    let duration=750, reloadStarted=0, startModelDraw=false, stridePhase=0;
    function getModel(id){
      if(!cache.has(id))cache.set(id,loadModel(id,T).catch(err=>{
        if(id==='knife'){
          const blade=new T.Group();
          const add=(geometry,color,z)=>{
            const part=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.43}));
            part.position.z=z;blade.add(part);
          };
          add(new T.BoxGeometry(.038,.035,.13),0x343a43,.04);
          add(new T.BoxGeometry(.054,.034,.017),0x667680,-.025);
          add(new T.BoxGeometry(.036,.014,.17),0x9aa9b2,-.114);
          blade.userData.inspectGrip=new T.Vector3(0,0,.046);
          blade.userData.muzzle=new T.Vector3(0,0,-.199);
          blade.userData.handAnchors={hold:new T.Vector3(0,0,.046),gripSize:.68};
          blade.userData.viewScale=1;
          blade.userData.inspectCorners=[];
          return blade;
        }
        cache.delete(id);throw err;
      }));
      return cache.get(id);
    }
    api.remoteModel=async id=>{
      if(!hasHeldModel(id)&&id!=='spikeFolded'&&id!=='spikeOpen')return null;
      const asset=await getModel(id);
      return asset?.clone(true);
    };
    api.preloadJobs=()=>[...Object.keys(files),...Object.keys(heldOnlyArchives)].map(id=>({id,load:()=>getModel(id)}));
    // Cosmetic scene props reuse existing resources and never affect simulation.
    // Canon model lengths in world metres; newer guns use category estimates.
    const droppedLength={"classic":0.30920000000000003,"shorty":0.69,"frenzy":0.4089,"ghost":0.654,"bandit":0.37,"sheriff":0.4253,"stinger":0.8449,"spectre":0.9802,"bucky":1.23,"judge":0.9822,"bulldog":0.8951,"guardian":1.3955000000000002,"warden":1.33,"phantom":1.2111,"vandal":1.2799,"marshal":1.5405000000000002,"outlaw":1.59,"operator":1.7225,"ares":1.5528,"odin":1.7404};
    api.createGroundDisplay=(id,group)=>{
      if(!Object.hasOwn(referenceImages,id)||!sourceSize[id])return;
      let active=true, sprite=null, clone=null;
      const [w,h]=sourceSize[id];
      const texture=new T.TextureLoader().load('assets/weapons/'+referenceImages[id]+'.webp',tex=>{
        if(!active){tex.dispose();return;}
        tex.encoding=T.sRGBEncoding;
      },undefined,()=>{});
      const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:T.DoubleSide});
      const length=droppedLength[id]??.85;
      const geometry=new T.PlaneGeometry(length,length*h/w);
      sprite=new T.Mesh(geometry,material);sprite.rotation.x=-Math.PI/2;
      group.add(sprite);
      if(hasHeldModel(id))getModel(id).then(asset=>{
        if(!active||!asset)return;
        // Rotate the display as a whole so the broad side faces up.
        const side=new T.Group();side.rotation.z=Math.PI/2;
        clone=asset.clone(true);side.add(clone);
        const size=new T.Box3().setFromObject(side).getSize(new T.Vector3());
        const extent=Math.max(size.x,size.z);
        if(!(extent>0) || !Number.isFinite(extent))return;
        side.scale.setScalar(length/extent);
        group.add(side);
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
      modelParts?.weapon.traverse(part=>{if(part.isMesh)part.geometry.dispose();});
      modelParts=null;
      pivot.clear(); model=null; visible=false;
      attachSelectedHands();
      if(!hasHeldModel(id))return;
      getModel(id).then(asset=>{
        if(!asset||selected!==id)return;
        // Keep the cached model intact if a held pose is registered after equip.
        model=asset.clone(true);
        model.userData=asset.userData;
        if(id==='knife'){
          model.rotateOnWorldAxis(screenAxis,Math.PI);
        }
        pivot.add(model);
      }).catch(err=>console.warn('Weapon model',id,err));
    }
    const set=api.setWeapon, update=api.update, fire=api.fire, inspect=api.inspect, reload=api.beginReload;
    let modelLoadingEnabled=false;
    api.enableModelLoading=()=>{modelLoadingEnabled=true;select(api.current);};
    api.setWeapon=(id,time)=>{set(id,time);duration=(time??catalog[id]?.equipTime??.75)*1000;if(modelLoadingEnabled)select(api.current);};
    api.hasRenderedModel=id=>visible && selected===id && !!model;
    const releasePosition=new T.Vector3(),releaseRotation=new T.Quaternion();
    let releaseTime=-Infinity,releaseModel=null;
    function interruptInspect(){
      if(Number.isFinite(inspected) && model && performance.now()-inspected<=gunInspectDuration*1000){
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
    function readMuzzle(){
      model.updateWorldMatrix(true,false);
      return model.localToWorld(tip.copy(model.userData.muzzle));
    }
    const gripBefore=new T.Vector3(), gripAfter=new T.Vector3();
    const inspectCorner=new T.Vector3(), screenAxis=new T.Vector3(0,0,1);
    const tiltRotation=new T.Quaternion();
    const gunInspectDuration=3;
    function easeInspect(t){
      t=Math.max(0,Math.min(1,t));
      return t*t*(3-2*t);
    }
    function applySideInspect(time){
      if(time<0 || time>=gunInspectDuration)return;
      const blade=selected==='knife';
      const small=catalog[selected]?.slot==='secondary';
      const first=easeInspect(time/(blade?.55:.48));
      const turn=easeInspect((time-1.00)/.62);
      const finish=easeInspect((time-2.48)/.52);
      const baseYaw=pivot.rotation.y;
      const side=Math.PI*(blade?.26:.36);
      const nextYaw=blade?.66:-side*.86;
      const yaw=baseYaw+(side-baseYaw)*first+(nextYaw-side)*turn+(baseYaw-nextYaw)*finish;
      model.updateWorldMatrix(true,false);
      const hold=model.userData.handAnchors?.hold||model.userData.inspectGrip;
      model.localToWorld(gripBefore.copy(hold));
      pivot.rotation.y=yaw;
      // Roll in camera space so the muzzle rises on both opposite-facing poses.
      const tilt=(blade?(-38*first+57*turn-19*finish):(-16*first+39*turn-23*finish))*Math.PI/180;
      pivot.quaternion.premultiply(tiltRotation.setFromAxisAngle(screenAxis,tilt));
      const presentation=first-finish;
      pivot.scale.multiplyScalar(1+(blade?.17:small?.22:.07)*presentation);
      model.updateWorldMatrix(true,false);
      model.localToWorld(gripAfter.copy(hold));
      pivot.position.add(gripBefore.sub(gripAfter));
      pivot.position.x-=(blade?.009:small?.042:.073)*presentation;
      pivot.position.y+=(blade?.087:small?.071:.082)*presentation;
      model.updateWorldMatrix(true,false);
      const h=.90*Math.tan(camera.fov*Math.PI/360), w=h*camera.aspect;
      let left=-Infinity,right=Infinity,bottom=-Infinity,top=Infinity;
      for(const corner of model.userData.inspectCorners){
        const p=model.localToWorld(inspectCorner.copy(corner));
        left=Math.max(left,p.z*w-p.x);
        right=Math.min(right,-p.z*w-p.x);
        bottom=Math.max(bottom,p.z*h-p.y);
        top=Math.min(top,-p.z*h-p.y);
      }
      const back=Math.max(0,(left-right)/(2*w),(bottom-top)/(2*h));
      const weight=first-finish;
      pivot.position.x+=weight*Math.max(left-back*w,Math.min(0,right+back*w));
      pivot.position.y+=weight*Math.max(bottom-back*h,Math.min(0,top+back*h));
      pivot.position.z-=weight*back;
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
      const equip=Math.min(1,(now-equipped)/duration);
      const knife=selected==='knife', pistol=catalog[selected]?.slot==='secondary'&&selected!=='shorty';
      const draw=(1-smooth(equip/(knife?.68:pistol?.77:.84)))**1.45;
      const settle=Math.sin(Math.PI*smooth((equip-.49)/.51))*smooth((equip-.47)/.20)*(1-draw);
      const reloadT=api.isReloading?Math.min(1,(now-reloadStarted)/(1000*(catalog[selected]?.reloadTime||1.1))):1;
      const liftProgress = reloadT;
      const liftBarrel = Math.sin(Math.PI * liftProgress) * (1 - liftProgress);
      const dip=smooth(reloadT/.28)*(1-smooth((reloadT-.39)/.28));
      const seat=smooth((reloadT-.34)/.29)*(1-smooth((reloadT-.73)/.27));
      const shorty=selected==='shorty';
      // Hold the broad side in view, then turn back upright for the second pose.
      const shortyReload=shorty?smooth(reloadT/.22)*(1-smooth((reloadT-.72)/.28)):0;
      const loading=reloadMotion(selected,catalog[selected]?.slot);
      const shot=(now-fired)/1000, kick=selected==='knife'?(shot<.25?Math.sin(Math.PI*Math.min(1,shot/.055)/2)*Math.exp(-shot*18):0):.4*api.getVisualKick(now);
      const move=Math.min(1,Math.hypot(player.vel?.x||0,player.vel?.z||0)/7.6);
      stridePhase=(stridePhase+Math.min(.05,Math.max(0,dt))*(3+move*8))%(Math.PI*2);
      const stride=Math.sin(stridePhase)*move*(1-.65*aim);
      const sway=Math.sin(stridePhase*.5)*move*(1-aim);
      const aspect=innerWidth/Math.max(1,innerHeight);
      if(camera.aspect!==aspect){camera.aspect=aspect;camera.updateProjectionMatrix();}
      // Reference at 23.5–24.5 s: Classic grip sits below and right of the crosshair.
      const pose=poses[selected]||riflePose;
      const frame=framing[selected];
      const baseScale=(frame?frame[2]:pose.scale)*(knife?.98:pistol?1.16:1.05);
      const viewportScale=THREE.MathUtils.clamp(camera.aspect/(16/9),.78,1);
      pivot.scale.setScalar(baseScale*viewportScale);
      const restX=(pose.right+(knife?.014:0))*Math.min(camera.aspect,2.1)/1.78;
      const restY=pose.height-(knife?.019:0);
      const restZ=-.54+(pistol?.036:knife?.021:.018);
      let offsetX=0, offsetY=0;
      if(frame){
        pivot.rotation.set(.12,pose.yaw??.30,-.06);
        pivot.position.set(restX,restY,restZ);
        readMuzzle();
        const halfHeight=-tip.z*Math.tan(camera.fov*Math.PI/360);
        offsetX=(frame[0]-.5)*2*camera.aspect*halfHeight-tip.x;
        offsetY=(.5-frame[1])*2*halfHeight-tip.y;
      }
      pivot.position.set(restX+(knife?.09:pistol?.061:.079)*draw-.009*settle,
        restY-(knife?.23:pistol?.21:.26)*draw+.013*settle-loading.drop*dip+.019*seat,
        restZ+.040*draw+.045*kick);
      pivot.position.x+=offsetX+.004*sway;
      pivot.position.y+=offsetY+.004*stride;
      pivot.rotation.set(.12+.30*kick+loading.pitch*liftBarrel+.18*seat-(knife?.64:pistol?.39:.46)*draw+.045*settle,
        (pose.yaw??.30)+.13*dip+(knife?.26:.22)*draw,
        -.06-loading.roll*dip-.12*seat-.19*shortyReload+(knife?.69:pistol?.39:.22)*draw-.038*settle);
      if(selected==='knife'){
        const slash=Math.sin(Math.PI*Math.min(1,shot/.33))**2;
        pivot.position.x-=.20*slash;
        pivot.rotation.z+=1.14*slash-.46;
      } else if(catalog[selected]?.canScope){
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
      if(Number.isFinite(inspected) && aim===0)applySideInspect(age);
      if(model===releaseModel && now-releaseTime<150){
        const remaining=1-smooth((now-releaseTime)/150);
        pivot.position.lerp(releasePosition,remaining);
        pivot.quaternion.slerp(releaseRotation,remaining);
      }
      if(api.isReloading){
        const weight=smooth(reloadT/.14)*(1-smooth((reloadT-.78)/.22));
        model.updateWorldMatrix(true,false);
        model.localToWorld(gripAfter.copy(model.userData.handAnchors?.hold||model.userData.inspectGrip));
        const limit=Math.min(-.035,gripAfter.z*Math.tan(camera.fov*Math.PI/360)*.67);
        pivot.position.y+=Math.max(0,limit-gripAfter.y)*weight;
      }
      syncHands({reloadT,draw,aim,age,shot,stride});
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
      const front=modelParts?.front;
      if(front?.userData.rest){
        // The muzzle marker is stored in the original model's local space.
        front.localToWorld(tip.copy(model.userData.muzzle).sub(front.userData.rest));
      }else{
        readMuzzle();
      }
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
    api.renderModel=(renderer,preview)=>{
      if(!visible)return;
      const clear=renderer.autoClear;
      renderer.autoClear=false;
      if(preview){
        const width=innerWidth,height=innerHeight;
        const viewWidth=width/preview.zoom,viewHeight=height/preview.zoom;
        camera.setViewOffset(width,height,preview.x*width-viewWidth/2,preview.y*height-viewHeight/2,viewWidth,viewHeight);
      }
      try {renderer.clearDepth();renderer.render(scene,camera);}
      finally {
        if(preview)camera.clearViewOffset();
        renderer.autoClear=clear;
      }
    };
    return api;
  };
})();

