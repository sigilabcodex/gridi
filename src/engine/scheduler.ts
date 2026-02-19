// src/engine/scheduler.ts
import type { Patch, VoiceModule } from "../patch";
import { getVoices } from "../patch";
import type { Engine } from "./audio";
import { genStepPattern } from "./pattern/stepPatternModule";

export type Scheduler = {
  readonly running: boolean;

  setBpm(bpm: number): void;
  setPatch(patch: Patch, opts?: { regen?: boolean }): void;

  regenAll(): void;

  start(): void;
  stop(): void;
};

// PR-1 ownership note: scheduler currently mutates sequencing state (step/nextTime/pattern).
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

  // states by VOICE ID (stable across reordering)
  const states = new Map<string, VoiceState>();

  function getVoiceId(v: VoiceModule, i: number) {
    // Prefer stable id. Fallback to index-based (only if id missing).
    // (Ideally VoiceModule.id is always present.)
    return (v as any).id ? String((v as any).id) : `idx:${i}`;
  }

  function getState(voiceId: string): VoiceState {
    let st = states.get(voiceId);
    if (!st) {
      st = { step: 0, nextTime: 0, pattern: new Uint8Array([1]) };
      states.set(voiceId, st);
    }
    return st;
  }

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
  // PR-1 ownership note: pattern generation currently lives in scheduler (legacy path).
  // Pilot RFC target is to move step-mode generation behind a PatternModule contract.
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

  function regenVoice(voiceId: string, v: VoiceModule) {
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

    const st = getState(voiceId);
    st.pattern = p;
    st.step = 0;
    // st.nextTime intentionally NOT forced here; start()/stop() handle timing reset
  }

  function regenAll() {
    if (!patch) return;
    const voices = getVoices(patch);
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      const id = getVoiceId(v, i);
      regenVoice(id, v);
    }
  }

  function setPatch(next: Patch, opts?: { regen?: boolean }) {
    patch = next;
    if (opts?.regen !== false) regenAll();
  }

  function scheduleLoop() {
    // PR-1 ownership note: scheduler currently performs legacy pattern read + state mutation
    // and dispatches exact timestamps to engine.triggerVoice().
    if (!running || !patch) return;

    const voices = getVoices(patch);
    const ctx = engine.ctx;
    const now = ctx.currentTime;

    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      if (!v || !v.enabled) continue;

      const voiceId = getVoiceId(v, i);
      const st = getState(voiceId);

      const stepDur = voiceStepDur(v);

      if (st.nextTime === 0) st.nextTime = now;

      while (st.nextTime < now + lookaheadSec) {
        const pat = st.pattern;
        const idx = pat.length > 0 ? (st.step % pat.length) : 0;

        // ✅ schedule with lookahead time (tight timing)
        if (pat[idx]) engine.triggerVoice(i, patch, st.nextTime);

        st.step++;
        st.nextTime += stepDur;
      }
    }
  }

  function start() {
    if (running) return;
    running = true;

    const now = engine.ctx.currentTime;

    // Reset timing for all current voices (stable by id)
    if (patch) {
      const voices = getVoices(patch);
      for (let i = 0; i < voices.length; i++) {
        const v = voices[i];
        const id = getVoiceId(v, i);
        const st = getState(id);
        st.step = 0;
        st.nextTime = now;
      }
    } else {
      // If no patch yet, just reset any existing states
      for (const st of states.values()) {
        st.step = 0;
        st.nextTime = now;
      }
    }

    timer = window.setInterval(scheduleLoop, intervalMs);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (timer !== null) window.clearInterval(timer);
    timer = null;

    // Reset scheduler timing state
    for (const st of states.values()) {
      st.nextTime = 0;
      st.step = 0;
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
