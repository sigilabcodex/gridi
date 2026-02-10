// src/engine/audio.ts
import type { Patch, VoiceModule } from "../patch";
import { clamp, getVoices } from "../patch";

export type Engine = {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;
  voiceLastTrigMs: Float64Array;

  start(): Promise<void>;
  setMasterMute(muted: boolean): void;
  setMasterGain(g: number): void;

  // i = voice index inside getVoices(patch)
  triggerVoice(i: number, patch: Patch): void;
};

const EPS = 1e-5;

function makeNoiseBuffer(ctx: AudioContext, seconds = 1.0) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function makeSaturator(ctx: AudioContext, amount = 0.6) {
  const sh = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  const k = 1 + amount * 40;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  sh.curve = curve;
  sh.oversample = "2x";
  return sh;
}

function safe(v: number, fallback: number) {
  return Number.isFinite(v) ? v : fallback;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp01(x: number) {
  return clamp(x, 0, 1);
}

// variación estable por-voz (NO seed)
function voiceRand01(i: number) {
  let x = (i * 0x9e3779b9) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

// Para DRUMS: base Hz por voz + timbre/macro (NO seed)
function drumBaseHz(name: string, i: number, timbre: number, macro: number) {
  const r = voiceRand01(i);
  const t = clamp01(timbre);
  const m = clamp01(macro);

  switch (name) {
    case "SUB": {
      const base = lerp(38, 55, 0.15 + 0.65 * t);
      return base * (0.92 + 0.16 * r) * lerp(0.95, 1.05, m);
    }
    case "BITSN": {
      const base = lerp(170, 280, 0.2 + 0.5 * t);
      return base * (0.92 + 0.16 * r) * lerp(0.95, 1.05, m);
    }
    case "PING": {
      const base = lerp(420, 1800, 0.15 + 0.8 * t);
      return base * (0.92 + 0.16 * r) * lerp(0.95, 1.05, m);
    }
    case "BUZZHH": {
      const base = lerp(250, 900, 0.2 + 0.6 * t);
      return base * (0.92 + 0.16 * r) * lerp(0.95, 1.05, m);
    }
    case "RATTLE": {
      const base = lerp(700, 2600, 0.1 + 0.85 * t);
      return base * (0.92 + 0.16 * r) * lerp(0.95, 1.05, m);
    }
    case "AIRGAP": {
      const base = lerp(6000, 12000, 0.2 + 0.8 * t);
      return base * (0.92 + 0.16 * r) * lerp(0.95, 1.05, m);
    }
    default:
      return 220;
  }
}

// gravity = decay (0 corto, 1 largo)
function decayFromGravity(g: number, min: number, max: number) {
  return lerp(min, max, clamp01(safe(g, 0.5)));
}

export function createEngine(): Engine {
  const ctx = new AudioContext();

  const master = ctx.createGain();
  master.gain.value = 0.9;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  const sat = makeSaturator(ctx, 0.15);
  master.connect(sat);
  sat.connect(analyser);
  analyser.connect(ctx.destination);

  // now that voices are “modular”, allow more than 8
  const voiceLastTrigMs = new Float64Array(64);
  const noiseBuf = makeNoiseBuffer(ctx, 1.0);

  function setMasterMute(muted: boolean) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(muted ? 0 : 0.9, now, 0.01);
  }

  function setMasterGain(g: number) {
    master.gain.value = clamp(safe(g, 0.8), 0, 1);
  }

  async function start() {
    if (ctx.state !== "running") await ctx.resume();
  }

  function mkPanner(pan: number) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(safe(pan, 0), -1, 1);
    return p;
  }

  function envExp(g: GainNode, now: number, a: number, d: number, peak: number) {
    const attack = Math.max(0.001, a);
    const decay = Math.max(0.01, d);
    const pk = Math.max(EPS, peak);

    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(EPS, now);
    g.gain.exponentialRampToValueAtTime(pk, now + attack);
    g.gain.exponentialRampToValueAtTime(EPS, now + attack + decay);
  }

  function triggerVoice(i: number, patch: Patch) {
    voiceLastTrigMs[i] = performance.now();

    const voices = getVoices(patch);
    const v: VoiceModule | undefined = voices[i];
    if (!v || !v.enabled) return;

    const now = ctx.currentTime;

    const amp = clamp(safe(v.amp, 0.1), 0, 1);
    const timbre = clamp01(safe(v.timbre, 0.5));
    const pan = clamp(safe(v.pan, 0), -1, 1);

    const out = ctx.createGain();
    const panNode = mkPanner(pan);
    out.connect(panNode);
    panNode.connect(master);

    const noise = () => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      return src;
    };

    const oscType = (t: number): OscillatorType => {
      if (t < 0.25) return "sine";
      if (t < 0.5) return "triangle";
      if (t < 0.75) return "sawtooth";
      return "square";
    };

    // keep this for tiny per-voice variations (NOT pitch-from-seed for drums)
    const rSeedish = (() => {
      let x = (v.seed ^ (i * 7919)) >>> 0;
      x = (x * 1664525 + 1013904223) >>> 0;
      return x / 0xffffffff;
    })();

    const name = (v.name || `V${i + 1}`).toUpperCase();
    const macro = clamp01(safe(patch.macro, 0.5));

    // =========================
    // DRUMS (seed NO pitch)
    // =========================
    if (name === "SUB") {
      const o = ctx.createOscillator();
      o.type = "sine";

      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";

      f.frequency.value = 600 + timbre * 7000;
      f.Q.value = 0.2 + timbre * 1.2;

      const base = drumBaseHz("SUB", i, timbre, macro);
      const startHz = base * lerp(2.2, 6.0, timbre);
      const endHz = base;

      const pitchDrop = lerp(0.05, 0.11, 1 - timbre);
      o.frequency.setValueAtTime(startHz, now);
      o.frequency.exponentialRampToValueAtTime(endHz, now + pitchDrop);

      const dec = decayFromGravity(v.gravity, 0.16, 0.75);
      const atk = lerp(0.004, 0.0015, clamp01(safe(v.determinism, 0.8)));

      envExp(g, now, atk, dec, amp * 0.95);

      const sh = makeSaturator(ctx, 0.12 + clamp01(safe(v.weird, 0)) * 0.35);

      o.connect(f);
      f.connect(sh);
      sh.connect(g);
      g.connect(out);

      o.start(now);
      o.stop(now + 0.9);
      return;
    }

    if (name === "AIRGAP") {
      const n = noise();

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 5000 + timbre * 7500;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 7000 + timbre * 5500;
      bp.Q.value = 0.5 + timbre * 7;

      const g = ctx.createGain();

      const dec = decayFromGravity(v.gravity, 0.03, 0.16);
      const atk = lerp(0.002, 0.001, clamp01(safe(v.determinism, 0.8)));
      envExp(g, now, atk, dec, amp * 0.35);

      const sh = makeSaturator(ctx, 0.08 + clamp01(safe(v.weird, 0)) * 0.45);

      n.connect(hp);
      hp.connect(bp);
      bp.connect(sh);
      sh.connect(g);
      g.connect(out);

      n.start(now);
      n.stop(now + 0.25);
      return;
    }

    if (name === "BITSN") {
      const n = noise();

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 650 + timbre * 3200;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1500 + timbre * 3600;
      bp.Q.value = 0.7 + timbre * 7;

      const tone = ctx.createOscillator();
      tone.type = oscType(timbre);
      tone.frequency.value = drumBaseHz("BITSN", i, timbre, macro);

      const gN = ctx.createGain();
      const gT = ctx.createGain();
      const mix = ctx.createGain();
      mix.gain.value = 1;

      const decN = decayFromGravity(v.gravity, 0.10, 0.38);
      const decT = decayFromGravity(v.gravity, 0.05, 0.25);

      envExp(gN, now, 0.001, decN, amp * 0.55);
      envExp(gT, now, 0.001, decT, amp * 0.22);

      const sh = makeSaturator(ctx, 0.1 + clamp01(safe(v.weird, 0)) * 0.6);

      n.connect(hp);
      hp.connect(bp);
      bp.connect(sh);
      sh.connect(gN);
      gN.connect(mix);

      tone.connect(gT);
      gT.connect(mix);

      mix.connect(out);

      n.start(now);
      n.stop(now + 0.7);
      tone.start(now);
      tone.stop(now + 0.4);
      return;
    }

    if (name === "BUZZHH") {
      const n = noise();

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = drumBaseHz("BUZZHH", i, timbre, macro) * lerp(0.7, 1.8, timbre);
      bp.Q.value = 1.0 + timbre * 12;

      const sh = makeSaturator(ctx, 0.18 + timbre * 0.25 + clamp01(safe(v.weird, 0)) * 0.55);

      const g = ctx.createGain();
      const dec = decayFromGravity(v.gravity, 0.05, 0.35);
      const atk = lerp(0.002, 0.001, clamp01(safe(v.determinism, 0.8)));
      envExp(g, now, atk, dec, amp * 0.45);

      n.connect(bp);
      bp.connect(sh);
      sh.connect(g);
      g.connect(out);

      n.start(now);
      n.stop(now + 0.8);
      return;
    }

    if (name === "RATTLE") {
      const n = noise();

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";

      const base = drumBaseHz("RATTLE", i, timbre, macro);
      const wob = (rSeedish - 0.5) * 0.25 * clamp01(safe(v.weird, 0));

      bp.frequency.value = base * (0.85 + timbre * 0.9) * (1 + wob);
      bp.Q.value = 2 + timbre * 14;

      const g = ctx.createGain();
      const dec = decayFromGravity(v.gravity, 0.12, 0.85);
      envExp(g, now, 0.002, dec, amp * 0.4);

      const sh = makeSaturator(ctx, 0.08 + clamp01(safe(v.weird, 0)) * 0.5);

      n.connect(bp);
      bp.connect(sh);
      sh.connect(g);
      g.connect(out);

      n.start(now);
      n.stop(now + 1.1);
      return;
    }

    if (name === "PING") {
      const o = ctx.createOscillator();
      o.type = oscType(timbre);

      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 900 + timbre * 6500;
      f.Q.value = 2 + timbre * 18;

      const g = ctx.createGain();

      const dec = decayFromGravity(v.gravity, 0.04, 0.22);
      const atk = lerp(0.002, 0.001, clamp01(safe(v.determinism, 0.8)));
      envExp(g, now, atk, dec, amp * 0.35);

      o.frequency.value = drumBaseHz("PING", i, timbre, macro);

      const w = clamp01(safe(v.weird, 0));
      if (w > 0.02) {
        const det = lerp(0, 12, w);
        o.detune.setValueAtTime((Math.random() * 2 - 1) * det, now);
      }

      o.connect(f);
      f.connect(g);
      g.connect(out);

      o.start(now);
      o.stop(now + 0.35);
      return;
    }

    // =========================
    // TONAL (seed ok para pitch)
    // =========================
    if (name === "ULTRATK" || name === "METAK") {
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();

      carrier.type = oscType(timbre);
      mod.type = "sine";

      const base = 110 + (v.seed % 220);
      const ratio = name === "METAK" ? 1.5 + timbre * 5.0 : 0.5 + timbre * 3.0;
      const idx = name === "METAK" ? 30 + timbre * 400 : 10 + timbre * 220;

      carrier.frequency.value = base;
      mod.frequency.value = base * ratio;

      modGain.gain.value = idx;
      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 600 + timbre * 9000;
      f.Q.value = 0.4 + timbre * 3.5;

      const dec = decayFromGravity(v.gravity, 0.18, 1.1);
      const atk = lerp(0.01, 0.003, clamp01(safe(v.determinism, 0.8)));

      const g = ctx.createGain();
      envExp(g, now, atk, dec, amp * 0.35);

      const sh = makeSaturator(ctx, 0.06 + clamp01(safe(v.weird, 0)) * 0.25);

      carrier.connect(f);
      f.connect(sh);
      sh.connect(g);
      g.connect(out);

      mod.start(now);
      carrier.start(now);
      mod.stop(now + 1.4);
      carrier.stop(now + 1.4);
      return;
    }

    // fallback
    {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 220;

      const g = ctx.createGain();
      envExp(g, now, 0.001, 0.08, amp * 0.2);

      o.connect(g);
      g.connect(out);

      o.start(now);
      o.stop(now + 0.2);
    }
  }

  return {
    ctx,
    master,
    analyser,
    voiceLastTrigMs,
    start,
    setMasterMute,
    setMasterGain,
    triggerVoice,
  };
}
