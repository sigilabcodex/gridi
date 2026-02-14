// GRIDI (WebAudio) v0.1
// vanilla-ts, no frameworks

type Mode = "hybrid" | "step" | "euclid" | "ca" | "fractal";

type Voice = {
  on: boolean;
  mode: Mode;

  seed: number;
  determinism: number; // 0..1
  gravity: number;     // 0..1 (repeat recent motifs)
  density: number;     // 0..1
  subdiv: 1 | 2 | 4 | 8; // 1=8ths,2=16ths,4=32nds,8=64ths
  length: number;      // 1..64
  drop: number;        // 0..1 chance to skip (accent by silence)
  amp: number;         // 0..1
  weird: number;       // 0..1
  euclidRot: number;   // steps rotate
  caRule: number;      // 0..255
  caInit: number;      // 0..1
};

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ------- deterministic PRNG (mulberry32) -------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "deterministic vs probabilistic": blend seeded PRNG with jittery source
function drand(seed: number, det: number): number {
  const rDet = mulberry32(seed)();
  const rFree = (performance.now() * 0.000123 + Math.sin(performance.now() * 0.00123)) % 1;
  return lerp(rFree, rDet, det);
}

// ------- Pattern generators -------

// Bjorklund (Euclidean) basic
function bjorklund(pulses: number, steps: number): number[] {
  pulses = Math.floor(clamp(pulses, 0, steps));
  steps = Math.floor(steps);
  if (steps <= 0) return [];
  if (pulses === 0) return Array(steps).fill(0);
  if (pulses === steps) return Array(steps).fill(1);

  const counts: number[] = [];
  const remainders: number[] = [];
  remainders.push(pulses);
  let divisor = steps - pulses;
  let level = 0;

  while (true) {
    counts.push(Math.floor(divisor / remainders[level]));
    remainders.push(divisor % remainders[level]);
    divisor = remainders[level];
    level++;
    if (remainders[level] <= 1) break;
  }
  counts.push(divisor);

  const build = (lvl: number): number[] => {
    if (lvl === -1) return [0];
    if (lvl === -2) return [1];
    let res: number[] = [];
    for (let i = 0; i < counts[lvl]; i++) res = res.concat(build(lvl - 1));
    if (remainders[lvl] !== 0) res = res.concat(build(lvl - 2));
    return res;
  };

  let pat = build(level).slice(0, steps);

  // rotate so it starts with 1 if possible
  while (pat.length && pat[0] === 0) pat = pat.slice(1).concat(pat[0]);
  return pat;
}

function rot(arr: number[], r: number): number[] {
  if (!arr.length) return arr;
  const n = arr.length;
  const k = ((r % n) + n) % n;
  return arr.slice(n - k).concat(arr.slice(0, n - k));
}

function thueMorse(n: number): number {
  // parity of bits
  n = n | 0;
  let p = 0;
  while (n > 0) { p ^= (n & 1); n >>= 1; }
  return p;
}

function cantorHit(step: number): number {
  // ternary contains 1 -> hole
  let n = step | 0;
  for (let i = 0; i < 16; i++) {
    const d = n % 3;
    if (d === 1) return 0;
    n = Math.floor(n / 3);
  }
  return 1;
}

function evolveCA(state: number[], rule: number): number[] {
  const n = state.length;
  const out = new Array(n).fill(0);
  rule = rule | 0;
  for (let i = 0; i < n; i++) {
    const l = state[(i - 1 + n) % n] | 0;
    const c = state[i] | 0;
    const r = state[(i + 1) % n] | 0;
    const idx = (l << 2) + (c << 1) + r; // 0..7
    out[i] = (rule >> idx) & 1;
  }
  return out;
}

function applyGravity(newPat: number[], oldPat: number[], grav: number, seed: number, det: number): number[] {
  if (newPat.length !== oldPat.length) return newPat;
  const out = newPat.slice();
  for (let k = 0; k < newPat.length; k++) {
    const u = drand(seed + k * 131 + 9999, det);
    if (u < grav) out[k] = oldPat[k];
  }
  return out;
}

// ------- Audio engine -------

class Engine {
  ctx: AudioContext | null = null;

  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;

  bpm = 124;
  macro = 0.5; // 0 silence, mid pulse, 1 spray

  voices: Voice[] = [];
  // per voice pattern state
  pat: number[][] = [];
  patPrev: number[][] = [];
  caState: number[][] = [];

  // scheduler
  isRunning = false;
  intervalId: number | null = null;
  lookaheadMs = 25;
  scheduleAheadSec = 0.12;
  nextStepTime = 0;
  globalStep = 0;

  constructor() {
    this.voices = Array.from({ length: 8 }, (_, i) => ({
      on: true,
      mode: "hybrid",
      seed: 1000 + i * 77,
      determinism: 0.8,
      gravity: 0.6,
      density: 0.35,
      subdiv: 4,
      length: 16,
      drop: 0.12,
      amp: 0.12,
      weird: 0.5,
      euclidRot: 0,
      caRule: 90,
      caInit: 0.25,
    }));

    this.pat = this.voices.map(v => Array(v.length).fill(0));
    this.patPrev = this.voices.map(v => Array(v.length).fill(0));
    this.caState = this.voices.map(v => Array(v.length).fill(0));
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;

    // gentle safety net (not a hard limiter, just a compressor)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -12;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;

    this.master.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);

    // init patterns
    for (let i = 0; i < 8; i++) this.regenPattern(i);
  }

  async start() {
    await this.init();
    if (!this.ctx) return;

    if (this.ctx.state !== "running") await this.ctx.resume();

    if (this.isRunning) return;
    this.isRunning = true;

    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.globalStep = 0;

    this.intervalId = window.setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  // 1/8 note base, subdiv controls finer grid (like SC version)
  stepDurSec(subdiv: number): number {
    // base = 1/8 note = 0.5 beats
    const beats = 0.5 / subdiv;
    const secPerBeat = 60 / this.bpm;
    return beats * secPerBeat;
  }

  scheduler() {
    if (!this.ctx) return;
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadSec) {
      // schedule all voices for this global step
      for (let i = 0; i < 8; i++) this.scheduleVoiceStep(i, this.globalStep, this.nextStepTime);

      const dt = this.stepDurSec(1); // global tick = 8th grid
      this.nextStepTime += dt;
      this.globalStep++;
    }
  }

  // For each voice: map global 8th grid into that voice's subdiv
  scheduleVoiceStep(i: number, gStep: number, baseTime: number) {
    if (!this.ctx || !this.master) return;
    const v = this.voices[i];
    if (!v.on) return;

    const L = clamp(Math.floor(v.length), 1, 64);
    const subdiv = v.subdiv;

    // voice step happens every (global 8th) but internally subdiv into 16/32/64 feel:
    // We'll trigger on every global tick, but compute local index in smaller grid:
    // localStep increments by subdiv each global step (since global tick is 8th)
    const localStep = gStep * subdiv;

    // cycle boundary?
    if (localStep % L === 0) this.regenPattern(i);

    const idx = localStep % L;
    let hit = this.pat[i]?.[idx] === 1;

    // drop (accent-by-silence)
    const d = drand(v.seed + localStep * 911 + 33, v.determinism);
    if (d < v.drop) hit = false;

    // macro timing spray
    const m = clamp(this.macro, 0, 1);
    const jitterMax = 0.0 + (m * m) * 0.008; // up to 8ms
    const jitter = (drand(v.seed + localStep * 17 + 999, 0.2) * 2 - 1) * jitterMax;

    // small swing: delay every other local step (like offbeat)
    const isOff = (localStep % 2) === 1;
    const swing = 0.0; // keep simple in v0.1; we’ll add later
    const delay = isOff ? swing : 0;

    const t = baseTime + delay + jitter;
    if (hit) this.triggerVoice(i, t, v);
  }

  regenPattern(i: number) {
    const v = this.voices[i];

    let L = clamp(Math.floor(v.length), 1, 64);
    // ensure arrays sized
    if (!this.pat[i] || this.pat[i].length !== L) this.pat[i] = Array(L).fill(0);
    if (!this.patPrev[i] || this.patPrev[i].length !== L) this.patPrev[i] = Array(L).fill(0);
    if (!this.caState[i] || this.caState[i].length !== L) this.caState[i] = Array(L).fill(0);

    const seedBase = v.seed | 0;
    let det = clamp(v.determinism, 0, 1);
    const grav = clamp(v.gravity, 0, 1);

    const macro = clamp(this.macro, 0, 1);
    let effMode: Mode = v.mode;

    let dens = clamp(v.density, 0, 1);
    let drop = clamp(v.drop, 0, 1);

    if (v.mode === "hybrid") {
      if (macro < 0.33) effMode = "fractal";
      else if (macro < 0.72) effMode = "euclid";
      else effMode = "step";

      // macro curve for density + silence behavior
      dens = clamp(dens * (macro < 0.33 ? 0.35 : macro < 0.72 ? 1.0 : 1.25), 0, 1);
      drop = clamp(drop + Math.max(0, 0.33 - macro) * 0.6, 0, 1);

      // spray forces less determinism
      det = clamp(det * (1 - (macro * macro) * 0.55), 0, 1);
    }

    let newPat: number[] = [];

    if (effMode === "step") {
      newPat = Array.from({ length: L }, (_, k) => {
        const u = drand(seedBase + k * 997 + 17, det);
        return u < dens ? 1 : 0;
      });
    } else if (effMode === "euclid") {
      const pulses = clamp(Math.round(dens * L), 0, L);
      newPat = rot(bjorklund(pulses, L), v.euclidRot | 0);
    } else if (effMode === "ca") {
      const rule = clamp(v.caRule | 0, 0, 255);
      const initD = clamp(v.caInit, 0, 1);

      const reinitP = (1 - grav) * (0.35 + macro * 0.35);
      const u = drand(seedBase + 4444, det);

      const sum = this.caState[i].reduce((a, b) => a + b, 0);
      if (sum === 0 || u < reinitP) {
        this.caState[i] = Array.from({ length: L }, (_, k) => {
          const r = drand(seedBase + k * 313 + 99, det);
          return r < initD ? 1 : 0;
        });
      } else {
        this.caState[i] = evolveCA(this.caState[i], rule);
      }

      newPat = this.caState[i].map((bit, k) => {
        if (bit === 0) return 0;
        const g = drand(seedBase + k * 271 + 555, det);
        return g < dens ? 1 : 0;
      });
    } else if (effMode === "fractal") {
      const useCantor = v.weird < 0.4;
      newPat = Array.from({ length: L }, (_, k) => {
        const base = useCantor ? cantorHit(k) : thueMorse(k);
        const g = drand(seedBase + k * 199 + 777, det);
        return base === 1 && g < dens ? 1 : 0;
      });
    } else {
      // hybrid should have been mapped; fallback silence
      newPat = Array(L).fill(0);
    }

    // gravity blending with previous
    newPat = applyGravity(newPat, this.patPrev[i], grav, seedBase + 90000, det);

    this.patPrev[i] = this.pat[i].slice();
    this.pat[i] = newPat;
  }

  // ------- Voice synths (rare/peculiar) -------
  // We do each hit as a short graph of nodes, all into master bus.
  triggerVoice(i: number, t: number, v: Voice) {
    if (!this.ctx || !this.master) return;

    const amp = clamp(v.amp, 0, 1);
    const w = clamp(v.weird, 0, 1);
    const m = clamp(this.macro, 0, 1);

    // macro maps: pulse -> balanced -> spray (brighter, noisier)
    const bright = clamp(0.25 + m * 0.85, 0, 1);

    switch (i) {
      case 0: return this.v0_sub(t, amp, w, bright);
      case 1: return this.v1_buzzhh(t, amp, w, bright);
      case 2: return this.v2_ultratick(t, amp, w, bright);
      case 3: return this.v3_ping(t, amp, w, bright);
      case 4: return this.v4_bitsn(t, amp, w, bright);
      case 5: return this.v5_airgap(t, amp, w, bright);
      case 6: return this.v6_rattle(t, amp, w, bright);
      case 7: return this.v7_metak(t, amp, w, bright);
    }
  }

  // helper: simple envelope on a GainNode
  env(g: GainNode, t: number, a: number, d: number, peak = 1) {
    if (!this.ctx) return;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.00001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.00001, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.00001, t + a + d);
  }

  v0_sub(t: number, amp: number, w: number, bright: number) {
    // sub click + sine burst (very low)
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    const f = 28 + w * 90;
    o.frequency.setValueAtTime(f, t);
    // tiny pitch dive
    o.frequency.exponentialRampToValueAtTime(Math.max(10, f * 0.55), t + 0.06);

    this.env(g, t, 0.002, 0.08 + w * 0.12, amp * 0.9);
    o.connect(g).connect(this.master);

    o.start(t);
    o.stop(t + 0.25);
  }

  v1_buzzhh(t: number, amp: number, w: number, bright: number) {
    // noisy HH that can become buzz/tone (bandpass noise + ring)
    if (!this.ctx || !this.master) return;

    const noise = this.makeNoise();
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(5000 + w * 13000, t);
    bp.Q.setValueAtTime(8 + bright * 14, t);

    // ring modulation
    const ring = this.ctx.createOscillator();
    ring.type = "sine";
    ring.frequency.setValueAtTime(60 + w * 400, t);

    const ringG = this.ctx.createGain();
    ringG.gain.setValueAtTime(0.15 + bright * 0.35, t);

    const out = this.ctx.createGain();
    this.env(out, t, 0.001, 0.02 + w * 0.05, amp * 0.6);

    // multiply noise by ring via GainNode
    noise.connect(bp);
    ring.connect(ringG);
    ringG.connect((bp as unknown) as AudioNode); // no-op, keep ring alive

    bp.connect(out).connect(this.master);

    ring.start(t);
    ring.stop(t + 0.12);

    // noise is a looping buffer; just schedule a disconnect window
    setTimeout(() => {
      try { bp.disconnect(); out.disconnect(); } catch {}
    }, 200);
  }

  v2_ultratick(t: number, amp: number, w: number, bright: number) {
    // ultrahigh tick: very short bandpassed noise + FM ping (9k..20k)
    if (!this.ctx || !this.master) return;

    const n = this.makeNoise();
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(8000 + w * 14000, t);

    const out = this.ctx.createGain();
    this.env(out, t, 0.0005, 0.006 + w * 0.02, amp * 0.35);

    n.connect(hp).connect(out).connect(this.master);

    setTimeout(() => {
      try { hp.disconnect(); out.disconnect(); } catch {}
    }, 80);
  }

  v3_ping(t: number, amp: number, w: number, bright: number) {
    // metallic ping: triangle osc -> resonant bandpass -> short env
    if (!this.ctx || !this.master) return;

    const o = this.ctx.createOscillator();
    o.type = "triangle";
    const f = 700 + w * 14000;
    o.frequency.setValueAtTime(f, t);

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(f, t);
    bp.Q.setValueAtTime(12 + bright * 18, t);

    const out = this.ctx.createGain();
    this.env(out, t, 0.001, 0.03 + w * 0.12, amp * 0.35);

    o.connect(bp).connect(out).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  v4_bitsn(t: number, amp: number, w: number, bright: number) {
    // "bit noise": noise -> waveshaper (quantize-ish) -> bandpass
    if (!this.ctx || !this.master) return;

    const n = this.makeNoise();
    const sh = this.ctx.createWaveShaper();
    sh.curve = this.bitcrushCurve(8 + Math.floor(w * 24));
    sh.oversample = "none";

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(400 + w * 6000, t);
    bp.Q.setValueAtTime(6 + bright * 14, t);

    const out = this.ctx.createGain();
    this.env(out, t, 0.001, 0.04 + w * 0.10, amp * 0.45);

    n.connect(sh).connect(bp).connect(out).connect(this.master);

    setTimeout(() => {
      try { bp.disconnect(); out.disconnect(); } catch {}
    }, 220);
  }

  v5_airgap(t: number, amp: number, w: number, bright: number) {
    // "air gap": high noise burst with notch-ish movement
    if (!this.ctx || !this.master) return;

    const n = this.makeNoise();
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(4000 + w * 15000, t);

    const notch = this.ctx.createBiquadFilter();
    notch.type = "notch";
    notch.frequency.setValueAtTime(1200 + w * 8000, t);
    notch.Q.setValueAtTime(3 + bright * 10, t);

    const out = this.ctx.createGain();
    this.env(out, t, 0.001, 0.02 + w * 0.07, amp * 0.35);

    n.connect(hp).connect(notch).connect(out).connect(this.master);

    setTimeout(() => {
      try { notch.disconnect(); out.disconnect(); } catch {}
    }, 140);
  }

  v6_rattle(t: number, amp: number, w: number, bright: number) {
    // rattly AM: short burst of noise modulated by fast osc
    if (!this.ctx || !this.master) return;

    const n = this.makeNoise();
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(800 + w * 9000, t);
    bp.Q.setValueAtTime(2 + bright * 9, t);

    const am = this.ctx.createGain();
    am.gain.setValueAtTime(0.0, t);

    const mod = this.ctx.createOscillator();
    mod.type = "square";
    mod.frequency.setValueAtTime(10 + w * 260, t);

    const modDepth = this.ctx.createGain();
    modDepth.gain.setValueAtTime(0.5 + bright * 0.45, t);

    const out = this.ctx.createGain();
    this.env(out, t, 0.001, 0.03 + w * 0.10, amp * 0.4);

    // AM: mod -> modDepth -> am.gain
    mod.connect(modDepth).connect(am.gain);
    n.connect(bp).connect(am).connect(out).connect(this.master);

    mod.start(t);
    mod.stop(t + 0.2);

    setTimeout(() => {
      try { out.disconnect(); } catch {}
    }, 240);
  }

  v7_metak(t: number, amp: number, w: number, bright: number) {
    // "meta-kick": sine + clipped pulse transient
    if (!this.ctx || !this.master) return;

    const o = this.ctx.createOscillator();
    o.type = "sine";
    const f0 = 35 + w * 90;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, f0 * 0.6), t + 0.08);

    const sh = this.ctx.createWaveShaper();
    sh.curve = this.softClipCurve(0.8 + bright * 0.4);

    const out = this.ctx.createGain();
    this.env(out, t, 0.001, 0.06 + w * 0.14, amp * 0.55);

    o.connect(sh).connect(out).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  // ------- utilities -------
  makeNoise(): AudioBufferSourceNode {
    if (!this.ctx) throw new Error("ctx not init");
    const bufferSize = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  softClipCurve(drive: number) {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const y = Math.tanh(x * drive * 2.5);
      curve[i] = y;
    }
    return curve;
  }

  bitcrushCurve(steps: number) {
    const n = 2048;
    const curve = new Float32Array(n);
    const s = Math.max(2, steps);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const q = Math.round(((x + 1) / 2) * (s - 1)) / (s - 1);
      curve[i] = q * 2 - 1;
    }
    return curve;
  }

  beep() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + 0.01;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(880, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.22);
  }
}

// ------- UI -------

const engine = new Engine();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function slider(label: string, min: number, max: number, step: number, value: number, onInput: (v: number)=>void) {
  const wrap = el("div", "ctl");
  const lab = el("label");
  lab.textContent = label;
  const s = el("input") as HTMLInputElement;
  s.type = "range";
  s.min = String(min);
  s.max = String(max);
  s.step = String(step);
  s.value = String(value);
  const val = el("span", "val");
  val.textContent = String(value);

  s.addEventListener("input", () => {
    const v = Number(s.value);
    val.textContent = String(v);
    onInput(v);
  });

  wrap.append(lab, s, val);
  return wrap;
}

function select(label: string, items: string[], value: string, onChange: (v: string)=>void) {
  const wrap = el("div", "ctl");
  const lab = el("label");
  lab.textContent = label;
  const sel = el("select") as HTMLSelectElement;
  for (const it of items) {
    const opt = el("option") as HTMLOptionElement;
    opt.value = it;
    opt.textContent = it;
    sel.append(opt);
  }
  sel.value = value;
  sel.addEventListener("change", () => onChange(sel.value));
  wrap.append(lab, sel);
  return wrap;
}

function checkbox(label: string, value: boolean, onChange: (v: boolean)=>void) {
  const wrap = el("div", "ctl");
  const lab = el("label");
  const cb = el("input") as HTMLInputElement;
  cb.type = "checkbox";
  cb.checked = value;
  cb.addEventListener("change", () => onChange(cb.checked));
  lab.append(cb, document.createTextNode(" " + label));
  wrap.append(lab);
  return wrap;
}

function button(txt: string, onClick: ()=>void) {
  const b = el("button");
  b.textContent = txt;
  b.addEventListener("click", onClick);
  return b;
}

const labels = ["SUB","BUZZHH","ULTRATK","PING","BITSN","AIRGAP","RATTLE","METAK"];

function render() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = "";

  const h = el("h1");
  h.textContent = "GRIDI — WebAudio";

  const top = el("div", "top");
  const status = el("div", "status");
  status.textContent = `status: ${engine.isRunning ? "running" : "stopped"}`;

  const startBtn = button("Start", async () => {
    await engine.start();
    status.textContent = `status: ${engine.isRunning ? "running" : "stopped"}`;
  });

  const stopBtn = button("Stop", () => {
    engine.stop();
    status.textContent = `status: ${engine.isRunning ? "running" : "stopped"}`;
  });

  const beepBtn = button("Beep", () => engine.beep());

  top.append(startBtn, stopBtn, beepBtn, status);

  const master = el("div", "master");
  master.append(
    slider("BPM", 40, 240, 1, engine.bpm, v => engine.bpm = v),
    slider("MACRO", 0, 1, 0.01, engine.macro, v => engine.macro = v),
  );

  const grid = el("div", "grid");

  engine.voices.forEach((v, i) => {
    const row = el("div", "row");
    const title = el("div", "vtitle");
    title.textContent = labels[i];

    const modeItems: Mode[] = ["hybrid","step","euclid","ca","fractal"];

    row.append(
      title,
      checkbox("on", v.on, x => v.on = x),
      select("mode", modeItems, v.mode, x => v.mode = x as Mode),
      slider("seed", 0, 99999, 1, v.seed, x => v.seed = x),
      slider("det", 0, 1, 0.01, v.determinism, x => v.determinism = x),
      slider("grav", 0, 1, 0.01, v.gravity, x => v.gravity = x),
      slider("dens", 0, 1, 0.01, v.density, x => v.density = x),
      select("sub", ["8","16","32","64"], String(v.subdiv===1?8:v.subdiv===2?16:v.subdiv===4?32:64), x => {
        const map: any = { "8":1, "16":2, "32":4, "64":8 };
        v.subdiv = map[x];
      }),
      slider("len", 1, 64, 1, v.length, x => { v.length = x; engine.regenPattern(i); }),
      slider("drop", 0, 1, 0.01, v.drop, x => v.drop = x),
      slider("amp", 0, 0.8, 0.01, v.amp, x => v.amp = x),
      slider("weird", 0, 1, 0.01, v.weird, x => v.weird = x),
      slider("rot", -32, 32, 1, v.euclidRot, x => v.euclidRot = x),
      slider("rule", 0, 255, 1, v.caRule, x => v.caRule = x),
    );

    grid.append(row);
  });

  app.append(h, top, master, grid);
}

render();

// auto-start patterns generation (not audio)
for (let i = 0; i < 8; i++) engine.regenPattern(i);
