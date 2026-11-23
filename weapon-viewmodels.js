/* Independent, original 2D FPS weapon illustrations and first-person sprite animation.
 * These vector sprites are made for this project; no proprietary game textures are copied.
 * The exported API retains the old viewmodel contract for the existing gameplay/network code. */
(function () {
  'use strict';
  const styles = {
    knife:    {kind:'blade',   body:'#354553',accent:'#e8b95d',detail:'#aabeca',mark:'EDGE',    scale:0.88},
    classic:  {kind:'pistol',  body:'#3f5264',accent:'#42d7bc',detail:'#c9d9db',mark:'CLASSIC', scale:0.86},
    shorty:   {kind:'double',  body:'#665044',accent:'#edaf66',detail:'#d7bca0',mark:'SHORTY', scale:0.96},
    frenzy:   {kind:'machine', body:'#414357',accent:'#f3b751',detail:'#a6acbb',mark:'FRENZY', scale:0.92},
    ghost:    {kind:'pistol',  body:'#334854',accent:'#69dcd2',detail:'#bdceda',mark:'GHOST', scale:0.95,suppressor:true},
    sheriff:  {kind:'revolver',body:'#3f4043',accent:'#eab767',detail:'#dee1d1',mark:'SHERIFF',scale:0.96},
    stinger:  {kind:'smg',     body:'#4d435a',accent:'#a586f9',detail:'#c1b9d0',mark:'STINGER',scale:1},
    spectre:  {kind:'smg',     body:'#2d4c5e',accent:'#63c5ef',detail:'#c3dce5',mark:'SPECTRE',scale:1,suppressor:true},
    bucky:    {kind:'pump',    body:'#58483c',accent:'#e8aa61',detail:'#c7afa0',mark:'BUCKY', scale:1.04},
    judge:    {kind:'autoShot',body:'#5c4540',accent:'#e98560',detail:'#d5b4ad',mark:'JUDGE', scale:1.04},
    bulldog:  {kind:'bullpup', body:'#3b5253',accent:'#66d3a1',detail:'#bbcfd3',mark:'BULLDOG',scale:1.06},
    guardian: {kind:'dmr',     body:'#3b5262',accent:'#78aeeb',detail:'#cbd8e4',mark:'GUARDIAN',scale:1.07},
    phantom:  {kind:'rifle',   body:'#24454b',accent:'#57dcba',detail:'#bddcd9',mark:'PHANTOM',scale:1.08,suppressor:true},
    vandal:   {kind:'rifle',   body:'#504247',accent:'#eb6b71',detail:'#c7bdc6',mark:'VANDAL',scale:1.08},
    marshal:  {kind:'sniper',  body:'#4a5849',accent:'#bbd978',detail:'#d8ddcc',mark:'MARSHAL',scale:1.06},
    outlaw:   {kind:'break',   body:'#594763',accent:'#c292ed',detail:'#dad0e4',mark:'OUTLAW',scale:1.07},
    operator: {kind:'heavy',   body:'#4f503e',accent:'#e8cc65',detail:'#dbd8b3',mark:'OPERATOR',scale:1.09}
  };
  const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 370" role="img" aria-label="2D first-person weapon sprite" preserveAspectRatio="xMidYMid meet">`;
  function shape(points, fill, stroke='#14202a', sw=5) {return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;}
  function path(d,fill,stroke='#14202a',sw=5){return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;}
  function rect(x,y,w,h,fill,rx=3,stroke='none',sw=0){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;}
  function line(x1,y1,x2,y2,stroke='#cbd7dc',sw=3){return `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;}
  function circle(x,y,r,fill,stroke='#19232e',sw=3){return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;}
  function scratches(x,y,count,step,color){let out='';for(let i=0;i<count;i++)out+=line(x+step*i,y,x+step*i-9,y+11,color,1.7);return out;}
  function rifleStock(s,kind){
    if(kind==='sniper'||kind==='heavy'||kind==='dmr')return shape('708,134 813,124 920,148 938,173 900,216 830,199 801,219 738,220 713,202',s.body)+shape('808,148 899,161 910,172 889,189 838,181 824,193 798,192', '#18232c')+rect(916,154,20,56,s.detail,5);
    if(kind==='bullpup')return shape('685,140 853,125 933,166 926,232 835,236 787,211 696,217',s.body)+path('M778 178L879 166L901 184L899 210L836 210L817 196Z','#22303a')+rect(924,161,18,80,s.detail,3);
    if(kind==='pump'||kind==='autoShot')return shape('681,158 822,139 943,166 936,227 836,228 801,205 694,218',s.body)+shape('805,165 908,171 917,204 832,211', '#2e3034')+rect(936,168,15,59,s.detail,2);
    if(kind==='smg')return shape('707,155 846,148 893,172 883,188 764,186 748,217 713,217',s.body)+rect(877,158,17,41,s.detail,3);
    return shape('688,153 808,128 931,151 947,173 916,224 828,222 794,197 708,205',s.body)+shape('801,159 907,158 921,175 893,202 846,199 823,184', '#1b2b34')+rect(937,160,15,57,s.detail,2);
  }
  function receiver(s,kind){
    const body = kind==='bullpup'
      ? '400,145 723,145 766,179 727,230 592,235 580,250 434,240 410,213'
      : kind==='sniper'||kind==='heavy'||kind==='dmr'||kind==='break'
      ? '407,153 743,147 782,173 755,205 704,233 461,227 427,210'
      : '407,133 733,141 768,175 732,226 600,241 435,226 410,200';
    let out=shape(body,s.body);
    out+=shape('428,150 695,154 716,169 693,180 429,178','#20303b','none',0);
    out+=shape('444,188 715,185 708,210 634,221 484,210',s.detail,'none',0);
    out+=shape('449,190 700,188 675,197 473,197',s.accent,'none',0);
    out+=rect(450,164,255,8,'#09161e',2);
    for(let x=454;x<675;x+=35)out+=rect(x,170,14,3,'#849ba7',0);
    out+=circle(711,212,7,'#19252e')+circle(465,205,5,s.detail);
    out+=scratches(485,204,6,18,'#93a5b1');
    out+=`<text x="498" y="214" font-family="Arial,sans-serif" font-size="19" font-weight="800" letter-spacing="3" fill="#0e2029" opacity=".82">${s.mark}</text>`;
    return out;
  }
  function gunParts(id,s){
    const k=s.kind;
    const pistol=['pistol','machine','revolver','double'].includes(k);
    const long=['sniper','heavy','dmr','break'].includes(k);
    let out=`<defs><linearGradient id="steel" x2="0" y2="1"><stop stop-color="${s.detail}"/><stop offset=".52" stop-color="#657889"/><stop offset="1" stop-color="#17252d"/></linearGradient><linearGradient id="metal" x2="0" y2="1"><stop stop-color="${s.body}"/><stop offset=".5" stop-color="#1c303c"/><stop offset="1" stop-color="#10171f"/></linearGradient></defs>`;
    if(k==='blade'){
      out+=`<g id="art-blade">`;
      out+=path('M110 143 L588 105 Q696 88 746 54 L793 48 763 83 Q744 115 720 137 L290 167Z','url(#steel)','#182731',8);
      out+=path('M116 145L664 125L762 86L721 138L310 163Z', '#d4e1e1','none',0);
      out+=path('M139 147L560 123','#eaf2e9','none',0);
      out+=rect(703,102,22,86,s.accent,7,'#293643',5);
      out+=shape('711,140 892,138 934,169 916,207 701,205 683,180',s.body);
      out+=rect(740,152,133,40,'#24313b',11);
      for(let x=759;x<871;x+=22)out+=line(x,157,x-10,189,s.accent,5);
      out+=circle(903,173,13,s.accent);
      out+='</g>';
      return out;
    }
    if(pistol){
      const barrelStart=s.suppressor?185:k==='double'?291:k==='revolver'?335:333;
      const barrelEnd=k==='double'?674:745;
      out+=rect(barrelStart,160,barrelEnd-barrelStart,43,'url(#metal)',5,'#15242d',5);
      if(s.suppressor){out+=rect(173,151,191,58,'#243941',21,'#20343b',5);for(let x=196;x<350;x+=26)out+=line(x,161,x,195,s.accent,2);}
      if(k==='double'){out+=rect(278,143,390,16,s.detail,4)+rect(283,200,390,14,s.detail,4);}
      if(k==='revolver'){out+=`<g id="art-cylinder">`+rect(505,148,108,74,s.detail,17,'#1b252e',7);for(let i=0;i<5;i++)out+=circle(537+(i%2)*35,168+Math.floor(i/2)*18,6,s.accent);out+='</g>';}
      out+=shape('376,137 718,131 744,166 729,209 557,216 497,227 390,210',s.body);
      out+=`<g id="art-slide">`+shape('390,136 710,133 727,159 701,173 389,170','url(#steel)')+rect(415,141,257,7,s.accent,2);out+=scratches(636,145,5,15,'#243542')+'</g>';
      out+=shape('591,210 710,204 760,304 728,353 652,342 631,270 596,258','#263642');
      out+=shape('657,245 717,230 747,306 717,328 669,319',s.body);
      out+=rect(691,266,28,46,s.accent,5);
      out+=path('M573 209 Q532 261 588 287 L627 284', 'none','#13212d',9);
      if(k==='machine')out+=`<g id="art-mag">`+shape('663,282 724,280 729,358 665,358',s.accent)+'</g>';
      if(k==='revolver')out+=rect(572,190,30,15,'#15232b',3);
      out+=rect(458,123,29,22,s.detail,3)+rect(681,121,28,20,s.detail,3);
      out+=`<text x="486" y="203" fill="${s.accent}" font-family="Arial,sans-serif" font-weight="900" font-size="21" letter-spacing="3">${s.mark}</text>`;
      return out;
    }
    const tubeStart=s.suppressor?72:long?40:130;
    out+=rect(tubeStart,153,430-tubeStart,37,'url(#metal)',9,'#102029',6);
    out+=rect(tubeStart+6,164,425-tubeStart,6,'#b8cad0',3);
    if(s.suppressor){out+=rect(67,149,186,46,'#1e3039',15,'#344d56',6);for(let x=81;x<233;x+=27)out+=line(x,157,x,185,s.accent,2.5);}
    if(k==='heavy'||k==='break')out+=rect(87,196,337,28,'#33434e',8,'#131e25',5);
    if(k==='pump'||k==='autoShot')out+=`<g id="art-pump">`+rect(220,189,175,52,s.body,10,'#172129',7)+scratches(260,195,9,13,s.detail)+'</g>';
    if(k==='rifle'||k==='smg'||k==='bullpup'||k==='dmr')out+=rect(225,138,204,13,'#1d2a35',2)+Array.from({length:8},(_,i)=>rect(230+i*25,137,13,4,s.accent,0)).join('');
    out+=rifleStock(s,k);
    out+=receiver(s,k);
    out+=`<g id="art-mag">`;
    if(k==='autoShot')out+=rect(565,227,112,104,'#253541',24,s.accent,5);
    else if(k==='break')out+=shape('586,231 664,225 666,272 593,270','#2b3042');
    else if(k==='heavy')out+=shape('553,228 677,225 684,302 620,332 560,301',s.body);
    else if(id==='vandal')out+=path('M543 234L642 233L646 272Q638 329 576 353L540 343Q586 302 590 270L542 268Z','#263642');
    else out+=shape('544,228 643,228 637,347 559,350 548,291','#21313c');
    out+=rect(568,258,36,11,s.accent,3)+'</g>';
    if(k==='bullpup')out+=path('M562 218L660 217L699 258L667 269L603 250Z','#26343c');
    out+=shape('650,219 706,219 750,323 718,345 690,333 659,270','#24313b');
    out+=shape('670,247 699,237 733,314 713,322',s.body);
    out+=path('M613 216 Q607 259 656 283', 'none','#101923',9);
    out+=`<g id="art-slide">`+rect(482,146,168,18,s.detail,3,'#192632',3)+scratches(495,149,9,15,s.body)+'</g>';
    if(long){
      out+=`<g id="art-bolt">`+rect(611,138,57,11,s.accent,2)+circle(665,144,8,s.detail)+'</g>';
      out+=rect(520,115,128,10,'#15212a',3);
      out+=rect(528,89,218,37,'url(#metal)',9,'#112028',6);
      out+=circle(539,108,22,'#182936',s.detail,7);
      out+=circle(734,108,21,'#182936',s.detail,6);
      out+=rect(562,101,130,4,s.accent,2);
    }else if(['rifle','bullpup','smg'].includes(k)){
      out+=rect(531,113,114,24,'#253540',6,'#11232d',5);
      out+=rect(553,103,50,11,s.detail,3);
    }
    out+=circle(694,202,5,s.accent);
    return out;
  }
  function makeSvg(id){
    const s=styles[id]||styles.classic;
    return svgOpen+`<g class="weapon-art" style="filter:drop-shadow(0px 12px 8px rgba(0,0,0,.42))">`+gunParts(id,s)+`</g>`+
      `<title>${s.mark} — original 2D weapon illustration</title></svg>`;
  }
  function create(T){
    const group = new T.Group(); // Compatibility-only; intentionally empty (no first-person 3D meshes).
    const flash = {visible:false,material:{opacity:0}}; // Existing gunfire code expects a flash object.
    const layer = document.getElementById('fps-weapon-sprite-layer');
    if(!layer)throw new Error('Missing #fps-weapon-sprite-layer');
    const cache=new Map();
    let shown='',fireAt=-10000,reloadAt=-10000,reloadPlaying=false;
    const elements={};
    let lastVisible=false,prevTransform='';
    function setWeapon(id){
      id=styles[id]?id:'classic';
      if(id===shown)return;
      shown=id;reloadPlaying=false;
      if(!cache.has(id))cache.set(id,makeSvg(id));
      layer.innerHTML=cache.get(id);
      elements.svg=layer.querySelector('svg');
      for(const id of ['mag','slide','bolt','pump','cylinder','blade'])elements[id]=layer.querySelector('#art-'+id);
      layer.classList.toggle('weapon-knife',shown==='knife');
      prevTransform='';
    }
    function fire(){fireAt=performance.now();}
    function beginReload(){if(shown!=='knife'){reloadPlaying=true;reloadAt=performance.now();}}
    function stopReload(){reloadPlaying=false;for(const key of ['mag','slide','bolt','pump','cylinder'])elements[key]?.removeAttribute('transform');}
    function update(dt,p,state){
      const live=!!(p?.alive && state?.inMatch);
      if(live!==lastVisible){layer.classList.toggle('weapon-visible',live);lastVisible=live;}
      if(!live)return;
      const now=performance.now(),moving=Math.min(1,Math.hypot(p.vel?.x||0,p.vel?.z||0)/7.6);
      const bobX=Math.sin(now*.010)*4*moving;
      const bobY=Math.abs(Math.sin(now*.010))*6*moving;
      const fireT=Math.max(0,1-(now-fireAt)/185);
      const r=reloadPlaying?Math.min(1,Math.max(0,(now-reloadAt)/1100)):0;
      const reloadPulse=reloadPlaying?Math.sin(Math.PI*r):0;
      const sword=shown==='knife';
      // The barrel is tilted upward, along the right side of the screen, not a 3D world object.
      const sway=sword?Math.sin(now*.0018)*1.3:Math.sin(now*.0014)*0.7;
      const x=bobX+fireT*18+(sword?fireT*-35:0);
      const y=bobY+fireT*14+reloadPulse*85+(p.isScoped?185:0);
      const degrees=(sword?49:54)+sway+fireT*(sword?-32:5)+reloadPulse*12;
      const zoom=styles[shown]?.scale||1;
      const transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${degrees.toFixed(2)}deg) scale(${zoom})`;
      if(transform!==prevTransform){elements.svg.style.transform=transform;prevTransform=transform;}
      layer.classList.toggle('weapon-aiming',!!p.isScoped);
      const up=Math.sin(Math.PI*r);
      const down=r<.37?r/.37:r<.68?1:1-(r-.68)/.32;
      if(elements.mag)elements.mag.setAttribute('transform',reloadPlaying?`translate(${(down*7).toFixed(1)} ${(down*105).toFixed(1)}) rotate(${(down*12).toFixed(1)} 590 235)`:'');
      if(elements.slide)elements.slide.setAttribute('transform',reloadPlaying?`translate(${(-up*29).toFixed(1)} 0)`:(fireT>0?`translate(${(-fireT*17).toFixed(1)} 0)`:''));
      if(elements.bolt)elements.bolt.setAttribute('transform',reloadPlaying?`translate(${(-up*53).toFixed(1)} 0)`:'');
      if(elements.pump)elements.pump.setAttribute('transform',reloadPlaying?`translate(${(up*70).toFixed(1)} 0)`:'');
      if(elements.cylinder)elements.cylinder.setAttribute('transform',reloadPlaying?`rotate(${(360*r).toFixed(1)} 559 178) translate(${(up*25).toFixed(1)} 0)`:'');
    }
    setWeapon('classic');
    return {group,flash,setWeapon,fire,beginReload,stopReload,update,get current(){return shown;},styles};
  }
  window.WeaponViewmodels={create,styles,makeSvg};
})();