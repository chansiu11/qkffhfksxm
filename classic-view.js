// First-person Classic. The authored FBX uses Y-up and faces negative X.
window.createClassicView = function (T) {
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(48, 1, .02, 4);
  const pose = new T.Group();
  scene.add(pose, new T.HemisphereLight(0xffffff, 0x8b8791, 1.15));
  const light = new T.DirectionalLight(0xffffff, 1.4);
  light.position.set(-2, 3, 2); scene.add(light);
  let ready = false, loading, visible = false, inspectAt = -Infinity;
  const asset = 'refs/classic/Meshy_AI_Black_Semi_Automatic_Pistol_20261125_texture_fbx.zip';
  async function load() {
    const response = await fetch(asset);
    if (!response.ok) throw Error('Classic model HTTP ' + response.status);
    const files = fflate.unzipSync(new Uint8Array(await response.arrayBuffer()));
    const find = suffix => files[Object.keys(files).find(path => path.endsWith(suffix))];
    const fbx = find('.fbx');
    const manager = new T.LoadingManager();
    // The FBX's external paths are exporter-local. Bind the supplied PBR maps explicitly.
    manager.setURLModifier(() => 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
    const model = new T.FBXLoader(manager).parse(fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength), '');
    async function texture(suffix) {
      const url = URL.createObjectURL(new Blob([find(suffix)], {type:'image/png'}));
      try { return await new T.TextureLoader().loadAsync(url); }
      finally { URL.revokeObjectURL(url); }
    }
    const [map, normalMap, roughnessMap, metalnessMap] = await Promise.all(
      ['_texture.png','_normal.png','_roughness.png','_metallic.png'].map(texture));
    map.encoding = T.sRGBEncoding;
    const material = new T.MeshStandardMaterial({map,normalMap,roughnessMap,metalnessMap,metalness:.48,roughness:.85});
    model.traverse(object => { if (object.isMesh) object.material = material; });
    model.scale.multiplyScalar(.00185);
    pose.add(model); ready = true;
  }
  // Time in seconds, followed by camera-local translation and Euler rotation.
  const idle = [0.166,-0.1777,-0.5309,0.05,-1.6185,0.01];
  const raised = [0.1803,-0.1099,-0.6109,0.037,-1.691,-0.484];
  const side = [0.2159,-0.1625,-0.7745,-0.175,-0.5415,-0.3095];
  const reverse = [0.0414,-0.0467,-0.5771,0.543,-1.945,3.837];
  const edge = [0.0674,-0.1978,-0.4842,0.2,-1.0355,-0.295];
  const equip = [[0,.22,-.34,-.47,.28,-1.25,-1.08],[.22,...raised],
    [.43,.176,-.118,-.58,.05,-1.64,-.44],[.70,.17,-.154,-.55,.05,-1.61,-.18],[1,...idle]];
  const inspect = [[0,...idle],[.14,.17,-.17,-.56,.04,-1.05,-.13],[.32,...side],
    [.91,...side],[1.24,...reverse],[1.57,...reverse],[1.82,...edge],
    [2.50,...edge],[2.67,...raised],[2.90,...idle]];
  const reload = [[0,...idle],[.20,.14,-.085,-.43,.18,-.63,-.65],
    [.52,.13,-.08,-.42,.18,-.58,-.70],[.68,.135,-.099,-.43,.12,-.62,-.61],
    [.83,.14,-.077,-.46,.18,-1.03,-.42],[1,...idle]];
  const liftAxis=new T.Vector3(1,0,0);
  const q1=new T.Quaternion(), q2=new T.Quaternion(), angles=new T.Euler(0,0,0,'YXZ');
  function sample(track,t) {
    let i=1; while(i<track.length-1 && t>track[i][0]) i++;
    const a=track[i-1], b=track[i];
    let v=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0]))); v=v*v*(3-2*v);
    q1.setFromEuler(angles.set(a[4],a[5],a[6],'YXZ'));
    q2.setFromEuler(angles.set(b[4],b[5],b[6],'YXZ'));
    angles.setFromQuaternion(q1.slerp(q2,v),'YXZ');
    return [a[1]+(b[1]-a[1])*v,a[2]+(b[2]-a[2])*v,a[3]+(b[3]-a[3])*v,angles.x,angles.y,angles.z];
  }
  return {
    prepare(){if(!loading) loading=load().catch(e=>{console.warn('Classic model:', e); loading=null;});},
    inspect(now){inspectAt=now;}, cancel(){inspectAt=-Infinity;},
    update(active,now,draw,reloading,reloadT,shotAge,bob,burst) {
      visible=active && ready; if(!visible)return false;
      const t=(now-inspectAt)/1000;
      const p=reloading?sample(reload,reloadT):draw<1?sample(equip,draw):t<2.92?sample(inspect,t):idle;
      // Rotate around the grip in camera space so the muzzle lifts even with the body turned sideways.
      const duration=burst?205:158, tShot=Math.min(1,Math.max(0,shotAge/duration));
      const peak=burst?.12:.105;
      const kick=tShot<peak?Math.sin(tShot/peak*Math.PI/2):Math.pow(1-(tShot-peak)/(1-peak),2);
      const tilt=kick*(burst?.19:.125);
      pose.rotation.set(p[3],p[4],p[5],'YXZ');
      pose.rotateOnWorldAxis(liftAxis,tilt);
      pose.position.set(p[0],p[1]+bob*.0007+kick*.008,p[2]+kick*(burst?.035:.022));
      return true;
    },
    muzzle(w,h){camera.aspect=w/h;camera.updateProjectionMatrix();pose.updateMatrixWorld(true);
      const pt=pose.localToWorld(new T.Vector3(-.175,.079,0)),depth=-pt.z;pt.project(camera);
      return {x:(pt.x+1)*w/2,y:(1-pt.y)*h/2,depth};},
    render(renderer){if(!visible)return; const auto=renderer.autoClear;renderer.autoClear=false;
      try {renderer.clearDepth();renderer.render(scene,camera);} finally {renderer.autoClear=auto;}}
  };
};