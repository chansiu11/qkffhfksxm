/* Original, stylized procedural FPS weapon art. Each inventory item has its own silhouette,
 * attachments, accent treatment, moving reload parts and melee-only knife mesh.
 * No external 3D model or copyrighted game assets are required. */
(function () {
  'use strict';
  const styles = {
    knife:    {kind:'blade',   body:0x343f4d,accent:0xf0c85b,detail:0xaab6c4,scale:0.88},
    classic:  {kind:'pistol',  body:0x343d48,accent:0x63d0cb,detail:0xc3cad4,length:0.48,scale:0.87},
    shorty:   {kind:'double',  body:0x58443a,accent:0xd98e53,detail:0xb6a28d,length:0.43,scale:0.95},
    frenzy:   {kind:'machine', body:0x33343f,accent:0xffbf4a,detail:0xcac0a7,length:0.48,scale:0.86},
    ghost:    {kind:'pistol',  body:0x323943,accent:0x65e0d3,detail:0xbdcbd5,length:0.75,scale:0.90,suppressor:true},
    sheriff:  {kind:'revolver',body:0x292e34,accent:0xe2ad4d,detail:0xdfd0a3,length:0.69,scale:1.00},
    stinger:  {kind:'smg',     body:0x423a47,accent:0x9b75ef,detail:0xaaa9b6,length:0.67,scale:0.95},
    spectre:  {kind:'smg',     body:0x303e49,accent:0x4caed2,detail:0xb5c9d6,length:0.84,scale:1.00,suppressor:true},
    bucky:    {kind:'pump',    body:0x4d3931,accent:0xe0a35b,detail:0xa89e90,length:1.08,scale:1.06},
    judge:    {kind:'autoShot',body:0x39343a,accent:0xeb7a55,detail:0xb1b3bc,length:0.94,scale:1.08},
    bulldog:  {kind:'bullpup', body:0x323f43,accent:0x66c8a9,detail:0xc2c9c3,length:0.88,scale:1.07},
    guardian: {kind:'dmr',     body:0x354453,accent:0x81ace4,detail:0xd1dce7,length:1.10,scale:1.08},
    phantom:  {kind:'rifle',   body:0x263a3c,accent:0x52d3bf,detail:0xb1cfd0,length:1.02,scale:1.08,suppressor:true},
    vandal:   {kind:'rifle',   body:0x42383c,accent:0xe66b6a,detail:0xaeb9c2,length:1.06,scale:1.08},
    marshal:  {kind:'sniper',  body:0x425049,accent:0xa4bf72,detail:0xc4d0ca,length:1.28,scale:1.1},
    outlaw:   {kind:'break',   body:0x40394b,accent:0xb18de7,detail:0xd0c6c9,length:1.18,scale:1.12},
    operator: {kind:'heavy',   body:0x3f3e33,accent:0xe4c35e,detail:0xbfc6ca,length:1.40,scale:1.13}
  };
  const box = (T,w,h,d) => new T.BoxGeometry(w,h,d);
  const cyl = (T,r,depth,segments=12) => new T.CylinderGeometry(r,r,depth,segments);
  const round = (T,r=0.08) => new T.SphereGeometry(r,10,8);
  const material = (T,color,metal=0.55,rough=0.42) => new T.MeshStandardMaterial({color,metalness:metal,roughness:rough});
  const ease = n => n*n*(3-2*n);
  const clamp = v => Math.max(0, Math.min(1, v));

  function create(T, catalog) {
    const group = new T.Group(), cache = new Map();
    const flash = new T.Mesh(round(T,0.08), new T.MeshBasicMaterial({color:0xfff0a7,transparent:true,opacity:0}));
    group.add(flash);
    const gloveMat=material(T,0x222a35,0.05,0.96);
    const sharedDark=material(T,0x171f28,0.32,0.63);
    let shown='', active=null, fireAt=-10000, reloadAt=-10000, reloadKey='', reloadPlaying=false;

    function mesh(parent,geometry,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0) {
      const m = new T.Mesh(geometry,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parent.add(m);return m;
    }
    function block(parent,mat,w,h,d,x,y,z,rx=0,ry=0,rz=0) {return mesh(parent,box(T,w,h,d),mat,x,y,z,rx,ry,rz);}
    function tube(parent,mat,r,length,x,y,z) {return mesh(parent,cyl(T,r,length),mat,x,y,z,Math.PI/2);}
    function accentLine(parent,m,z,l=0.35,y=0.1){return block(parent,m,0.016,0.021,l,0.091,y,z);}
    function makeLabel(parent,text,accent,scale,z) {
      const cv=document.createElement('canvas');cv.width=256;cv.height=60;
      const ctx=cv.getContext('2d');if(!ctx)return;
      ctx.fillStyle='#101b24';ctx.fillRect(0,2,256,56);
      ctx.fillStyle='#'+accent.toString(16).padStart(6,'0');ctx.fillRect(3,5,15,50);
      ctx.fillStyle='#e4edf3';ctx.font='bold 27px Arial';ctx.fillText(text,25,39);
      const texture=new T.CanvasTexture(cv);texture.anisotropy=2;
      const tag=new T.Mesh(new T.PlaneGeometry(Math.max(0.17,Math.min(0.38,text.length*0.029)),0.078),
        new T.MeshBasicMaterial({map:texture,transparent:true,side:T.DoubleSide,depthWrite:false}));
      tag.rotation.y=Math.PI/2;tag.position.set(0.117,0.056,z);
      parent.add(tag);
    }

    function build(id) {
      const s=styles[id]||styles.classic,k=s.kind,L=s.length||0.8;
      const root=new T.Group();root.scale.setScalar(s.scale||1);
      const dark=material(T,s.body),edge=material(T,s.accent,0.6,0.3),steel=material(T,s.detail),grip=material(T,0x17212b,0.25,0.87);
      const nodes={root,mag:null,slide:null,bolt:null,cylinder:null,front:null,glove:null,kind:k,length:L};
      if(k==='blade') {
        // A distinct curved blade silhouette (no firearm body or muzzle part).
        block(root,grip,0.082,0.105,0.26,0,-0.055,0.27,0,0,0.05);
        for(let i=0;i<6;i++)block(root,edge,0.092,0.012,0.01,0,-0.058,0.16+i*0.042,0,0,0.04);
        block(root,steel,0.22,0.058,0.054,0,-0.02,0.09,0,0,0.02);
        const shape=new T.Shape();shape.moveTo(-0.038,0.09);shape.lineTo(-0.044,-0.28);
        shape.quadraticCurveTo(-0.035,-0.59,-0.012,-0.68);shape.quadraticCurveTo(0.055,-0.61,0.075,-0.39);
        shape.lineTo(0.045,0.09);shape.closePath();
        const bladeGeometry=new T.ExtrudeGeometry(shape,{depth:0.027,bevelEnabled:true,bevelThickness:0.008,bevelSize:0.006,bevelSegments:2});
        const blade=mesh(root,bladeGeometry,material(T,0xaac4d3,0.9,0.17));
        blade.rotation.y=Math.PI/2;blade.rotation.x=-Math.PI/2;
        blade.position.set(-0.014,0.08,-0.03);
        block(root,edge,0.017,0.018,0.38,0.04,0.04,-0.34);
        nodes.front=-0.65;
        nodes.glove=mesh(root,round(T,0.105),gloveMat,0,-0.14,0.34);
        return nodes;
      }
      const pistol=['pistol','machine','revolver','double'].includes(k);
      const shotgun=['pump','autoShot','double'].includes(k);
      const sniper=['sniper','heavy','break'].includes(k);
      const bullpup=k==='bullpup';
      const heavy=k==='heavy', long=k==='sniper';
      const thickness=pistol?0.17:heavy?0.25:0.21;
      const w=pistol?0.155:heavy?0.25:0.208;
      const bodyLen=pistol?L*0.68:sniper?L*0.57:L*0.67;
      const bodyRear=pistol?0.14:0.10;
      const bodyCenter=bodyRear-bodyLen*0.18;
      block(root,dark,w,thickness,bodyLen,0,0,bodyCenter);
      block(root,steel,w*0.82,0.035,bodyLen*0.74,0,thickness/2+0.01,bodyCenter-0.01);
      block(root,edge,w+0.012,0.034,bodyLen*0.34,0,thickness/2-0.017,bodyCenter-bodyLen*.22);
      // Individual machined panel ribs / serial decoration along the visible receiver.
      for(let i=0;i<(pistol?3:7);i++){
        const z=bodyCenter-bodyLen*.43+(i+.4)*bodyLen/(pistol?3:8);
        block(root,i%2?grip:steel,0.014,0.011,0.025,w/2+.008,0.055,z);
      }
      // Forward barrel and muzzle are physically distinct from the chassis.
      const muzzleZ=-L*0.59;
      const barrelRear=bodyCenter-bodyLen*.5;
      tube(root,steel,shotgun?0.052:heavy?0.05:0.029,Math.max(0.12,barrelRear-muzzleZ),0,0.025,(barrelRear+muzzleZ)*0.5);
      tube(root,grip,shotgun?0.048:0.035,0.055,0,0.025,muzzleZ-0.022);
      nodes.front=muzzleZ-0.032;
      // Hand grip with an angled rear, trigger guard, finger groove.
      const handZ=pistol?0.16:bodyRear+.03;
      const h=block(root,grip,0.106,0.23,0.14,0,-0.175,handZ,0.15);
      block(root,edge,0.110,0.025,0.12,0,-0.273,handZ+0.015);
      for(let i=0;i<4;i++)block(root,steel,0.004,0.008,0.065,0.056,-0.2+i*.025,handZ);
      const guard=mesh(root,new T.TorusGeometry(0.09,0.013,7,14,Math.PI*1.34),grip,0,-0.13,handZ-0.09,0,Math.PI/2,0);
      guard.rotation.x=0.19;
      nodes.glove=mesh(root,round(T,pistol?0.095:0.115),gloveMat,0.005,-0.27,handZ+0.04);
      if(!pistol) {
        // Padded stock assembly and diagonal cheek plate; each family differs in length and shape.
        const stockRear=bullpup?0.23:long?0.40:heavy?0.39:0.32;
        const stockL=stockRear-bodyRear+0.16;
        block(root,grip,0.085,0.1,stockL,0,-0.035,bodyRear+stockL*0.35);
        block(root,dark,w*0.8,0.12,0.14,0,0.04,stockRear);
        block(root,steel,w+0.005,0.18,0.037,0,0.01,stockRear+0.079);
        block(root,edge,0.018,0.031,0.18,w/2,0.065,stockRear-0.025);
      }
      // Receiver-mounted magazine: unique position + silhouette per category.
      if(k==='revolver') {
        nodes.cylinder=new T.Group();nodes.cylinder.position.set(0,-0.025,-0.025);root.add(nodes.cylinder);
        tube(nodes.cylinder,steel,0.09,0.16,0,0,0);
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3;block(nodes.cylinder,grip,0.023,0.028,0.17,Math.sin(a)*0.071,Math.cos(a)*0.072,0);
        }
        block(root,edge,0.14,0.035,0.12,0,0.12,-0.2);
      } else if(k==='double') {
        tube(root,steel,0.045,L*.86,-0.062,0.012,muzzleZ+L*.37);
        tube(root,steel,0.045,L*.86,0.062,0.012,muzzleZ+L*.37);
        block(root,edge,0.18,0.04,0.11,0,0.06,-0.14);
      } else if(k==='break') {
        tube(root,steel,0.043,L*.74,-0.051,0.027,muzzleZ+L*.34);
        tube(root,steel,0.043,L*.74,0.051,0.027,muzzleZ+L*.34);
        nodes.bolt=block(root,edge,0.18,0.13,0.13,0,0.045,-0.08);
      } else {
        nodes.mag=new T.Group();
        const magZ=bullpup?0.23:(k==='autoShot'?0.015:pistol?handZ:.015);
        nodes.mag.position.set(0,-0.16,magZ);root.add(nodes.mag);
        const magDepth=(pistol?0.115:k==='autoShot'?0.20:sniper?0.145:0.135);
        const magHeight=pistol?0.12:k==='autoShot'?0.19:sniper?0.16:0.25;
        block(nodes.mag,grip,w*.64,magHeight,magDepth,0,-magHeight/2,0,0.13);
        block(nodes.mag,edge,w*.67,0.018,magDepth,0,-magHeight,0);
        for(let i=0;i<4;i++)block(nodes.mag,steel,0.009,0.015,magDepth*.73,w*.33, -0.05-i*magHeight*.18,0);
        if(k==='rifle' && id==='vandal')nodes.mag.rotation.x=-0.24;
      }
      nodes.slide=block(root,edge,w*.94,0.034,pistol?L*.62:bodyLen*.41,0,thickness/2+0.029,bodyCenter-bodyLen*.18);
      nodes.bolt=nodes.bolt || block(root,steel,0.09,0.039,0.14,0.0,thickness/2+0.06,bodyCenter);
      if(k==='machine'||k==='smg'||k==='rifle'||k==='bullpup'||k==='dmr') {
        // Rail cutouts, side vents, retaining pins and multi-layer sights.
        for(let i=0;i<6;i++){
          const z=muzzleZ+.095+i*.056;
          block(root,grip,0.022,0.019,0.024,w/2,0.067,z);
        }
        block(root,grip,w*.66,0.03,0.31,0,thickness/2+.085,bodyCenter-.04);
        for(let i=0;i<5;i++)block(root,steel,w*.69,0.01,0.026,0,thickness/2+.102,bodyCenter-.16+i*.07);
        block(root,steel,0.017,0.075,0.025,0,thickness/2+.143,bodyCenter-.22);
        block(root,grip,0.035,0.077,0.028,0,thickness/2+.137,bodyCenter+.15);
      }
      if(s.suppressor) {
        const len=id==='ghost'?0.24:id==='spectre'?0.20:0.23;
        tube(root,grip,id==='ghost'?0.048:0.056,len,0,0.025,muzzleZ-len/2);
        tube(root,edge,0.052,0.016,0,0.025,muzzleZ-len+.025);
        nodes.front=muzzleZ-len;
      }
      if(k==='pump') {
        nodes.front= -0.71;
        const pump=block(root,edge,0.17,0.12,0.27,0,-0.09,-0.37);
        for(let i=0;i<5;i++)block(pump,grip,0.014,0.014,0.025,0.092,-.005,-.1+i*.047);
        nodes.slide=pump;
        block(root,steel,0.02,0.032,0.25,0.04,-0.085,-0.15);
      }
      if(k==='autoShot') {
        // High-capacity shotgun's broad rotating magazine profile.
        const drum=mesh(root,new T.CylinderGeometry(0.115,0.115,0.13,12),grip,0,-0.20,-0.015,0,0,Math.PI/2);
        nodes.mag=drum;
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3;
          mesh(drum,round(T,0.011),edge,Math.sin(a)*0.083,0,Math.cos(a)*0.083);
        }
      }
      if(sniper || k==='dmr') {
        // Stacked optic tube with a visible objective ring and adjustment dials.
        const opticZ=bodyCenter-.09;
        block(root,steel,0.055,0.05,0.075,0,thickness/2+0.09,opticZ+.14);
        block(root,steel,0.055,0.05,0.075,0,thickness/2+0.09,opticZ-.17);
        tube(root,grip,heavy?0.09:long?0.072:0.057,0.42,0,thickness/2+.19,opticZ);
        tube(root,edge,heavy?0.095:long?0.075:0.06,0.022,0,thickness/2+.19,opticZ-.205);
        block(root,edge,0.065,0.065,0.064,0,thickness/2+.295,opticZ+.02);
        block(root,steel,0.028,0.035,0.07,0.095,thickness/2+.20,opticZ+.01);
      }
      if(k==='heavy') {
        // Oversized operator barrel shroud with weight-saving grooves.
        for(let i=0;i<5;i++)block(root,i%2?edge:grip,0.20,0.025,0.034,0,0.04,muzzleZ+.10+i*.07);
        block(root,grip,0.14,0.05,0.23,0,-0.105,0.05);
      }
      if(k==='bullpup'){
        // Rear magazine well and forward grip make the Bulldog's silhouette recognizable.
        block(root,edge,0.145,0.12,0.18,0,-0.1,0.20);
        block(root,grip,0.12,0.13,0.15,0,-0.19,-0.27);
      }
      if(k==='pistol' || k==='machine' || k==='revolver') {
        for(let i=0;i<5;i++)block(root,grip,0.017,0.012,0.024,w/2,thickness/2+.043,bodyCenter-.14+i*.045);
        if(id==='frenzy')block(root,edge,0.15,0.09,0.22,0,-.04,-0.16);
        if(id==='classic')block(root,edge,0.13,0.04,0.20,0,-.01,-0.12);
      }
      // Nameplate, family badge, hardware rivets, hand at weapon grip.
      const labelZ=k==='bullpup'?.08:bodyCenter+.035;
      makeLabel(root,id.toUpperCase(),s.accent,s.scale,labelZ);
      for(let i=0;i<3;i++)mesh(root,round(T,0.012),steel,w/2+0.002,0.028,bodyCenter-bodyLen*.3+i*bodyLen*.29);
      return nodes;
    }
    function setWeapon(id) {
      if (!styles[id]) id='classic';
      if (id===shown)return;
      if (active)active.root.visible=false;
      if(!cache.has(id)){const model=build(id);cache.set(id,model);group.add(model.root);}
      shown=id;active=cache.get(id);active.root.visible=true;
      flash.position.set(0,0.015,active.front);
      flash.visible=id!=='knife';flash.material.opacity=0;
      reloadPlaying=false;
      group.rotation.set(0,0,0);
    }
    function fire() {fireAt=performance.now();}
    function beginReload() {if(shown==='knife')return;reloadKey=shown;reloadAt=performance.now();reloadPlaying=true;}
    function stopReload() {reloadPlaying=false;}
    function update(dt, p, match) {
      if(!active)return;
      const now=performance.now();const s=styles[shown];
      if(p.reloading && !reloadPlaying)beginReload();
      if(!p.reloading && reloadPlaying)stopReload();
      const fireT=(now-fireAt)/1000;const swinging=shown==='knife'&&fireT<0.32;
      const reloadT=reloadPlaying&&reloadKey===shown?clamp((now-reloadAt)/1100):0;
      const walking=p.vel ? Math.min(1,Math.hypot(p.vel.x,p.vel.z)/7) : 0;
      const sw=(now*.008)% (Math.PI*2);
      const bounce=Math.sin(sw)*0.012*walking;
      group.rotation.x = bounce*.6;
      group.rotation.y = -0.27+(p.isScoped?0.22:0);
      group.rotation.z = -0.045+(p.isScoped?0.04:0);
      if(swinging){const k=Math.sin((fireT/.32)*Math.PI);group.rotation.y+=0.9*k;group.rotation.z-=1.2*k;group.rotation.x+=0.3*k;}
      if(reloadPlaying){const k=Math.sin(reloadT*Math.PI);group.rotation.x+=k*.48;group.rotation.z+=k*.17;group.rotation.y+=k*.12;}
      group.position.y=-.22+bounce-(reloadPlaying?Math.sin(reloadT*Math.PI)*.065:0);
      const nodes=active;
      if(nodes.mag){
        nodes.mag.position.y=nodes.mag.userData.originalY??nodes.mag.position.y;
        if(nodes.mag.userData.originalY==null)nodes.mag.userData.originalY=nodes.mag.position.y;
        const shift=reloadT<.35?ease(reloadT/.35):reloadT<.63?1:1-ease((reloadT-.63)/.37);
        if(reloadPlaying){nodes.mag.position.y=nodes.mag.userData.originalY-shift*.28;
          if(nodes.kind==='autoShot')nodes.mag.rotation.y=shift*1.7;
          else if(nodes.kind==='rifle')nodes.mag.rotation.x=(shown==='vandal'?-0.24:0)-shift*.18;}
        else {nodes.mag.rotation.y=0;if(nodes.kind==='rifle')nodes.mag.rotation.x=(shown==='vandal'?-0.24:0);}
      }
      if(nodes.slide){
        if(nodes.slide.userData.originalZ==null)nodes.slide.userData.originalZ=nodes.slide.position.z;
        let v=0;
        if(reloadPlaying){if(['pump','double'].includes(nodes.kind))v=Math.sin(reloadT*Math.PI*2)*.13;
          else if(['pistol','machine','revolver'].includes(nodes.kind))v=Math.max(0,Math.sin((reloadT-.66)*Math.PI*4))*.095;
          else v=Math.max(0,Math.sin((reloadT-.74)*Math.PI*5))*.085;}
        else if(fireT<.12)v=Math.sin(fireT/.12*Math.PI)*.055;
        nodes.slide.position.z=nodes.slide.userData.originalZ+v;
      }
      if(nodes.bolt){
        if(nodes.bolt.userData.originalZ==null)nodes.bolt.userData.originalZ=nodes.bolt.position.z;
        let v=0;
        if(reloadPlaying){
          if(['sniper','heavy','dmr'].includes(nodes.kind))v=Math.sin(reloadT*Math.PI*2)*.16;
          else if(nodes.kind==='break')v=Math.sin(reloadT*Math.PI)*.10;
        }
        nodes.bolt.position.z=nodes.bolt.userData.originalZ+v;
        if(nodes.kind==='break')nodes.bolt.rotation.x=reloadPlaying?Math.sin(reloadT*Math.PI)*.37:0;
      }
      if(nodes.cylinder){nodes.cylinder.position.x=reloadPlaying?Math.sin(reloadT*Math.PI)*.19:0;
        nodes.cylinder.rotation.z=reloadPlaying?reloadT*Math.PI*2:0;}
      if(nodes.glove){
        if(nodes.glove.userData.baseY==null)nodes.glove.userData.baseY=nodes.glove.position.y;
        nodes.glove.position.y=nodes.glove.userData.baseY+(reloadPlaying?Math.sin(reloadT*Math.PI)*.13:0);
      }
      if(shown==='knife')flash.material.opacity=0;
    }
    setWeapon('classic');
    return {group,flash,setWeapon,fire,beginReload,stopReload,update,get current(){return shown;},styles};
  }
  window.WeaponViewmodels={create,styles};
})();