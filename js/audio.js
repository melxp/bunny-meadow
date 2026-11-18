// Gentle sounds synthesised with the Web Audio API – no audio files needed.
//  - bell:  soft bell when a focus session ends
//  - chime: two-note chime when a break ends
//  - ambience: procedural birdsong + light breeze, each with its own volume.
// Nothing plays unless the person has switched it on, and browsers only allow
// audio after a tap/click, so the context is unlocked on the first interaction.

let ctx = null;
let master = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  ac();
}

function strike(freq, when, vol, decay = 2.6) {
  const c = ctx;
  const partials = [
    [1, 1],
    [2.01, 0.42],
    [2.76, 0.26],
    [5.4, 0.12],
  ];
  for (const [mult, amp] of partials) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol * amp, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay / Math.sqrt(mult));
    o.connect(g).connect(master);
    o.start(when);
    o.stop(when + decay + 0.1);
  }
}

export function playBell(volume = 0.6) {
  if (!ac() || volume <= 0) return;
  const t = ctx.currentTime + 0.02;
  const v = 0.22 * volume;
  strike(659.25, t, v); // E5
  strike(987.77, t + 0.55, v * 0.8); // B5
  strike(1318.5, t + 1.1, v * 0.55, 3.2); // E6
}

export function playChime(volume = 0.5) {
  if (!ac() || volume <= 0) return;
  const t = ctx.currentTime + 0.02;
  const v = 0.2 * volume;
  strike(783.99, t, v, 1.8); // G5
  strike(1046.5, t + 0.28, v, 2.2); // C6
}

// ---------- ambience ----------
let amb = null;

function noiseBuffer(c) {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // pink-ish noise (Paul Kellet's economy filter)
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
  }
  return buf;
}

function chirp(dest, when, base) {
  const c = ctx;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  const up = Math.random() > 0.4;
  const f0 = base * (up ? 0.85 : 1.15);
  const f1 = base * (up ? 1.25 : 0.8);
  const dur = 0.06 + Math.random() * 0.09;
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(f1, when + dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.5, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g).connect(dest);
  o.start(when);
  o.stop(when + dur + 0.02);
}

function scheduleBirds() {
  if (!amb) return;
  const c = ctx;
  const t = c.currentTime + 0.05;
  const base = 2600 + Math.random() * 2200;
  const n = 2 + Math.floor(Math.random() * 5);
  // each phrase pans a little differently, like birds in different trees
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  let dest = amb.birdGain;
  if (pan) {
    pan.pan.value = Math.random() * 1.4 - 0.7;
    pan.connect(amb.birdGain);
    dest = pan;
  }
  let w = t;
  for (let i = 0; i < n; i++) {
    chirp(dest, w, base * (1 + (Math.random() - 0.5) * 0.12));
    w += 0.09 + Math.random() * 0.16;
  }
  amb.birdTimer = setTimeout(scheduleBirds, 1400 + Math.random() * 5200);
}

export function startAmbience(birdsVol, breezeVol) {
  if (!ac()) return false;
  if (amb) {
    setAmbienceVolumes(birdsVol, breezeVol);
    return true;
  }
  const c = ctx;
  amb = {};
  amb.birdGain = c.createGain();
  amb.birdGain.gain.value = 0.05 * birdsVol;
  // a short feedback delay gives the birds a little outdoor space
  const delay = c.createDelay();
  delay.delayTime.value = 0.18;
  const fb = c.createGain();
  fb.gain.value = 0.22;
  amb.birdGain.connect(master);
  amb.birdGain.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(master);
  amb.delay = delay;

  amb.breezeGain = c.createGain();
  amb.breezeGain.gain.value = 0.5 * breezeVol;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  const swell = c.createGain();
  swell.gain.value = 0.6;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoAmt = c.createGain();
  lfoAmt.gain.value = 0.35;
  lfo.connect(lfoAmt).connect(swell.gain);
  src.connect(lp).connect(swell).connect(amb.breezeGain).connect(master);
  src.start();
  lfo.start();
  amb.src = src;
  amb.lfo = lfo;
  scheduleBirds();
  return true;
}

export function setAmbienceVolumes(birdsVol, breezeVol) {
  if (!amb) return;
  const t = ctx.currentTime;
  amb.birdGain.gain.setTargetAtTime(0.05 * birdsVol, t, 0.2);
  amb.breezeGain.gain.setTargetAtTime(0.5 * breezeVol, t, 0.2);
}

export function stopAmbience() {
  if (!amb) return;
  clearTimeout(amb.birdTimer);
  const t = ctx.currentTime;
  amb.birdGain.gain.setTargetAtTime(0, t, 0.3);
  amb.breezeGain.gain.setTargetAtTime(0, t, 0.3);
  const old = amb;
  amb = null;
  setTimeout(() => {
    try {
      old.src.stop();
      old.lfo.stop();
      old.birdGain.disconnect();
      old.breezeGain.disconnect();
      old.delay.disconnect();
    } catch {}
  }, 1500);
}

export function ambiencePlaying() {
  return !!amb;
}
