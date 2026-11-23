/* First-person WEAPON-ONLY paper-plane viewmodel.
 * Each supplied transparent 2D texture lies on a single mathematically projected
 * rectangle in 3D camera space: muzzle edge far, rear/stock edge near. This is
 * a perspective warp of a flat photograph, NOT a 3D weapon or an arm model.
 */
(function () {
  'use strict';
  const styles = Object.freeze({
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
  const referenceImages=Object.freeze({
    bandit:'bandit',classic:'classic',shorty:'shorty',frenzy:'frenzy',ghost:'ghost',
    sheriff:'sheriff',stinger:'stinger',spectre:'spectre',bucky:'bucky',judge:'judge',
    bulldog:'bulldog',guardian:'guardian',phantom:'phantom',vandal:'vandal',
    marshal:'marshal',outlaw:'outlaw',operator:'operator',ares:'ares',odin:'odin',knife:'knife'
  });
  const sourceSize=Object.freeze({
    bandit:[294,182],classic:[308,234],shorty:[668,231],sheriff:[444,246],
    ghost:[664,228],frenzy:[285,233],stinger:[647,255],spectre:[626,245],
    bucky:[653,138],judge:[623,214],bulldog:[663,222],guardian:[671,159],
    phantom:[669,181],vandal:[663,232],marshal:[672,129],operator:[661,143],
    ares:[677,151],odin:[638,211],knife:[658,136],outlaw:[680,160]
  });
  // From the edge-alpha pixels of the user's cutout images, NOT an arbitrary
  // center of the whole screenshot. Values are fractions of the source height.
  const muzzleEdgeY=Object.freeze({
    bandit:.138,classic:.171,shorty:.180,sheriff:.214,ghost:.151,frenzy:.151,
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
    const portrait=width<=820&&height>width;
    const front=portrait?[kind==='pistol'||kind==='revolver'||kind==='machine'?.67:.515,
      kind==='blade'?.665:.650]:cfg.front;
    const rear=portrait?[1.23,kind==='blade'?.92:.955]:cfg.rear;
    // Foreshorten the gun horizontally around its stock.
    const muzzleX = kind === 'blade' ? front[0] : front[0] + (rear[0] - front[0]) * .29;
    return {front:{x:width*muzzleX,y:height*front[1]},
      edge:{x:width*rear[0],y:height*rear[1]},
      frontDepth:FRONT_DEPTH,rearDepth:REAR_DEPTH,paperHeight:cfg.height};
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
    const rear={x:mix(endpoints.edge.x,adsRear.x)+motionX*(1-adsT)+12*recoil-swing*.3,
      y:mix(endpoints.edge.y,adsRear.y)+motionY*(1-adsT)+15*recoil+drop};
    const M=atDepth(front,FRONT_DEPTH,w,h,fl),R=atDepth(rear,REAR_DEPTH,w,h,fl);
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
    const muzzle=project(actual(0,alpha),w,h,fl);
    return {matrix:quadToMatrix(corners,iw,ih),corners,muzzle,
      frontDepth:FRONT_DEPTH,rearDepth:REAR_DEPTH,source:{width:iw,height:ih},front,rear};
  }
  function makeSvg(id){
    // Keep a compatibility SVG public method for existing tooling; the real HUD
    // uses an <img> warped with the paper's four projected corners.
    const name=Object.hasOwn(referenceImages,id)?id:'classic';
    const [w,h]=sourceSize[name];return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><title>${styles[name]?.mark||name}</title><image class="weapon-texture" data-weapon-id="${name}" href="assets/weapons/${name}.webp" width="${w}" height="${h}"/></svg>`;
  }
  function referencePlacement(id){const [w,h]=sourceSize[id]||sourceSize.classic;return {x:0,y:0,width:w,height:h};}
  function create(THREE){
    const group=new THREE.Group(); // compatibility-only; no 3D gun meshes or limbs
    const flash={visible:false,material:{opacity:0}};
    const layer=document.getElementById('fps-weapon-sprite-layer');
    if(!layer)throw Error('Missing weapon sprite layer');
    let shown='',photo=null,flashNode=null,fireAt=-100000,reloadAt=-100000,
      switchAt=-100000,reloading=false,fireMode='light',lastVisible=false,
      lastTransform='',lastViewport='',muzzleScreen=null;
    function setWeapon(id){
      id=Object.hasOwn(styles,id)?id:'classic';
      if(id===shown)return;
      shown=id;switchAt=performance.now();reloading=false;
      const [w,h]=sourceSize[id];
      layer.innerHTML=`<img class="fps-paper-weapon" src="assets/weapons/${id}.webp" width="${w}" height="${h}" alt="" draggable="false" aria-hidden="true">`+
        `<span class="weapon-shot-flash" aria-hidden="true"></span>`;
      photo=layer.querySelector('.fps-paper-weapon');
      flashNode=layer.querySelector('.weapon-shot-flash');
      muzzleScreen=null;lastTransform='';lastViewport='';
      layer.classList.toggle('weapon-knife',shown==='knife');
    }
    function fire(mode='light'){fireMode=mode==='heavy'?'heavy':'light';fireAt=performance.now();}
    function beginReload(){if(shown!=='knife'){reloadAt=performance.now();reloading=true;}}
    function stopReload(){reloading=false;}
    function update(dt,player,state){
      const visible=!!(player?.alive&&state?.inMatch);
      if(visible!==lastVisible){layer.classList.toggle('weapon-visible',visible);lastVisible=visible;}
      if(!visible||!photo)return;
      const now=performance.now(),w=window.innerWidth||1440,h=window.innerHeight||900;
      const moving=Math.min(1,Math.hypot(player.vel?.x||0,player.vel?.z||0)/7.6);
      const bob=Math.sin(now*.010)*2.8*moving;
      const breath=Math.sin(now*.0011)*1.3;
      const firing=Math.max(0,1-(now-fireAt)/(shown==='knife'?255:135));
      const reloadProgress=reloading?Math.min(1,(now-reloadAt)/1170):0;
      const drop=reloading?Math.sin(Math.PI*reloadProgress)*78:0;
      const draw=Math.max(0,1-(now-switchAt)/230)*64;
      const swing=shown==='knife'?firing*(fireMode==='heavy'?-55:65):0;
      const adsT=shown==='knife'?0:Math.max(0,Math.min(1,player.adsProgress||0));
      const args={recoil:shown==='knife'?0:firing,motionX:bob,
        motionY:Math.abs(bob)+breath,drop:drop+draw*(1-adsT),swing,adsProgress:adsT};
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
    return {group,flash,setWeapon,fire,beginReload,stopReload,update,
      getMuzzleScreenPosition,getMuzzleWorldPosition,
      get isReloading(){return reloading;},get current(){return shown;},styles};
  }
  window.WeaponViewmodels={create,styles,makeSvg,referenceImages,referencePlacement,
    viewEndpoints,paperProjection,quadToMatrix,muzzleEdgeY};
})();