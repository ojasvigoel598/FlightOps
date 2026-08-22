// Audio Engine — centralized Web Audio system for Flight Ops.
//
// All sounds are synthesized via Web Audio API oscillators and noise.
// No external audio files required. No licensing concerns.
//
// Features:
//   - Engine sound (RPM-responsive oscillator + filtered noise)
//   - Wind/airspeed sound
//   - Warning sounds (stall, overspeed, engine failure, icing, low fuel)
//   - UI interaction sounds (click, mission start/complete/fail)
//   - Master/effects/engine/warning volume controls
//   - Browser autoplay handling (requires user gesture to start)

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let engineGain: GainNode | null = null;
let effectsGain: GainNode | null = null;
let warningGain: GainNode | null = null;

// Engine sound nodes
let engineOsc1: OscillatorNode | null = null;
let engineOsc2: OscillatorNode | null = null;
let engineNoise: AudioBufferSourceNode | null = null;
let engineFilter: BiquadFilterNode | null = null;
let engineNoiseGain: GainNode | null = null;
let engineNoiseFilter: BiquadFilterNode | null = null;

// Wind sound nodes
let windNoise: AudioBufferSourceNode | null = null;
let windFilter: BiquadFilterNode | null = null;
let windGain: GainNode | null = null;

// State
let initialized = false;
let engineRunning = false;
let currentRpm = 0;
let currentThrottle = 0;
let currentAirspeed = 0;
let masterVolume = 0.7;
let engineVolume = 0.5;
let effectsVolume = 0.6;
let warningVolume = 0.7;
let muted = false;

// ---------------------------------------------------------------------------
// Initialization (must be called after user gesture)
// ---------------------------------------------------------------------------

export function initAudio(): boolean {
  if (initialized) return true;
  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    masterGain = audioCtx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(audioCtx.destination);

    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(masterGain);

    effectsGain = audioCtx.createGain();
    effectsGain.gain.value = effectsVolume;
    effectsGain.connect(masterGain);

    warningGain = audioCtx.createGain();
    warningGain.gain.value = warningVolume;
    warningGain.connect(masterGain);

    // Create engine oscillators (dual oscillator for richer sound)
    engineOsc1 = audioCtx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc1.frequency.value = 80;

    engineOsc2 = audioCtx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 40;

    engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 400;
    engineFilter.Q.value = 2;

    const engineOscGain = audioCtx.createGain();
    engineOscGain.gain.value = 0.15;

    engineOsc1.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineOscGain);
    engineOscGain.connect(engineGain);

    // Engine noise (filtered white noise for exhaust/rumble)
    const noiseBuffer = createNoiseBuffer(audioCtx, 2);
    engineNoise = audioCtx.createBufferSource();
    engineNoise.buffer = noiseBuffer;
    engineNoise.loop = true;

    engineNoiseGain = audioCtx.createGain();
    engineNoiseGain.gain.value = 0.08;

    engineNoiseFilter = audioCtx.createBiquadFilter();
    engineNoiseFilter.type = 'bandpass';
    engineNoiseFilter.frequency.value = 200;
    engineNoiseFilter.Q.value = 1;

    engineNoise.connect(engineNoiseFilter);
    engineNoiseFilter.connect(engineNoiseGain);
    engineNoiseGain.connect(engineGain);

    engineOsc1.start();
    engineOsc2.start();
    engineNoise.start();

    // Wind sound (filtered noise)
    const windBuffer = createNoiseBuffer(audioCtx, 3);
    windNoise = audioCtx.createBufferSource();
    windNoise.buffer = windBuffer;
    windNoise.loop = true;

    windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windFilter.Q.value = 0.5;

    windGain = audioCtx.createGain();
    windGain.gain.value = 0;

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windNoise.start();

    initialized = true;
    return true;
  } catch {
    return false;
  }
}

function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Update engine sound based on simulation state
// ---------------------------------------------------------------------------

export function updateEngineSound(throttle: number, airspeedMs: number, running: boolean) {
  if (!initialized || !audioCtx || !engineGain || !engineOsc1 || !engineOsc2) return;

  currentThrottle = throttle;
  currentAirspeed = airspeedMs;
  engineRunning = running;

  const targetRpm = running ? 80 + throttle * 220 : 0; // 80-300 Hz
  currentRpm += (targetRpm - currentRpm) * 0.1;

  // Smooth interpolation to prevent clicks
  const now = audioCtx.currentTime;
  const rampTime = 0.05;

  engineOsc1.frequency.setTargetAtTime(currentRpm, now, rampTime);
  engineOsc2.frequency.setTargetAtTime(currentRpm * 0.5, now, rampTime);

  // Volume follows throttle
  const engineVol = running ? 0.05 + throttle * 0.25 : 0;
  engineGain.gain.setTargetAtTime(engineVol, now, rampTime);

  // Filter opens with throttle
  if (engineFilter) {
    engineFilter.frequency.setTargetAtTime(300 + throttle * 800, now, rampTime);
  }

  // Noise volume
  if (engineNoiseGain) {
    engineNoiseGain.gain.setTargetAtTime(running ? 0.03 + throttle * 0.1 : 0, now, rampTime);
  }
  if (engineNoiseFilter) {
    engineNoiseFilter.frequency.setTargetAtTime(100 + throttle * 400, now, rampTime);
  }

  // Wind sound scales with airspeed
  if (windGain && windFilter) {
    const windVol = Math.min(0.15, (airspeedMs / 100) * 0.15);
    windGain.gain.setTargetAtTime(windVol, now, rampTime);
    windFilter.frequency.setTargetAtTime(400 + airspeedMs * 10, now, rampTime);
  }
}

// ---------------------------------------------------------------------------
// Warning sounds (synthesized beeps)
// ---------------------------------------------------------------------------

export function playWarning(type: 'stall' | 'overspeed' | 'engine-failure' | 'icing' | 'low-fuel') {
  if (!initialized || !audioCtx || !warningGain || muted) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  switch (type) {
    case 'stall':
      osc.frequency.value = 440;
      osc.type = 'square';
      gain.gain.value = 0.15;
      // Fast triple beep
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.setValueAtTime(0, now + 0.1);
      gain.gain.setValueAtTime(0.15, now + 0.15);
      gain.gain.setValueAtTime(0, now + 0.25);
      gain.gain.setValueAtTime(0.15, now + 0.3);
      gain.gain.setValueAtTime(0, now + 0.4);
      osc.stop(now + 0.5);
      break;
    case 'overspeed':
      osc.frequency.value = 600;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.8);
      osc.stop(now + 0.9);
      break;
    case 'engine-failure':
      osc.frequency.value = 220;
      osc.type = 'sawtooth';
      gain.gain.value = 0.2;
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.5);
      osc.stop(now + 1.6);
      break;
    case 'icing':
      osc.frequency.value = 520;
      osc.type = 'triangle';
      gain.gain.value = 0.08;
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.setValueAtTime(0, now + 0.2);
      gain.gain.setValueAtTime(0.08, now + 0.3);
      gain.gain.setValueAtTime(0, now + 0.5);
      gain.gain.setValueAtTime(0.08, now + 0.6);
      gain.gain.setValueAtTime(0, now + 0.8);
      osc.stop(now + 1);
      break;
    case 'low-fuel':
      osc.frequency.value = 330;
      osc.type = 'sine';
      gain.gain.value = 0.12;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.setValueAtTime(0, now + 0.3);
      gain.gain.setValueAtTime(0.12, now + 0.5);
      gain.gain.setValueAtTime(0, now + 0.8);
      osc.stop(now + 1);
      break;
  }

  osc.connect(gain);
  gain.connect(warningGain);
  osc.start(now);
}

// ---------------------------------------------------------------------------
// UI interaction sounds
// ---------------------------------------------------------------------------

export function playClick() {
  if (!initialized || !audioCtx || !effectsGain || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.frequency.value = 800;
  osc.type = 'sine';
  gain.gain.value = 0.08;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.stop(now + 0.1);
  osc.connect(gain);
  gain.connect(effectsGain);
  osc.start(now);
}

export function playMissionStart() {
  if (!initialized || !audioCtx || !effectsGain || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(600, now + 0.3);
  osc.type = 'sine';
  gain.gain.value = 0.12;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.stop(now + 0.6);
  osc.connect(gain);
  gain.connect(effectsGain);
  osc.start(now);
}

export function playMissionComplete() {
  if (!initialized || !audioCtx || !effectsGain || muted) return;
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  const now = audioCtx.currentTime;
  notes.forEach((freq, i) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, now + i * 0.15);
    gain.gain.linearRampToValueAtTime(0.1, now + i * 0.15 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
    osc.stop(now + i * 0.15 + 0.4);
    osc.connect(gain);
    gain.connect(effectsGain!);
    osc.start(now + i * 0.15);
  });
}

export function playMissionFail() {
  if (!initialized || !audioCtx || !effectsGain || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.linearRampToValueAtTime(150, now + 0.5);
  osc.type = 'sawtooth';
  gain.gain.value = 0.1;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.stop(now + 0.7);
  osc.connect(gain);
  gain.connect(effectsGain);
  osc.start(now);
}

// ---------------------------------------------------------------------------
// Volume controls
// ---------------------------------------------------------------------------

export function setMasterVolume(v: number) {
  masterVolume = v;
  if (masterGain) masterGain.gain.value = muted ? 0 : v;
}
export function setEngineVolume(v: number) {
  engineVolume = v;
}
export function setEffectsVolume(v: number) {
  effectsVolume = v;
  if (effectsGain) effectsGain.gain.value = v;
}
export function setWarningVolume(v: number) {
  warningVolume = v;
  if (warningGain) warningGain.gain.value = v;
}
export function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : masterVolume;
  return muted;
}
export function isMuted() { return muted; }
export function getVolumes() {
  return { master: masterVolume, engine: engineVolume, effects: effectsVolume, warning: warningVolume, muted };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function destroyAudio() {
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  initialized = false;
  engineRunning = false;
}
