// src/engine/audio.ts
import type { Patch } from "../patch";

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const finite = (x: number, fallback: number) => (Number.isFinite(x) ? x : fallback);

export type Engine = {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;

  // para LEDs
  voiceLastTrigMs: Float64Array;

  start(): Promise<void>;
  setMasterMute(muted: boolean): void;
  setMasterGain(g: number): void;

  triggerVoice(i: number, patch: Patch): void;
};

export function createEngine(): Engine {
  const ctx = new AudioContext();

  const master = ctx.createGain();
  let masterGain = 0.9;
  let masterMuted = false;
  master.gain.value = masterGain;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  master.connect(analyser);
  analyser.connect(ctx.destination);

  const voiceLastTrigMs = new Float64Array(8);

  async function start() {
    if (ctx.state !== "running") {
      await ctx.resume();
    }
  }

  function setMasterMute(muted: boolean) {
    masterMuted = muted;

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(masterMuted ? 0 : masterGain, now, 0.01);
  }

  function setMasterGain(g: number) {
    masterGain = clamp(finite(g, 0.9), 0, 1);

    // si no está muteado, aplica inmediatamente
    if (!masterMuted) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(masterGain, now, 0.01);
    }
  }

  function triggerVoice(i: number, patch: Patch) {
    // LED mark
    voiceLastTrigMs[i] = performance.now();

    const vAny: any = patch.voices[i];
    if (!vAny) return;

    // compatibilidad: enabled -> on
    const enabled = Boolean(vAny.enabled ?? vAny.on ?? false);
    if (!enabled) return;

    const now = ctx.currentTime;

    // compatibilidad: timbre -> weird (fallback)
    const timbre = finite(vAny.timbre ?? vAny.weird ?? 0.5, 0.5);
    const amp = clamp(finite(vAny.amp ?? 0.1, 0.1), 0, 1);

    // Pitch placeholder (solo para oír algo estable)
    const seed = finite(vAny.seed ?? 0, 0) | 0;
    const base = 60 + (seed % 40); // 60..99
    const hz = finite(base * 4, 440);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();

    filt.type = "lowpass";
    filt.frequency.value = finite(200 + timbre * 5000, 1200);
    filt.Q.value = finite(0.3 + timbre * 6, 1.0);

    osc.type = "sine";
    osc.frequency.value = hz;

    // Envelope seguro (evita 0 exacto y NaN)
    const peak = Math.max(0.0001, amp);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(filt);
    filt.connect(g);
    g.connect(master);

    osc.start(now);
    osc.stop(now + 0.15);
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
