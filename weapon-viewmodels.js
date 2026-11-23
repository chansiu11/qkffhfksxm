/* User-supplied weapon-only textures. First-person 2.5D view, no hands, gloves,
 * sleeves, pre-drawn weapon models, or first-person Three.js weapon geometry.
 * All 17 playable weapons map to a separate background-removed WebP texture.
 */
(function(){
  'use strict';
  const styles=Object.freeze({
    knife:{kind:'blade',mark:'EDGE',scale:.94},
    classic:{kind:'pistol',mark:'CLASSIC',scale:.90},
    shorty:{kind:'short',mark:'SHORTY',scale:1},
    frenzy:{kind:'machine',mark:'FRENZY',scale:.93},
    ghost:{kind:'pistol',mark:'GHOST',scale:.98},
    sheriff:{kind:'revolver',mark:'SHERIFF',scale:.98},
    stinger:{kind:'smg',mark:'STINGER',scale:1.02},
    spectre:{kind:'smg',mark:'SPECTRE',scale:1.03},
    bucky:{kind:'shotgun',mark:'BUCKY',scale:1.05},
    judge:{kind:'shotgun',mark:'JUDGE',scale:1.04},
    bulldog:{kind:'rifle',mark:'BULLDOG',scale:1.07},
    guardian:{kind:'rifle',mark:'GUARDIAN',scale:1.05},
    phantom:{kind:'rifle',mark:'PHANTOM',scale:1.07},
    vandal:{kind:'rifle',mark:'VANDAL',scale:1.09},
    marshal:{kind:'sniper',mark:'MARSHAL',scale:1.08},
    outlaw:{kind:'sniper',mark:'OUTLAW',scale:1.09},
    operator:{kind:'sniper',mark:'OPERATOR',scale:1.12}
  });
  // All twenty source images are separately cut out, including future guns.
  const referenceImages=Object.freeze({
    bandit:'bandit',classic:'classic',shorty:'shorty',frenzy:'frenzy',ghost:'ghost',
    sheriff:'sheriff',stinger:'stinger',spectre:'spectre',bucky:'bucky',judge:'judge',
    bulldog:'bulldog',guardian:'guardian',phantom:'phantom',vandal:'vandal',
    marshal:'marshal',outlaw:'outlaw',operator:'operator',ares:'ares',odin:'odin',knife:'knife'
  });
  // Pixel dimensions AFTER removing beige background and trimming empty margins.
  const sourceSize=Object.freeze({
    bandit:[294,182],classic:[308,234],shorty:[668,231],sheriff:[444,246],
    ghost:[664,228],frenzy:[285,233],stinger:[647,255],spectre:[626,245],
    bucky:[653,138],judge:[623,214],bulldog:[663,222],guardian:[671,159],
    phantom:[669,181],vandal:[663,232],marshal:[672,129],operator:[661,143],
    ares:[677,151],odin:[638,211],knife:[658,136],outlaw:[680,160]
  });
  function referencePlacement(id){
    const size=sourceSize[id]||sourceSize.classic;
    const kind=styles[id]?.kind||'rifle';
    const width=kind==='blade'?820:kind==='pistol'?575:
      kind==='revolver'?585:kind==='machine'?550:
      kind==='short'?765:kind==='smg'?805:kind==='shotgun'?865:900;
    const height=Math.round(width*size[1]/size[0]);
    // Attach the near end (stock / handle) near the bottom-right of the HUD.
    const x=Math.round(980-width);
    const y=Math.round((kind==='blade'?273:kind==='pistol'||kind==='machine'||kind==='revolver'?254:231)-height*.51);
    return {x,y,width,height};
  }
  function makeSvg(id){
    const name=Object.hasOwn(referenceImages,id)?id:'classic';
    const s=styles[name]||{mark:name.toUpperCase()};
    const p=referencePlacement(name);
    // One source photo only; duplicates used as shadow must not resemble a hand.
    // Source files already have transparent backgrounds.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 450" `+
      `preserveAspectRatio="xMidYMid meet" role="img" aria-label="${s.mark} cutout">`+
      `<title>${s.mark} - user-provided weapon-only texture</title>`+
      `<g class="weapon-only" data-weapon-id="${name}">`+
      `<image class="weapon-texture" data-ref-image="${name}" href="assets/weapons/${name}.webp" `+
      `x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" `+
      `preserveAspectRatio="xMidYMid meet"/></g></svg>`;
  }
  // User-selected side-on FPS pose: show the full weapon flank, not the
  // buttstock pointing at the camera. Muzzle and stock stay almost level.
  // The front/muzzle remains under the crosshair; the stock exits the right.
  const VIEW_ENDPOINTS = Object.freeze({
    rifle:   {front:[.535,.675], edge:[1.205,.691], plane:-7},
    smg:     {front:[.598,.709], edge:[1.215,.724], plane:-6},
    shotgun: {front:[.545,.688], edge:[1.215,.705], plane:-7},
    sniper:  {front:[.490,.666], edge:[1.190,.682], plane:-8},
    pistol:  {front:[.750,.755], edge:[1.188,.768], plane:-4},
    revolver:{front:[.730,.758], edge:[1.194,.770], plane:-5},
    machine: {front:[.731,.760], edge:[1.193,.773], plane:-4},
    short:   {front:[.703,.757], edge:[1.193,.771], plane:-5},
    blade:   {front:[.611,.735], edge:[1.190,.750], plane:-4}
  });
  function viewEndpoints(id, width, height){
    const kind=styles[id]?.kind||'rifle';
    const ref=VIEW_ENDPOINTS[kind]||VIEW_ENDPOINTS.rifle;
    const portrait=width<=820&&height>width;
    // On tall screens the right edge is further beyond the viewport so the
    // nearly-horizontal weapon stays large without pitching toward the player.
    const front=portrait ? [
      kind==='blade'?.56:kind==='pistol'||kind==='revolver'||kind==='machine'?.67:.43,
      kind==='blade'?.740:kind==='pistol'||kind==='revolver'||kind==='machine'?.790:.745
    ] : ref.front;
    const edge=portrait ? [
      kind==='pistol'||kind==='revolver'||kind==='machine'?1.52:1.62,
      front[1]+.012
    ] : ref.edge;
    return {front:{x:width*front[0],y:height*front[1]},
      edge:{x:width*edge[0],y:height*edge[1]},yaw:ref.plane};
  }
  function create(THREE){
    // No weapon mesh is attached to the camera; kept only for legacy gameplay API.
    const group=new THREE.Group();
    const flash={visible:false,material:{opacity:0}};
    const layer=document.getElementById('fps-weapon-sprite-layer');
    if(!layer)throw Error('Missing weapon sprite layer');
    const cache=new Map(),elements={};
    let shown='',fireAt=-1e6,fireMode='light',reloadAt=-1e6,reloadPlaying=false;
    let switchAt=-1e6,lastVisible=false,lastTransform='',lastLayoutKey='';
    let pose=null,flashNode=null;
    function setWeapon(id){
      const next=Object.hasOwn(styles,id)?id:'classic';
      if(next===shown)return;
      shown=next;
      reloadPlaying=false;
      switchAt=performance.now();
      if(!cache.has(next))cache.set(next,makeSvg(next));
      layer.innerHTML=cache.get(next);
      elements.svg=layer.querySelector('svg');
      flashNode=document.createElement('span');
      flashNode.className='weapon-shot-flash';
      layer.appendChild(flashNode);
      layer.classList.toggle('weapon-knife',next==='knife');
      lastLayoutKey='';lastTransform='';
    }
    function fire(mode='light'){
      fireMode=mode==='heavy'?'heavy':'light';
      fireAt=performance.now();
    }
    function beginReload(){if(shown!=='knife'){reloadAt=performance.now();reloadPlaying=true;}}
    function stopReload(){reloadPlaying=false;}
    function update(dt,p,state){
      const live=!!(p?.alive&&state?.inMatch);
      if(live!==lastVisible){layer.classList.toggle('weapon-visible',live);lastVisible=live;}
      if(!live||!elements.svg)return;
      const now=performance.now();
      const sword=shown==='knife',kind=styles[shown]?.kind||'rifle';
      const moving=Math.min(1,Math.hypot(p.vel?.x||0,p.vel?.z||0)/7.6);
      const bobX=Math.sin(now*.0097)*4.7*moving;
      const bobY=Math.abs(Math.sin(now*.0097))*6.7*moving;
      const breathing=Math.sin(now*.00105);
      const kick=Math.max(0,1-(now-fireAt)/(sword?280:135));
      const draw=Math.max(0,1-(now-switchAt)/260);
      const reloadProgress=reloadPlaying?Math.min(1,Math.max(0,(now-reloadAt)/1170)):0;
      const reloadDrop=reloadPlaying?Math.sin(Math.PI*reloadProgress):0;
      const heavy=sword&&fireMode==='heavy';
      // Two viewport anchors define the first-person pose: front of the sprite
      // near lower center, near side disappearing past the lower-right edge.
      // This avoids simply rotating an undersized, floating picture in place.
      const screenWidth=Number.isFinite(window.innerWidth)?window.innerWidth:1440;
      const screenHeight=Number.isFinite(window.innerHeight)?window.innerHeight:900;
      const key=`${shown}:${screenWidth}:${screenHeight}`;
      if(lastLayoutKey!==key){
        const pImg=referencePlacement(shown);
        const pivotX=pImg.x+pImg.width;
        const pivotY=pImg.y+pImg.height*.5;
        const endpoints=viewEndpoints(shown,screenWidth,screenHeight);
        const dx=endpoints.edge.x-endpoints.front.x;
        const dy=endpoints.edge.y-endpoints.front.y;
        const distance=Math.hypot(dx,dy);
        const radians=Math.atan2(dy,dx);
        const yawRadians=endpoints.yaw*Math.PI/180;
        // View-plane width chosen from the two on-screen points. A mild 3D
        // foreshortening is compensated so the front remains clearly visible.
        const svgWidth=distance/(pImg.width/1000*Math.cos(yawRadians)*.96);
        const svgHeight=svgWidth*.45;
        elements.svg.style.width=`${svgWidth.toFixed(1)}px`;
        elements.svg.style.height=`${svgHeight.toFixed(1)}px`;
        elements.svg.style.left=`${(endpoints.edge.x-svgWidth*pivotX/1000).toFixed(1)}px`;
        elements.svg.style.top=`${(endpoints.edge.y-svgHeight*pivotY/450).toFixed(1)}px`;
        elements.svg.style.transformOrigin=`${(pivotX/10).toFixed(2)}% ${(pivotY/4.5).toFixed(2)}%`;
        pose={angle:radians*180/Math.PI,yaw:endpoints.yaw,front:endpoints.front,edge:endpoints.edge};
        lastLayoutKey=key;lastTransform='';
      }
      const swing= sword?(heavy?28:-30):0;
      // Idle pose stays almost horizontal; action-only recoil/reload adds movement.
      const roll=pose.angle+breathing*.09+kick*(sword?swing:1.4)+reloadDrop*6;
      const portrait=screenWidth<=820&&screenHeight>screenWidth;
      // Visual-only offset compensates for perspective distortion, placing the
      // *actual displayed* front near the target screenshot anchor.
      const anchorShiftX=-screenWidth*(portrait?.15:.20);
      const anchorShiftY=-screenHeight*(portrait?.10:.145);
      const x=anchorShiftX+bobX+kick*(sword?-21:8);
      const y=anchorShiftY+bobY+kick*(sword?-15:21)+reloadDrop*100+draw*90+(p.isScoped?205:0);
      const yaw=pose.yaw+breathing*.10;
      const pitch=.7+breathing*.15+moving*.18;
      const transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) `+
        `perspective(1250px) rotateZ(${roll.toFixed(2)}deg) `+
        `rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
      if(transform!==lastTransform){elements.svg.style.transform=transform;lastTransform=transform;}
      if(flashNode){
        flashNode.style.left=`${(pose.front.x+x-anchorShiftX+9).toFixed(1)}px`;
        flashNode.style.top=`${(pose.front.y+y-anchorShiftY-15).toFixed(1)}px`;
        flashNode.style.transform=`translate(-70%, -50%) rotate(${(roll+180).toFixed(1)}deg)`;
        flashNode.style.opacity=(!sword&&!p.isScoped&&kick>.55)?String(Math.min(1,(kick-.55)*2.2)):'0';
      }
      layer.classList.toggle('weapon-aiming',!!p.isScoped);
    }
    setWeapon('classic');
    return {group,flash,setWeapon,fire,beginReload,stopReload,update,
      get isReloading(){return reloadPlaying;},get current(){return shown;},styles};
  }
  window.WeaponViewmodels={create,styles,makeSvg,referenceImages,referencePlacement,viewEndpoints};
})();