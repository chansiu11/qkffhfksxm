// Single-shot weapon and movement samples from github.com/unkwsr/open-aim.
const MatchSamples = (() => {
  const weapons = 'bucky bulldog classic frenzy ghost judge marshal operator phantom sheriff shorty spectre stinger vandal guardian outlaw ares odin'.split(' ');
  const footsteps = Array.from({length: 7}, (_, i) => 'step-0' + (i + 1));
  const buffers = new Map();

  let previousStep = -1;
  // Keep existing Outlaw audio available even when startup preloading was skipped.
  let outlawLoad=null;
  function loadOutlaw(ctx){
    if(buffers.has('outlaw'))return Promise.resolve(buffers.get('outlaw'));
    if(!outlawLoad)outlawLoad=fetch('audio/guns/outlaw.ogg').then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).then(bytes=>ctx.decodeAudioData(bytes)).then(buffer=>{buffers.set('outlaw',buffer);return buffer;}).catch(()=>null).finally(()=>{outlawLoad=null;});
    return outlawLoad;
  }

  const clips = new Map();
  let clickRequest=0, activeClick=null;
  function cleanClick(ctx,buffer) {
    // Keep the original recording, with only short edge fades to avoid pops.
    const rate=buffer.sampleRate, length=buffer.length;
    const clip=ctx.createBuffer(buffer.numberOfChannels,length,rate);
    for(let ch=0;ch<buffer.numberOfChannels;ch++){
      const out=clip.getChannelData(ch),input=buffer.getChannelData(ch);
      for(let i=0;i<length;i++){
        const envelope=Math.min(1,i/Math.max(1,rate*.0008),(length-1-i)/Math.max(1,rate*.010));
        out[i]=input[i]*envelope;
      }
    }
    return clip;
  }
  function loadClip(ctx,name) {
    if (!clips.has(name)) {
      const folder=name==='menu-click'?'ui':'melee';
      const request=fetch('audio/'+folder+'/'+name+'.wav?v='+(name==='menu-click'?'click-original3':'recording2'))
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
        if(name==='outlaw')return !!(await loadOutlaw(ctx));
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
    if (!buffer && name==='outlaw')loadOutlaw(ctx);
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const pan = position && ctx.createPanner();
    source.buffer = buffer;
    gain.gain.value = volume;
    if (name==='menu-click') {
      if(activeClick){
        const old=activeClick, now=ctx.currentTime;
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value,now);
        old.gain.gain.linearRampToValueAtTime(0,now+.008);
        try{old.source.stop(now+.009);}catch(_){}
      }
      activeClick={source,gain};
    }
    if (pan) {
      pan.panningModel = 'HRTF';
      pan.rolloffFactor = 0; // gameSound already applies distance attenuation.
      pan.setPosition(position.x, position.y, position.z);
      source.connect(pan).connect(gain);
    } else source.connect(gain);
    gain.connect(output);
    source.onended = () => {
      if(activeClick?.source===source)activeClick=null;
      source.disconnect(); gain.disconnect(); if (pan) pan.disconnect();
    };
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
