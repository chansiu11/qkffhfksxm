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
  const idle = [.141,-.115,-.48, .04,-1.26,-.06];
  const equip = [[0,.19,-.27,-.40,.25,-.90,-.85],[.32,.16,-.08,-.45,.12,-1.00,-.83],
    [.58,.14,-.09,-.48,.10,-1.15,-.47],[1,...idle]];
  const inspect = [[0,...idle],[.30,.14,-.075,-.42,.08,-.14,-.16],[.97,.14,-.075,-.42,.12,-.10,-.16],
    [1.21,.045,-.11,-.41,.72,-.88,2.62],[1.60,.04,-.11,-.41,.62,-.90,2.68],
    [1.85,.085,-.12,-.43,.35,-1.16,1.51],[2.54,.09,-.12,-.43,.31,-1.18,1.46],[2.92,...idle]];
  const reload = [[0,...idle],[.20,.14,-.085,-.43,.18,-.63,-.65],
    [.52,.13,-.08,-.42,.18,-.58,-.70],[.68,.135,-.099,-.43,.12,-.62,-.61],
    [.83,.14,-.077,-.46,.18,-1.03,-.42],[1,...idle]];
  function sample(track,t) {
    let i=1; while(i<track.length-1 && t>track[i][0]) i++;
    const a=track[i-1], b=track[i];
    let v=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0]))); v=v*v*(3-2*v);
    return idle.map((_,k)=>a[k+1]+(b[k+1]-a[k+1])*v);
  }
  return {
    prepare(){if(!loading) loading=load().catch(e=>{console.warn('Classic model:', e); loading=null;});},
    inspect(now){inspectAt=now;}, cancel(){inspectAt=-Infinity;},
    update(active,now,draw,reloading,reloadT,recoil,bob) {
      visible=active && ready; if(!visible)return false;
      const t=(now-inspectAt)/1000;
      const p=reloading?sample(reload,reloadT):draw<1?sample(equip,draw):t<2.92?sample(inspect,t):idle;
      pose.position.set(p[0]+.045,p[1]-.04+bob*.0007,p[2]+recoil*.018);
      pose.rotation.set(p[3]+recoil*.11,p[4],p[5],'YXZ');
      return true;
    },
    muzzle(w,h){camera.aspect=w/h;camera.updateProjectionMatrix();pose.updateMatrixWorld(true);
      const pt=pose.localToWorld(new T.Vector3(-.175,.079,0)),depth=-pt.z;pt.project(camera);
      return {x:(pt.x+1)*w/2,y:(1-pt.y)*h/2,depth};},
    render(renderer){if(!visible)return; const auto=renderer.autoClear;renderer.autoClear=false;
      try {renderer.clearDepth();renderer.render(scene,camera);} finally {renderer.autoClear=auto;}}
  };
};