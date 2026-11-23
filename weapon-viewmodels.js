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
  function create(THREE){
    // No weapon mesh is attached to the camera; kept only for legacy gameplay API.
    const group=new THREE.Group();
    const flash={visible:false,material:{opacity:0}};
    const layer=document.getElementById('fps-weapon-sprite-layer');
    if(!layer)throw Error('Missing weapon sprite layer');
    const cache=new Map(),elements={};
    let shown='',fireAt=-1e6,fireMode='light',reloadAt=-1e6,reloadPlaying=false;
    let switchAt=-1e6,lastVisible=false,lastTransform='';
    function setWeapon(id){
      const next=Object.hasOwn(styles,id)?id:'classic';
      if(next===shown)return;
      shown=next;
      reloadPlaying=false;
      switchAt=performance.now();
      if(!cache.has(next))cache.set(next,makeSvg(next));
      layer.innerHTML=cache.get(next);
      elements.svg=layer.querySelector('svg');
      layer.classList.toggle('weapon-knife',next==='knife');
      lastTransform='';
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
      // Keep the right/near end closest to camera and muzzle facing away/toward center.
      const screenWidth=Number.isFinite(window.innerWidth)?window.innerWidth:1440;
      const mobile=screenWidth<=820;
      const angle=sword?33:kind==='pistol'||kind==='machine'||kind==='revolver'?28:
        kind==='short'?25:kind==='smg'?23:20;
      const yaw=-49 + breathing*.6 + kick*3;
      const pitch=(sword?9:15)+breathing*1.1+moving*1.4-reloadDrop*5;
      const z=angle+breathing*.75 + kick*(sword?(heavy?32:-32):7) + reloadDrop*13;
      const x=bobX+kick*(sword?(heavy?-40:-24):11)+(mobile?4:0);
      const y=bobY+kick*(sword?-18:22)+reloadDrop*106+draw*92+(p.isScoped?180:0);
      const scale=(styles[shown].scale||1)*(mobile?.9:1);
      const transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) `+
        `perspective(930px) rotateY(${yaw.toFixed(2)}deg) `+
        `rotateX(${pitch.toFixed(2)}deg) rotateZ(${z.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      if(transform!==lastTransform){elements.svg.style.transform=transform;lastTransform=transform;}
      layer.classList.toggle('weapon-aiming',!!p.isScoped);
    }
    setWeapon('classic');
    return {group,flash,setWeapon,fire,beginReload,stopReload,update,
      get isReloading(){return reloadPlaying;},get current(){return shown;},styles};
  }
  window.WeaponViewmodels={create,styles,makeSvg,referenceImages,referencePlacement};
})();