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
    let equipMs=750,combo=0,inspectAt=-Infinity;
    function inspect(){
      const now=performance.now();
      if(shown==='knife' && now-switchAt>=equipMs && now-fireAt>=(fireMode==='heavy'?560:330))inspectAt=now;
    }
    function setWeapon(id,equipTime){
      id=Object.hasOwn(styles,id)?id:'classic';
      if(id===shown)return;
      equipMs=Math.max(1,(equipTime??catalog[id]?.equipTime??(id==='knife'?.6:1))*1000);fireAt=-100000;combo=0;
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
      const args={recoil:shown==='knife'?0:firing,motionX:bob,
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
    return {group,flash,setWeapon,inspect,fire,beginReload,stopReload,update,
      getMuzzleScreenPosition,getMuzzleWorldPosition,
      get isReloading(){return reloading;},get current(){return shown;},styles};
  }
  window.WeaponViewmodels={create,styles,makeSvg,referenceImages,referencePlacement,
    viewEndpoints,paperProjection,quadToMatrix,muzzleEdgeY,equipPose};
})();
(function () {
  const createSprite = WeaponViewmodels.create;
  const files = {
    classic: 'Black_Semi_Automatic_Pistol', shorty: 'Shadowbreaker',
    frenzy: 'Tactical_Shadow_SMG', ghost: 'Shadow_Sentinel',
    bandit: 'Shadowline_Pistol', sheriff: 'Shadowhawk_Revolver'
  };
  const poses = {
    classic: {scale:.40, right:.168, height:-.143, inspectYaw:.95, turnRoll:1.04, reloadDrop:.25, reloadRoll:.54},
    shorty:  {scale:.73, right:.146, height:-.143, inspectYaw:.95, turnRoll:1.04, reloadDrop:.12, reloadRoll:.54},
    frenzy:  {scale:.55, right:.156, height:-.157, inspectYaw:.84, turnRoll:.73, reloadDrop:.17, reloadRoll:.38},
    ghost:   {scale:.66, right:.151, height:-.148, inspectYaw:1.12, turnRoll:.82, reloadDrop:.18, reloadRoll:.51},
    bandit:  {scale:.52, right:.163, height:-.145, inspectYaw:1.02, turnRoll:.94, reloadDrop:.16, reloadRoll:.46},
    sheriff: {scale:.61, right:.154, height:-.155, inspectYaw:1.21, turnRoll:.62, reloadDrop:.12, reloadRoll:.86}
  };
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
    const archive = 'refs/classic/Meshy_AI_' + files[id] + '_20261125_texture_fbx' + (id === 'classic' ? ' (1)' : '') + '.zip';
    const response = await fetch(archive);
    if (!response.ok) throw Error(archive);
    const entries = fflate.unzipSync(new Uint8Array(await response.arrayBuffer()));
    const names = Object.keys(entries);
    const mesh = new T.FBXLoader(new T.LoadingManager()).parse(entries[names.find(n => /\.fbx$/i.test(n))].buffer, '');
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
    if(count && sum<0) body.rotation.y+=Math.PI;
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
    api.preloadJobs=()=>Object.keys(files).map(id=>()=>getModel(id));
    function select(id) {
      if(selected===id)return;
      startModelDraw=!!files[id];
      selected=id; equipped=performance.now(); inspected=fired=-Infinity;
      pivot.clear(); model=null; visible=false;
      if(!files[id])return;
      getModel(id).then(asset=>{if(asset && selected===id){model=asset;pivot.add(asset);}}).catch(err=>console.warn('Pistol model',id,err));
    }
    const set=api.setWeapon, update=api.update, fire=api.fire, inspect=api.inspect, reload=api.beginReload;
    api.setWeapon=(id,time)=>{set(id,time);duration=(time??catalog[id]?.equipTime??.75)*1000;select(api.current);};
    api.inspect=()=>{inspect();if(model&&!api.isReloading && performance.now()-equipped>=duration)inspected=performance.now();};
    api.fire=(mode)=>{startModelDraw=false;inspected=-Infinity;fired=performance.now();fire(mode);};
    api.beginReload=()=>{startModelDraw=false;inspected=-Infinity;reloadStarted=performance.now();reload();};
    api.update=(dt,player,state)=>{
      update(dt,player,state);
      visible=!!(model&&player?.alive&&state?.inMatch);
      if(!visible)return;
      const now=performance.now(), age=(now-inspected)/1000;
      if(startModelDraw){equipped=now;startModelDraw=false;}
      const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
      const lift=smooth(age/.34)*(1-smooth((age-2.54)/.38));
      const turn=smooth((age-1.12)/.42)*(1-smooth((age-2.48)/.40));
      const equip=Math.min(1,(now-equipped)/duration);
      const draw=1-smooth(equip);
      const reloadT=api.isReloading?Math.min(1,(now-reloadStarted)/(1000*(catalog[selected]?.reloadTime||1.1))):1;
      const liftProgress = reloadT;
      const liftBarrel = Math.sin(Math.PI * liftProgress) * (1 - liftProgress);
      const dip=smooth(reloadT/.28)*(1-smooth((reloadT-.39)/.28));
      const seat=smooth((reloadT-.34)/.29)*(1-smooth((reloadT-.73)/.27));
      const shorty=selected==='shorty';
      // Hold the broad side in view, then turn back upright for the second pose.
      const shortyInspect=shorty?lift:0;
      const shortyTurn=shorty?turn:0;
      const shortyReload=shorty?smooth(reloadT/.22)*(1-smooth((reloadT-.72)/.28)):0;
      const shot=(now-fired)/1000, kick=shot<.25?Math.sin(Math.PI*Math.min(1,shot/.055)/2)*Math.exp(-shot*18):0;
      const move=Math.min(1,Math.hypot(player.vel?.x||0,player.vel?.z||0)/7.6);
      camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
      // Reference at 23.5–24.5 s: Classic grip sits below and right of the crosshair.
      const pose=poses[selected];
      pivot.scale.setScalar(pose.scale);
      pivot.position.set(pose.right*Math.min(camera.aspect,2.1)/1.78-.013*lift-.087*turn-.033*shortyInspect,
        pose.height+.048*lift-.08*turn-.26*draw-pose.reloadDrop*dip+.015*seat+.003*move*Math.sin(now*.01),
        -.54+.05*lift+.045*kick);
      pivot.rotation.set(.12+.30*kick+.20*lift+(selected==='classic'?0:.73*liftBarrel+.48*seat),
        .30+pose.inspectYaw*lift-.45*turn+.16*dip+.25*shortyInspect-.56*shortyTurn,-.06-.24*lift-pose.turnRoll*turn-pose.reloadRoll*dip-.22*seat-.47*shortyReload);
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
      model.localToWorld(tip.copy(model.userData.muzzle));
      const depth=-tip.z;
      tip.project(camera);
      return {x:(tip.x+1)*innerWidth/2,y:(1-tip.y)*innerHeight/2,depth};
    }
    api.getMuzzleScreenPosition=()=>visible&&model?projectTip():spriteScreen();
    api.getMuzzleWorldPosition=worldCamera=>{
      if(!visible||!model||!worldCamera)return spriteWorld(worldCamera);
      const {depth}=projectTip();
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
    select(api.current);
    return api;
  };
})();
