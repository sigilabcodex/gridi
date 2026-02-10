// src/engine/scheduler.ts
import type { Patch, VoiceModule } from "../patch";
import { getVoices } from "../patch";
import type { Engine } from "./audio";

export type Scheduler = {
  readonly running: boolean;

  setBpm(bpm: number): void;
  setPatch(patch: Patch, opts?: { regen?: boolean }): void;

  regenAll(): void;

  start(): void;
  stop(): void;
};

type VoiceState = {
  step: number;
  nextTime: number;
  pattern: Uint8Array; // 0/1 steps
};

export function createScheduler(engine: Engine): Scheduler {
  let running = false;

  const lookaheadSec = 0.12;
  const intervalMs = 25;
  let timer: number | null = null;

  let bpm = 124;
  let patch: Patch | null = null;

  // states by VOICE INDEX (order in getVoices(patch))
  const states: VoiceState[] = Array.from({ length: 64 }, () => ({
    step: 0,
    nextTime: 0,
    pattern: new Uint8Array([1]),
  }));

  function setBpm(next: number) {
    bpm = Math.max(20, Math.min(400, next | 0));
  }

  function secondsPerBeat() {
    return 60 / bpm;
  }

  function voiceStepDur(v: VoiceModule) {
    const beat = secondsPerBeat();
    const denom = 2 * v.subdiv; // 1->2,2->4,4->8,8->16
    return beat / denom;
  }

  // ---------- pattern generation helpers ----------
  function xorshift32(seed: number) {
    let x = seed | 0;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }

  function clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
  }

  function bjorklund(steps: number, pulses: number) {
    steps = Math.max(1, steps | 0);
    pulses = Math.max(0, Math.min(steps, pulses | 0));
    if (pulses === 0) return new Uint8Array(steps);
    if (pulses === steps) return Uint8Array.from({ length: steps }, () => 1);

    const pattern: number[] = [];
    const counts: number[] = [];
    const remainders: number[] = [];
    let divisor = steps - pulses;
    remainders.push(pulses);
    let level = 0;

    while (true) {
      counts.push(Math.floor(divisor / remainders[level]));
      remainders.push(divisor % remainders[level]);
      divisor = remainders[level];
      level++;
      if (remainders[level] <= 1) break;
    }
    counts.push(divisor);

    function build(l: number) {
      if (l === -1) pattern.push(0);
      else if (l === -2) pattern.push(1);
      else {
        for (let i = 0; i < counts[l]; i++) build(l - 1);
        if (remainders[l] !== 0) build(l - 2);
      }
    }
    build(level);

    const out = pattern.slice(0, steps);
    const firstOne = out.indexOf(1);
    const rot = firstOne > 0 ? firstOne : 0;
    const rotated = out.slice(rot).concat(out.slice(0, rot));
    return Uint8Array.from(rotated);
  }

  function rotatePattern(p: Uint8Array, rot: number) {
    const n = p.length;
    if (n <= 1) return p;
    rot = ((rot | 0) % n + n) % n;
    if (rot === 0) return p;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = p[(i - rot + n) % n];
    return out;
  }

  function genStepPattern(v: VoiceModule) {
    const n = Math.max(1, Math.min(128, v.length | 0));
    const rnd = xorshift32(v.seed | 0);
    const prob = clamp01(v.density);
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = rnd() < prob ? 1 : 0;
    return out;
  }

  function genEuclidPattern(v: VoiceModule) {
    const n = Math.max(1, Math.min(128, v.length | 0));
    const k = Math.round(clamp01(v.density) * n);
    const base = bjorklund(n, k);
    return rotatePattern(base, v.euclidRot | 0);
  }

  function genCAPattern(v: VoiceModule) {
    const n = Math.max(1, Math.min(128, v.length | 0));
    const rule = (v.caRule | 0) & 255;
    const rnd = xorshift32(v.seed ^ 0x9e3779b9);

    const row = new Uint8Array(n);
    const initProb = clamp01(v.caInit);
    for (let i = 0; i < n; i++) row[i] = rnd() < initProb ? 1 : 0;

    const iters = 6 + Math.floor(clamp01(v.gravity) * 10);
    let cur = row;
    let next = new Uint8Array(n);

    for (let t = 0; t < iters; t++) {
      for (let i = 0; i < n; i++) {
        const L = cur[(i - 1 + n) % n];
        const C = cur[i];
        const R = cur[(i + 1) % n];
        const idx = (L << 2) | (C << 1) | R;
        next[i] = (rule >> idx) & 1;
      }
      const tmp = cur;
      cur = next;
      next = tmp;
    }
    return cur;
  }

  function genHybridPattern(v: VoiceModule) {
    const a = genEuclidPattern(v);
    const b = genStepPattern(v);
    const n = Math.min(a.length, b.length);
    const out = new Uint8Array(n);
    const det = clamp01(v.determinism);
    const rnd = xorshift32((v.seed + 1337) | 0);

    for (let i = 0; i < n; i++) {
      const noise = (rnd() - 0.5) * 0.6 * clamp01(v.weird);
      const w = clamp01(det + noise);
      out[i] = (w >= 0.5 ? a[i] : b[i]) ? 1 : 0;
    }
    return out;
  }

  function regenVoice(i: number, v: VoiceModule) {
    let p: Uint8Array;

    switch (v.mode) {
      case "step": p = genStepPattern(v); break;
      case "euclid": p = genEuclidPattern(v); break;
      case "ca": p = genCAPattern(v); break;
      case "fractal":
        p = genCAPattern({ ...v, seed: v.seed ^ 0xabcdef });
        break;
      case "hybrid":
      default:
        p = genHybridPattern(v);
        break;
    }

    const drop = clamp01(v.drop);
    if (drop > 0) {
      const rnd = xorshift32(v.seed ^ 0x1234567);
      const out = new Uint8Array(p.length);
      for (let k = 0; k < p.length; k++) out[k] = p[k] && rnd() >= drop ? 1 : 0;
      p = out;
    }

    states[i].pattern = p;
    states[i].step = 0;
  }

  function regenAll() {
    if (!patch) return;
    const voices = getVoices(patch);
    for (let i = 0; i < voices.length; i++) regenVoice(i, voices[i]);
  }

  function setPatch(next: Patch, opts?: { regen?: boolean }) {
    patch = next;
    if (opts?.regen !== false) regenAll();
  }

  function scheduleLoop() {
    if (!running || !patch) return;

    const voices = getVoices(patch);
    const ctx = engine.ctx;
    const now = ctx.currentTime;

    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      if (!v || !v.enabled) continue;

      const st = states[i];
      const stepDur = voiceStepDur(v);

      if (st.nextTime === 0) st.nextTime = now;

      while (st.nextTime < now + lookaheadSec) {
        const pat = st.pattern;
        const idx = pat.length > 0 ? (st.step % pat.length) : 0;

        if (pat[idx]) engine.triggerVoice(i, patch); // engine uses voice index
        st.step++;
        st.nextTime += stepDur;
      }
    }
  }

  function start() {
    if (running) return;
    running = true;

    const now = engine.ctx.currentTime;
    for (let i = 0; i < states.length; i++) {
      states[i].step = 0;
      states[i].nextTime = now;
    }

    timer = window.setInterval(scheduleLoop, intervalMs);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (timer !== null) window.clearInterval(timer);
    timer = null;

    for (let i = 0; i < states.length; i++) {
      states[i].nextTime = 0;
      states[i].step = 0;
    }
  }

  return {
    get running() { return running; },
    setBpm,
    setPatch,
    regenAll,
    start,
    stop,
  };
}
