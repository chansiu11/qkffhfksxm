/* First-person cosmetic sidearms, modeled in arbitrary scene units. */
window.PistolView = (() => {
  const specs = {
    classic: {length:.82, width:.18, top:.20, grip:.34, finish:0x424951, draw:-.34, inspect:2.7},
    shorty:  {length:1.05,width:.23, top:.16, grip:.29, finish:0x393b3e, draw:.63, inspect:3.15},
    frenzy:  {length:.79, width:.21, top:.26, grip:.36, finish:0x44484c, draw:-.63, inspect:3.05},
    ghost:   {length:.85, width:.16, top:.18, grip:.34, finish:0x363e48, draw:.44, inspect:2.85},
    bandit:  {length:.83, width:.19, top:.19, grip:.35, finish:0x525058, draw:-.49, inspect:2.85},
    sheriff: {length:.97, width:.20, top:.23, grip:.34, finish:0x5d636a, draw:.75, inspect:3.0}
  };
  function create(T) {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(48,1,.015,8);
    scene.add(new T.HemisphereLight(0xfff2df,0x687687,1.18));
    const light = new T.DirectionalLight(0xffefe0,1.8);
    light.position.set(-2,3,1); scene.add(light);
    const rig = new T.Group(); scene.add(rig);
    const cache = new Map(), materials = new Map();
    function material(color, metallic=false) {
      const key = color + ':' + metallic;
      if (!materials.has(key)) materials.set(key,new T.MeshStandardMaterial({color,metalness:metallic?.38:.03,roughness:metallic?.43:.84}));
      return materials.get(key);
    }
    function mesh(parent,geometry,color,x,y,z,metallic=false) {
      const obj=new T.Mesh(geometry,material(color,metallic));
      obj.position.set(x,y,z); parent.add(obj); return obj;
    }
    function box(p,x,y,z,w,h,l,c){return mesh(p,new T.BoxGeometry(w,h,l),c,x,y,z,true);}
    function tube(p,x,y,z,r,l,c,sides=16){
      const obj=mesh(p,new T.CylinderGeometry(r,r,l,sides),c,x,y,z,true);
      obj.rotation.x=Math.PI/2; return obj;
    }
    // A bevelled closed side profile, extruded across the width of the prop.
    function profile(p,points,width,color){
      const shape=new T.Shape();
      points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y)); shape.closePath();
      const geo=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelThickness:.008,bevelSize:.009,bevelSegments:1,steps:1});
      geo.translate(0,0,-width/2);geo.rotateY(Math.PI/2);
      return mesh(p,geo,color,0,0,0,true);
    }
    function build(id){
      const s=specs[id],g=new T.Group(),body=new T.Group();g.add(body);
      const steel=s.finish,dark=0x25282d,trim=0x63696e,L=s.length,W=s.width,H=s.top;
      const upper=new T.Group();body.add(upper);
      profile(body,[[-.12,.02],[L*.80,.035],[L*.79,-.075],[.24,-.11],[.12,-s.grip-.09],[-.09,-s.grip-.08],[.008,-.075],[-.12,-.055]],W*.88,dark);
      profile(body,[[.02,-.095],[.18,-.12],[.082,-s.grip-.067],[-.072,-s.grip-.06]],W*.95,0x363538);
      for(let i=0;i<4;i++)box(body,0,-.15-i*.042,.002+i*.018,W*.98,.011,.096,0x48484b);
      profile(body,[[.17,-.19],[.33,-.18],[.38,-.075],[.405,-.075],[.361,-.215],[.16,-.22]],W*.33,dark);
      if(id==='shorty'){
        for(const x of [-.065,.065]){
          tube(upper,x,.105,-L*.56,.074,L*.89,steel);
          tube(upper,x,.105,-L-.003,.054,.011,0x16181a);
        }
        profile(body,[[.26,-.026],[.78,-.008],[.72,-.116],[.32,-.126]],W,0x393536);
      }else{
        profile(upper,[[-.115,.035],[-.115,H*.78],[-.065,H],[L*.82,H],[L,H*.74],[L,.045],[L*.78,.025]],W,steel);
        for(let i=0;i<6;i++)for(const sign of [-1,1]){
          const ridge=box(upper,sign*(W*.5+.009),H*.6,-.012-i*.029,.009,H*.49,.010,dark);
          ridge.rotation.x=-.23;
        }
        if(id==='ghost'){
          tube(upper,0,.115,-L-.23,.078,.48,dark);
          for(const z of [-L-.04,-L-.44])tube(upper,0,.115,z,.082,.025,trim);
        }
        if(id==='sheriff'||id==='bandit'){
          tube(body,0,.041,-.19,id==='sheriff'?.147:.097,.27,steel,12);
          for(let i=0;i<6;i++){
            const a=i*Math.PI/3; tube(body,.111*Math.cos(a),.041+.111*Math.sin(a),-.19,.019,.19,dark,8);
          }
        }
        if(id==='frenzy'){
          profile(body,[[.02,.30],[.41,.30],[.47,.12],[.41,.12],[.36,.253],[.03,.253]],W*.7,steel);
          box(body,0,-.15,-.47,W*.83,.17,.14,dark);
        }
        const tip=id==='ghost'?L+.474:L+.011;
        tube(upper,0,.112,-tip,W*.26,.008,0x191b1e);
        box(upper,0,H+.02,-L*.86,.022,.039,.040,trim);
        for(const x of [-.047,.047])box(upper,x,H+.016,.035,.026,.039,.049,dark);
      }
      const muzzle=new T.Object3D();muzzle.position.set(0,.112,-L-(id==='ghost'?.48:0));body.add(muzzle);
      return {g,upper,muzzle};
    }
    let current=null,id='',inspectAt=-1e6;
    function select(key){
      if(current)current.g.visible=false;
      id=key;current=null;inspectAt=-1e6;aimTarget=false;aim=0;
      if(!specs[key])return false;
      if(!cache.has(key)){const model=build(key);cache.set(key,model);rig.add(model.g);}
      current=cache.get(key);current.g.visible=true;return true;
    }
    function inspect(){if(current){aimTarget=false;inspectAt=performance.now();}}
    function cancel(){inspectAt=-1e6;}
    const smooth=t=>t*t*(3-2*t);
    function sample(keys,t){
      const end=keys.findIndex(k=>k[0]>=t);
      if(end<1)return (end===0?keys[0]:keys[keys.length-1]).slice(1);
      const a=keys[end-1],b=keys[end],u=smooth((t-a[0])/(b[0]-a[0]));
      return a.slice(1).map((v,i)=>v+(b[i+1]-v)*u);
    }
    // Lift, reveal the side, turn the wrist to show the upper contour, settle.
    const inspection=[[0,0,0,0,0,0],[.20,-.11,.085,.42,1.09,-.43],[.42,-.12,.10,.36,1.19,-.61],
      [.66,-.045,.085,-.04,-.83,.66],[.82,-.025,.060,.18,-.70,.57],[1,0,0,0,0,0]];
    const inspectionVariants = {
      shorty:[[0,0,0,0,0,0],[.19,-.09,.04,.14,.81,-.20],[.44,-.12,.03,-.30,1.14,.42],[.66,-.045,.12,.91,-.22,-.20],[.84,-.01,.11,.74,-.06,-.08],[1,0,0,0,0,0]],
      frenzy:[[0,0,0,0,0,0],[.20,-.105,.09,.40,1.06,-.69],[.43,-.11,.085,.27,1.16,-.76],[.70,-.08,.07,-.19,-1.04,.83],[.85,-.05,.05,-.12,-.89,.67],[1,0,0,0,0,0]],
      sheriff:[[0,0,0,0,0,0],[.18,-.07,.12,.67,.48,-.22],[.38,-.13,.08,.27,1.18,-.52],[.62,-.13,.10,.29,1.08,-.60],[.82,-.05,.09,.31,-.65,.62],[1,0,0,0,0,0]]
    };
    let visible=false,aimTarget=false,aim=0,lastTime=0;
    function toggleAim(){if(current){aimTarget=!aimTarget;cancel();}}
    function update(now,w,h,alive,draw,fire,reload,moving){
      visible=!!current&&alive;if(!visible){aimTarget=false;aim=0;return;}
      if(reload>0)aimTarget=false;
      const dt=Math.max(0,Math.min(.1,(now-lastTime)/1000));lastTime=now;
      aim+=(Number(aimTarget)-aim)*(1-Math.exp(-dt*26));
      const s=specs[id],aspect=w/h;
      if(camera.aspect!==aspect){camera.aspect=aspect;camera.updateProjectionMatrix();}
      const t=Math.min(1,(now-inspectAt)/(s.inspect*1000));
      const [x,y,pitch,yaw,roll]=sample(inspectionVariants[id]||inspection,t);
      const lift=1-smooth(Math.max(0,Math.min(1,draw)));
      const bob=Math.sin(now*.012)*moving*.008;
      const dip=Math.sin(Math.PI*reload);
      rig.scale.setScalar(Math.min(1,aspect/1.42)*.70);
      rig.position.set(Math.min(.32,aspect*.18)+x+lift*.10,-.24+y-lift*.23-dip*.14+bob,-.78+fire*.045);
      rig.rotation.set(.15+pitch+lift*.89+fire*.15+dip*.42,.19+yaw*(id==='ghost'?.72:.85)+lift*s.draw,-.035+roll+lift*s.draw*.62-dip*.48);
      rig.position.x*=1-aim;
      rig.position.y+=( -.17-rig.position.y)*aim;
      rig.rotation.y*=1-aim;rig.rotation.z*=1-aim;
      rig.rotation.x+=(.066-rig.rotation.x)*aim;
      current.upper.position.z=fire*.045;
    }
    function render(renderer){
      if(!visible)return;
      const old=renderer.autoClear;renderer.autoClear=false;
      try{renderer.clearDepth();renderer.render(scene,camera);}finally{renderer.autoClear=old;}
    }
    function muzzleScreen(w,h){
      if(!current||!visible)return null;
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
      const point=current.muzzle.getWorldPosition(new T.Vector3()),depth=-point.z;
      point.project(camera);return {x:(point.x+1)*w/2,y:(1-point.y)*h/2,depth};
    }
    return {select,inspect,cancel,toggleAim,update,render,muzzleScreen};
  }
  return {create,has:id=>Object.hasOwn(specs,id)};
})();