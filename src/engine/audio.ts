// src/engine/audio.ts
import type { Patch, SoundModule } from "../patch";
import { clamp, getSoundModules, isEffect } from "../patch";
import type { AudioModuleInstance } from "./audioModule";
import { createEffectInstance } from "./effects";
import { collectVoiceRoutes, validateConnections } from "./routing";

export type Engine = {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;
  voiceLastTrigMs: Map<string, number>;

  start(): Promise<void>;
  setMasterMute(muted: boolean): void;
  setMasterGain(g: number): void;
  syncRouting(patch: Patch): void;
  disconnectModule(moduleId: string): void;
  dispose(): void;

  triggerVoice(moduleId: string, patch: Patch, when?: number): void;

  // === visual data ===
  getScopeData(out?: Float32Array): Float32Array; // -1..+1
  getSpectrumData(out?: Float32Array): Float32Array; // 0..1 (normalized)
};

const EPS = 1e-5;

function safe(v: number, fallback: number) {
  return Number.isFinite(v) ? v : fallback;
}

function clamp01(x: number) {
  return clamp(x, 0, 1);
}

function voiceFreqHz(v: SoundModule, i: number, macro: number) {
  const timbre = clamp01(safe(v.timbre, 0.5));
  const macro01 = clamp01(safe(macro, 0.5));

  if (v.type === "drum") {
    return 70 + timbre * 260 + macro01 * 40 + i * 8;
  }

  const basePool = [110, 146.83, 196, 220, 293.66, 392];
  const base = basePool[i % basePool.length];
  const octave = 1 + Math.floor((i / basePool.length) % 2);
  return base * octave * (0.7 + timbre * 0.9 + macro01 * 0.2);
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

export function createEngine(): Engine {
  const ctx = new AudioContext();

  const master = ctx.createGain();

  // Keep target gain when toggling mute.
  let masterTarget = 0.8;
  let masterMuted = false;
  master.gain.value = masterTarget;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  master.connect(analyser);
  analyser.connect(ctx.destination);

  const effectModules = new Map<string, AudioModuleInstance>();
  let activeConnections: Patch["connections"] = [];

  // visual buffers (reused)
  const scopeBuf = new Float32Array(analyser.fftSize);
  const scopeByte = new Uint8Array(analyser.fftSize);
  const specFloat = new Float32Array(analyser.frequencyBinCount);
  const specByte = new Uint8Array(analyser.frequencyBinCount);

  // now that voices are “modular”, allow more than 8
  const voiceLastTrigMs = new Map<string, number>();

  function setMasterMute(muted: boolean) {
    masterMuted = !!muted;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(masterMuted ? 0 : masterTarget, now, 0.01);
  }

  function setMasterGain(g: number) {
    masterTarget = clamp(safe(g, 0.8), 0, 1);
    if (!masterMuted) master.gain.value = masterTarget;
  }

  async function start() {
    if (ctx.state !== "running") await ctx.resume();
  }

  function mkPanner(pan: number) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(safe(pan, 0), -1, 1);
    return p;
  }

  function syncRouting(patch: Patch) {
    const nextEffects = patch.modules.filter(isEffect);
    const nextIds = new Set(nextEffects.map((fx) => fx.id));

    for (const fx of nextEffects) {
      const existing = effectModules.get(fx.id);
      if (existing) {
        existing.update(fx);
        continue;
      }
      effectModules.set(fx.id, createEffectInstance(ctx, fx));
    }

    for (const [id, module] of effectModules) {
      if (nextIds.has(id)) continue;
      module.dispose();
      effectModules.delete(id);
    }

    for (const module of effectModules.values()) {
      module.disconnect();
    }

    const validation = validateConnections(patch);
    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) console.warn(`[routing] ${warning}`);
    }
    activeConnections = validation.validConnections;

    for (const conn of activeConnections) {
      if (conn.to.type === "module" && conn.to.id) {
        const source = effectModules.get(conn.fromModuleId);
        const target = effectModules.get(conn.to.id);
        if (source && target) source.connect(target.input);
      }
      if (conn.to.type === "master") {
        const source = effectModules.get(conn.fromModuleId);
        if (source) source.connect(master);
      }
    }

    for (const [id, module] of effectModules) {
      const hasOut = activeConnections.some((conn) => conn.fromModuleId === id);
      if (!hasOut) module.connect(master);
    }
  }

  function resolveVoiceDestinations(voiceId: string): { node: AudioNode; gain: number }[] {
    const routes = collectVoiceRoutes(voiceId, activeConnections);
    if (!routes.length) return [{ node: master, gain: 1 }];

    const destinations: { node: AudioNode; gain: number }[] = [];
    for (const route of routes) {
      const gain = clamp(safe(route.gain, 1), 0, 2);
      if (route.to.type === "master") destinations.push({ node: master, gain });
      if (route.to.type === "module" && route.to.id) {
        const fx = effectModules.get(route.to.id);
        if (fx) destinations.push({ node: fx.input, gain });
      }
    }

    return destinations.length ? destinations : [{ node: master, gain: 1 }];
  }

  function disconnectModule(moduleId: string) {
    const module = effectModules.get(moduleId);
    if (!module) return;
    module.dispose();
    effectModules.delete(moduleId);
  }

  function dispose() {
    for (const module of effectModules.values()) {
      module.dispose();
    }
    effectModules.clear();
    master.disconnect();
    analyser.disconnect();
    void ctx.close();
  }

  // === visuals API ===
  function getScopeData(out?: Float32Array) {
    const buf = out && out.length === scopeBuf.length ? out : scopeBuf;
    const anyAnalyser = analyser as any;

    if (typeof anyAnalyser.getFloatTimeDomainData === "function") {
      anyAnalyser.getFloatTimeDomainData(buf);
      return buf;
    }

    analyser.getByteTimeDomainData(scopeByte);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = (scopeByte[i] - 128) / 128; // ~ -1..1
    }
    return buf;
  }

  function getSpectrumData(out?: Float32Array) {
    const buf = out && out.length === specFloat.length ? out : specFloat;
    const anyAnalyser = analyser as any;

    if (typeof anyAnalyser.getFloatFrequencyData === "function") {
      anyAnalyser.getFloatFrequencyData(buf); // dBFS-ish (negative)
      // normalize to 0..1
      const minDb = -100;
      const maxDb = -20;
      for (let i = 0; i < buf.length; i++) {
        const db = buf[i];
        buf[i] = clamp01((db - minDb) / (maxDb - minDb));
      }
      return buf;
    }

    analyser.getByteFrequencyData(specByte);
    for (let i = 0; i < buf.length; i++) buf[i] = specByte[i] / 255;
    return buf;
  }

  function triggerVoice(moduleId: string, patch: Patch, when?: number) {
    voiceLastTrigMs.set(moduleId, performance.now());

    const voices = getSoundModules(patch);
    const i = voices.findIndex((voice) => voice.id === moduleId);
    const v = i >= 0 ? voices[i] : undefined;
    if (!v || !v.enabled) return;

    const now = typeof when === "number" && Number.isFinite(when) ? when : ctx.currentTime;
    const amp = clamp(safe(v.amp, 0.12), 0, 1);
    const timbre = clamp01(safe(v.timbre, 0.5));
    const pan = clamp(safe(v.pan, 0), -1, 1);

    const attack = 0.003 + (1 - timbre) * 0.01;
    const decay = 0.08 + timbre * 0.45;

    const osc = ctx.createOscillator();
    osc.type = timbre < 0.33 ? "sine" : timbre < 0.66 ? "triangle" : "sawtooth";

    const voiceGain = ctx.createGain();
    const panNode = mkPanner(pan);

    osc.connect(voiceGain);
    voiceGain.connect(panNode);

    const destinations = resolveVoiceDestinations(v.id);
    const sendGains: GainNode[] = [];
    for (const route of destinations) {
      if (route.gain === 1) {
        panNode.connect(route.node);
      } else {
        const send = ctx.createGain();
        send.gain.value = route.gain;
        panNode.connect(send);
        send.connect(route.node);
        sendGains.push(send);
      }
    }

    osc.onended = () => {
      for (const send of sendGains) send.disconnect();
      panNode.disconnect();
      voiceGain.disconnect();
    };

    const freq = voiceFreqHz(v, i, patch.macro);
    osc.frequency.cancelScheduledValues(now);
    osc.frequency.setValueAtTime(freq, now);

    envExp(voiceGain, now, attack, decay, amp * 0.8);

    const stopAt = now + attack + decay + 0.02;
    osc.start(now);
    osc.stop(stopAt);
  }

  return {
    ctx,
    master,
    analyser,
    voiceLastTrigMs,
    start,
    setMasterMute,
    setMasterGain,
    syncRouting,
    disconnectModule,
    dispose,
    triggerVoice,
    getScopeData,
    getSpectrumData,
  };
}
