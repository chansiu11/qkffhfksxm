// Single-shot weapon and movement samples from github.com/unkwsr/open-aim.
const MatchSamples = (() => {
  const weapons = 'bucky bulldog classic frenzy ghost judge marshal operator phantom sheriff shorty spectre stinger vandal guardian outlaw ares odin'.split(' ');
  const footsteps = Array.from({length: 7}, (_, i) => 'step-0' + (i + 1));
  const buffers = new Map();

  let previousStep = -1;

  const clips = new Map();
  let clickRequest=0;
  function cleanClick(ctx,buffer) {
    // Retain the first attack of the recorded click and fade the room tail.
    const pcm=buffer.getChannelData(0), rate=buffer.sampleRate;
    let peak=0;
    for(const sample of pcm) peak=Math.max(peak,Math.abs(sample));
    if(!peak)return buffer;
    const start=Math.max(0,pcm.findIndex(v=>Math.abs(v)>peak*.12)-Math.round(rate*.002));
    const length=Math.min(buffer.length-start,Math.round(rate*.08));
    const clip=ctx.createBuffer(buffer.numberOfChannels,length,rate);
    for(let ch=0;ch<buffer.numberOfChannels;ch++){
      const out=clip.getChannelData(ch),input=buffer.getChannelData(ch);
      for(let i=0;i<length;i++)out[i]=input[start+i]*Math.min(1,i/(rate*.001),(length-1-i)/(rate*.018));
    }
    return clip;
  }
  function loadClip(ctx,name) {
    if (!clips.has(name)) {
      const folder=name==='menu-click'?'ui':'melee';
      const request=fetch('audio/'+folder+'/'+name+'.wav?v=recording2')
        .then(response=>{if(!response.ok)throw Error(response.status);return response.arrayBuffer();})
        .then(bytes=>ctx.decodeAudioData(bytes))
        .then(buffer=>buffers.set(name,name==='menu-click'?cleanClick(ctx,buffer):buffer))
        .catch(()=>{clips.delete(name);return null;});
      clips.set(name,request);
    }
    return clips.get(name);
  }
  function preloadJobs(ctx) {
    const jobs=['menu-click','knife-light','knife-heavy'].map(name=>()=>loadClip(ctx,name));
    for(const name of [...weapons,...footsteps,'land-01']){
      const folder=weapons.includes(name)?'guns':'movement';
      jobs.push(async()=>{
        if(buffers.has(name))return true;
        const response=await fetch('audio/'+folder+'/'+name+'.ogg');
        if(!response.ok)throw Error(name);
        buffers.set(name,await ctx.decodeAudioData(await response.arrayBuffer()));
        return true;
      });
    }
    for(const id of weapons)for(const action of ['equip','reload']){
      if(id!=='outlaw'||action!=='equip')jobs.push(()=>loadHandling(ctx,id,action));
    }
    return jobs;
  }

  function play(ctx, output, kind, weapon, position, volume) {
    let name = weapon === 'knife' ? 'knife-light' : weapon;
    if (kind === 'land') name = 'land-01';
    if (kind === 'step') {
      previousStep = (previousStep + 1 + Math.floor(Math.random() * 6)) % footsteps.length;
      name = footsteps[previousStep];
    }
    const buffer = buffers.get(name);
    if (!buffer && (name==='menu-click'||name==='knife-light'||name==='knife-heavy')) {
      const requested=performance.now();
      const sequence=name==='menu-click'?++clickRequest:0;
      loadClip(ctx,name).then(loaded=>{
        if(loaded && (name!=='menu-click'||sequence===clickRequest) && performance.now()-requested<(name==='menu-click'?120:400)) play(ctx,output,kind,name,position,volume);
      });
      return true;
    }
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const pan = position && ctx.createPanner();
    source.buffer = buffer;
    gain.gain.value = volume;
    if (pan) {
      pan.panningModel = 'HRTF';
      pan.rolloffFactor = 0; // gameSound already applies distance attenuation.
      pan.setPosition(position.x, position.y, position.z);
      source.connect(pan).connect(gain);
    } else source.connect(gain);
    gain.connect(output);
    source.onended = () => { source.disconnect(); gain.disconnect(); if (pan) pan.disconnect(); };
    source.start();
    return true;
  }

  // Equip and reload sounds: Technolimit/ValorantReal and HsHappy/valorant-mc-mod.
  const handlingBuffers = new Map();
  const oggReloads = new Set(['bucky', 'marshal', 'outlaw']);
  let handlingKey = '';
  let handlingSource = null;
  let handlingGeneration = 0;

  function loadHandling(ctx, weapon, action) {
    if (!weapons.includes(weapon) || (weapon === 'outlaw' && action === 'equip')) return;
    const key = weapon + '-' + action;
    if (!handlingBuffers.has(key)) {
      const extension = action === 'reload' && oggReloads.has(weapon) ? 'ogg' : 'mp3';
      handlingBuffers.set(key, fetch('audio/handling/' + key + '.' + extension)
        .then(response => {
          if (!response.ok) throw new Error(String(response.status));
          return response.arrayBuffer();
        })
        .then(bytes => ctx.decodeAudioData(bytes))
        .catch(() => { handlingBuffers.delete(key); return null; }));
    }
    return handlingBuffers.get(key);
  }

  function updateHandling(ctx, output, weapon, reloading, duration) {
    if (weapon && (!ctx || !output)) return;
    const key = weapon ? weapon + (reloading ? ':reload' : ':ready') : '';
    if (key === handlingKey) return;
    const previous = handlingKey;
    handlingKey = key;
    const generation = ++handlingGeneration;
    if (handlingSource) { handlingSource.stop(); handlingSource = null; }
    if (!weapon || !ctx || !output) return;
    if (!reloading) loadHandling(ctx, weapon, 'reload');
    if (!reloading && previous === weapon + ':reload') return;
    const clip = loadHandling(ctx, weapon, reloading ? 'reload' : 'equip');
    if (!clip || !(duration > 0)) return;
    const started = ctx.currentTime;
    clip.then(buffer => {
      if (!buffer || generation !== handlingGeneration) return;
      const rate = buffer.duration / duration;
      const offset = (ctx.currentTime - started) * rate;
      if (offset >= buffer.duration) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = 0.48;
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.connect(gain).connect(output);
      source.onended = () => {
        source.disconnect(); gain.disconnect();
        if (handlingSource === source) handlingSource = null;
      };
      handlingSource = source;
      source.start(0, offset);
    });
  }

  return {preloadJobs, play, updateHandling};
})();
