// Single-shot weapon and movement samples from github.com/unkwsr/open-aim.
const MatchSamples = (() => {
  const weapons = 'bucky bulldog classic frenzy ghost judge marshal operator phantom sheriff shorty spectre stinger vandal guardian outlaw'.split(' ');
  const footsteps = Array.from({length: 7}, (_, i) => 'step-0' + (i + 1));
  const buffers = new Map();
  let loading = false;
  let previousStep = -1;

  function preload(ctx) {
    if (loading) return;
    loading = true;
    for (const name of [...weapons, ...footsteps, 'land-01']) {
      const folder = weapons.includes(name) ? 'guns' : 'movement';
      fetch('audio/' + folder + '/' + name + '.ogg')
        .then(response => {
          if (!response.ok) throw new Error(String(response.status));
          return response.arrayBuffer();
        })
        .then(bytes => ctx.decodeAudioData(bytes))
        .then(buffer => buffers.set(name, buffer))
        .catch(() => {}); // The caller retains its synthesized fallback.
    }
  }

  function play(ctx, output, kind, weapon, position, volume) {
    let name = weapon;
    if (kind === 'land') name = 'land-01';
    if (kind === 'step') {
      previousStep = (previousStep + 1 + Math.floor(Math.random() * 6)) % footsteps.length;
      name = footsteps[previousStep];
    }
    const buffer = buffers.get(name);
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

  return {preload, play};
})();
