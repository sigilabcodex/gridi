// src/engine/audio.ts
import type { ControlModule, Patch, SoundModule } from "../patch";
import { clamp, getSoundModules, isControl, isEffect, normalizeSynthReceptionMode } from "../patch";
import type { AudioModuleInstance } from "./audioModule";
import { createEffectInstance } from "./effects";
import { collectVoiceRoutes, validateConnections } from "./routing";
import { sampleControl01 } from "./control";
import { compileRoutingGraph } from "../routingGraph.ts";
import { selectNotesForReception, type GridiTriggerEvent } from "./events.ts";

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

  triggerVoice(moduleId: string, patch: Patch, when?: number, event?: GridiTriggerEvent): void;

  // === visual data ===
  getScopeData(out?: Float32Array): Float32Array; // -1..+1
  getStereoScopeData(outLeft?: Float32Array, outRight?: Float32Array): { left: Float32Array; right: Float32Array };
  getSpectrumData(out?: Float32Array): Float32Array; // 0..1 (normalized)
  getMasterActivity(): { level: number; transient: number; active: boolean; left: number; right: number };
};

const EPS = 1e-5;

function safe(v: number, fallback: number) {
  return Number.isFinite(v) ? v : fallback;
}

function clamp01(x: number) {
  return clamp(x, 0, 1);
}



function modulationValue(patch: Patch, controlId: string | undefined, now: number): number | null {
  if (!controlId) return null;
  const control = patch.modules.find((m): m is ControlModule => m.id === controlId && isControl(m));
  if (!control || !control.enabled) return null;
  return sampleControl01(control, now);
}

function modulate(base: number, patch: Patch, module: SoundModule, key: string, now: number, depth: number) {
  const controlId = module.modulations?.[key];
  const value = modulationValue(patch, controlId, now);
  if (value == null) return base;
  return clamp(base + (value - 0.5) * depth, 0, 1);
}
function oscTypeFromWaveform(waveform: number): OscillatorType {
  if (waveform < 0.25) return "sine";
  if (waveform < 0.5) return "triangle";
  if (waveform < 0.75) return "sawtooth";
  return "square";
}

function tonalBaseFreq(v: SoundModule, i: number, macro: number) {
  if (v.type !== "tonal") return 110;
  const macro01 = clamp01(safe(macro, 0.5));
  const basePool = [55, 82.41, 110, 146.83, 196, 220];
  const base = basePool[i % basePool.length] ?? 110;
  const octave = 1 + Math.floor(i / basePool.length) % 2;
  const coarseRatio = Math.pow(2, safe(v.coarseTune, 0) / 12);
  const fineRatio = Math.pow(2, safe(v.fineTune, 0) / 12);
  return base * octave * coarseRatio * fineRatio * (0.92 + macro01 * 0.16);
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

  const stereoSplitter = ctx.createChannelSplitter(2);
  const analyserLeft = ctx.createAnalyser();
  const analyserRight = ctx.createAnalyser();
  analyserLeft.fftSize = 256;
  analyserRight.fftSize = 256;

  master.connect(analyser);
  master.connect(stereoSplitter);
  stereoSplitter.connect(analyserLeft, 0);
  stereoSplitter.connect(analyserRight, 1);
  analyser.connect(ctx.destination);

  const effectModules = new Map<string, AudioModuleInstance>();
  let activeConnections: Patch["connections"] = [];

  // visual buffers (reused)
  const scopeBuf = new Float32Array(analyser.fftSize);
  const scopeByte = new Uint8Array(analyser.fftSize);
  const specFloat = new Float32Array(analyser.frequencyBinCount);
  const specByte = new Uint8Array(analyser.frequencyBinCount);
  const scopeLeft = new Float32Array(analyserLeft.fftSize);
  const scopeRight = new Float32Array(analyserRight.fftSize);
  let lastActivityLevel = 0;
  let smoothedActivityLevel = 0;
  let transientActivity = 0;

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
    if (!masterMuted) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(masterTarget, now, 0.01);
    }
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

    const compiled = compileRoutingGraph(patch);
    const validation = validateConnections({ ...patch, connections: compiled.audioConnections });
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
    stereoSplitter.disconnect();
    analyser.disconnect();
    analyserLeft.disconnect();
    analyserRight.disconnect();
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

  function getStereoScopeData(outLeft?: Float32Array, outRight?: Float32Array) {
    const left = outLeft && outLeft.length === scopeLeft.length ? outLeft : scopeLeft;
    const right = outRight && outRight.length === scopeRight.length ? outRight : scopeRight;
    const anyLeft = analyserLeft as any;
    const anyRight = analyserRight as any;
    if (typeof anyLeft.getFloatTimeDomainData === "function") {
      anyLeft.getFloatTimeDomainData(left);
      anyRight.getFloatTimeDomainData(right);
      return { left, right };
    }

    analyserLeft.getByteTimeDomainData(scopeByte);
    for (let i = 0; i < left.length; i += 1) left[i] = (scopeByte[i] - 128) / 128;
    analyserRight.getByteTimeDomainData(scopeByte);
    for (let i = 0; i < right.length; i += 1) right[i] = (scopeByte[i] - 128) / 128;
    return { left, right };
  }

  function getMasterActivity() {
    getScopeData(scopeBuf);
    getStereoScopeData(scopeLeft, scopeRight);

    let peak = 0;
    let rmsSum = 0;
    for (let i = 0; i < scopeBuf.length; i += 1) {
      const sample = Math.abs(scopeBuf[i]);
      peak = Math.max(peak, sample);
      rmsSum += sample * sample;
    }
    let leftPeak = 0;
    let rightPeak = 0;
    for (let i = 0; i < scopeLeft.length; i += 1) {
      leftPeak = Math.max(leftPeak, Math.abs(scopeLeft[i]));
      rightPeak = Math.max(rightPeak, Math.abs(scopeRight[i]));
    }

    const rms = Math.sqrt(rmsSum / Math.max(1, scopeBuf.length));
    const level = clamp01(Math.max(peak * 0.85, rms * 1.8));
    smoothedActivityLevel += (level - smoothedActivityLevel) * 0.2;
    const delta = Math.max(0, level - lastActivityLevel);
    transientActivity = transientActivity * 0.72 + delta * 1.35;
    lastActivityLevel = level;

    return {
      level: smoothedActivityLevel,
      transient: clamp01(transientActivity),
      active: smoothedActivityLevel > 0.018 || transientActivity > 0.03,
      left: clamp01(leftPeak * 0.95),
      right: clamp01(rightPeak * 0.95),
    };
  }

  function triggerVoice(moduleId: string, patch: Patch, when?: number, event?: GridiTriggerEvent) {
    voiceLastTrigMs.set(moduleId, performance.now());

    const voices = getSoundModules(patch);
    const i = voices.findIndex((voice) => voice.id === moduleId);
    const v = i >= 0 ? voices[i] : undefined;
    if (!v || !v.enabled) return;

    const now = typeof when === "number" && Number.isFinite(when)
      ? when
      : event && Number.isFinite(event.timeSec)
        ? event.timeSec
        : ctx.currentTime;
    const amp = clamp(safe(v.amp, 0.12), 0, 1);
    const panBase = v.type === "drum" ? safe(v.panBias, safe(v.pan, 0)) : safe(v.pan, 0);
    const panSpread = v.type === "drum" ? (0.35 + clamp01(safe(v.stereoWidth, 0.72)) * 0.65) : 1;
    const panNode = mkPanner(clamp(panBase * panSpread, -1, 1));

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

    if (v.type === "drum") {
      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      const preDrive = ctx.createGain();
      const driveShaper = ctx.createWaveShaper();
      const compNode = ctx.createDynamicsCompressor();
      const compMakeup = ctx.createGain();
      const toneFilter = ctx.createBiquadFilter();
      const noiseFilter = ctx.createBiquadFilter();
      const noiseGain = ctx.createGain();
      const clickGain = ctx.createGain();

      const attack = 0.001 + clamp01(safe(v.attack, 0.18)) * 0.05;
      const bodyTone = clamp01(safe(v.bodyTone, 0.5));
      const driveColor = clamp01(safe(v.driveColor, 0.5));
      const transient = clamp01(safe(v.transient, 0.5));
      const snap = clamp01(safe(v.snap, 0.2));
      const decay = 0.03 + clamp01(safe(v.decay, 0.4)) * 0.85;
      const pitchEnvAmt = clamp01(safe(v.pitchEnvAmt, 0.5));
      const bendDecay = clamp01(safe(v.bendDecay, safe(v.pitchEnvDecay, 0.25)));
      const pitchEnvDecay = 0.01 + bendDecay * 0.4;
      const noiseAmt = clamp01(safe(v.noise, 0.2));
      const tone = clamp01(safe(v.tone, 0.45));
      const comp = clamp01(safe(v.comp, 0.32));
      const compThreshold = clamp01(safe(v.compThreshold, 0.45));
      const compRatio = clamp01(safe(v.compRatio, 0.5));
      const compAttack = clamp01(safe(v.compAttack, 0.2));
      const compRelease = clamp01(safe(v.compRelease, 0.42));
      const boost = clamp01(safe(v.boost, 0.24));
      const boostTarget = v.boostTarget === "attack" || v.boostTarget === "air" ? v.boostTarget : "body";
      const modBasePitch = modulate(clamp01(safe(v.basePitch, 0.5)), patch, v, "basePitch", now, 0.9);

      bodyOsc.type = bodyTone < 0.55 ? "sine" : "triangle";
      const baseFreq = 45 + modBasePitch * 180 + i * 4 + clamp01(safe(patch.macro, 0.5)) * 24;
      bodyOsc.frequency.setValueAtTime(baseFreq * (1 + pitchEnvAmt * 2.2), now);
      bodyOsc.frequency.exponentialRampToValueAtTime(Math.max(30, baseFreq), now + pitchEnvDecay);

      toneFilter.type = "lowpass";
      toneFilter.frequency.value = 240 + tone * 7200 + driveColor * 1200 + (boostTarget === "body" ? boost * 900 : 0);
      toneFilter.Q.value = 0.4 + tone * 2.2 + driveColor * 0.6;

      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 250 + tone * 5800 + driveColor * 900 + (boostTarget === "air" ? boost * 1800 : 0);
      noiseFilter.Q.value = 0.7 + snap * 10 + (boostTarget === "attack" ? boost * 2 : 0);

      const driveAmt = clamp01(bodyTone);
      const driveInput = 1 + driveAmt * 5.4;
      preDrive.gain.value = driveInput;
      const curve = new Float32Array(256);
      const curveSlope = 1 + driveColor * 0.8;
      for (let n = 0; n < curve.length; n += 1) {
        const x = (n / (curve.length - 1)) * 2 - 1;
        curve[n] = Math.tanh((1 + driveAmt * 3.2) * x * curveSlope);
      }
      driveShaper.curve = curve;
      driveShaper.oversample = "2x";

      compNode.threshold.value = -48 + compThreshold * 40 - comp * 14;
      compNode.ratio.value = 1 + compRatio * 15 * (0.2 + comp * 0.8);
      compNode.attack.value = 0.001 + compAttack * 0.08;
      compNode.release.value = 0.03 + compRelease * 0.45;
      compNode.knee.value = 6 + comp * 18;
      compMakeup.gain.value = 1 + comp * (0.25 + compRatio * 0.65);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(preDrive);
      preDrive.connect(driveShaper);
      driveShaper.connect(toneFilter);
      toneFilter.connect(compNode);

      const noiseBuffer = ctx.createBuffer(1, Math.max(1, (ctx.sampleRate * (decay + 0.05)) | 0), ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let n = 0; n < noiseData.length; n++) noiseData[n] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(compNode);

      const clickOsc = ctx.createOscillator();
      clickOsc.type = "square";
      clickOsc.frequency.value = 1200 + snap * 2600 + (boostTarget === "attack" ? boost * 1200 : 0);
      clickOsc.connect(clickGain);
      clickGain.connect(compNode);
      compNode.connect(compMakeup);
      compMakeup.connect(panNode);

      const compPeak = amp * (0.52 + transient * 0.34) * (1 - comp * 0.2);
      const compTail = decay * (0.92 + comp * 0.4);
      const bodyBoost = boostTarget === "body" ? boost : boost * 0.25;
      const attackBoost = boostTarget === "attack" ? boost : boost * 0.2;
      const airBoost = boostTarget === "air" ? boost : boost * 0.2;

      bodyGain.gain.setValueAtTime(EPS, now);
      bodyGain.gain.exponentialRampToValueAtTime(Math.max(EPS, compPeak + bodyBoost * amp * 0.26), now + attack);
      bodyGain.gain.exponentialRampToValueAtTime(EPS, now + compTail);

      noiseGain.gain.setValueAtTime(Math.max(EPS, amp * noiseAmt * (0.76 + airBoost * 0.55)), now);
      noiseGain.gain.exponentialRampToValueAtTime(EPS, now + 0.01 + decay * 0.65);

      clickGain.gain.setValueAtTime(Math.max(EPS, amp * (0.04 + transient * 0.32 + snap * 0.2 + attackBoost * 0.22)), now + attack * 0.35);
      clickGain.gain.exponentialRampToValueAtTime(EPS, now + attack + 0.006 + (1 - snap) * 0.01);

      const stopAt = now + decay + 0.08;
      bodyOsc.start(now);
      noise.start(now);
      clickOsc.start(now);
      bodyOsc.stop(stopAt);
      noise.stop(stopAt);
      clickOsc.stop(stopAt);
      bodyOsc.onended = () => {
        bodyGain.disconnect();
        preDrive.disconnect();
        driveShaper.disconnect();
        compNode.disconnect();
        compMakeup.disconnect();
        toneFilter.disconnect();
        noiseFilter.disconnect();
        noiseGain.disconnect();
        clickGain.disconnect();
        panNode.disconnect();
        for (const send of sendGains) send.disconnect();
      };
      return;
    }

    const voiceGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    const attack = 0.002 + clamp01(safe(v.attack, 0.02)) * 0.25;
    const decay = 0.01 + clamp01(safe(v.decay, 0.35)) * 0.8;
    const sustain = clamp01(safe(v.sustain, 0.6));
    const release = 0.03 + clamp01(safe(v.release, 0.5)) * 1.3;
    const modCutoff = modulate(clamp01(safe(v.cutoff, 0.55)), patch, v, "cutoff", now, 0.9);
    const cutoff = 150 + modCutoff * 9000;
    const resonance = 0.25 + clamp01(safe(v.resonance, 0.2)) * 16;
    const glide = clamp01(safe(v.glide, 0.08));

    const freq = tonalBaseFreq(v, i, patch.macro);
    const fallbackSemitone = [0];
    const incomingNotes = event?.kind === "note" && Array.isArray(event.notes)
      ? event.notes.filter((note) => Number.isFinite(note))
      : fallbackSemitone;
    const tonalPolicy = normalizeSynthReceptionMode(v.reception);
    const semanticNotes = selectNotesForReception(tonalPolicy, incomingNotes);
    const ampPerNote = amp / Math.sqrt(Math.max(1, semanticNotes.length));
    const glideTime = 0.001 + glide * 0.35;
    const oscAs: OscillatorNode[] = [];
    const oscBs: OscillatorNode[] = [];
    const noteSemitones = semanticNotes;
    for (const semitoneOffset of noteSemitones) {
      const routedFreq = freq * Math.pow(2, semitoneOffset / 12);
      const noteOscA = ctx.createOscillator();
      const noteOscB = ctx.createOscillator();
      noteOscA.type = oscTypeFromWaveform(clamp01(safe(v.waveform, 0.3)));
      noteOscB.type = oscTypeFromWaveform(clamp01(safe(v.waveform, 0.3) + 0.22));
      noteOscA.frequency.setTargetAtTime(routedFreq, now, glideTime);
      noteOscB.frequency.setTargetAtTime(routedFreq * 1.004, now, glideTime);
      noteOscA.connect(voiceGain);
      noteOscB.connect(voiceGain);
      oscAs.push(noteOscA);
      oscBs.push(noteOscB);
    }

    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    filter.Q.value = resonance;

    const modDepth = clamp01(safe(v.modDepth, 0.15));
    const modRate = 0.2 + clamp01(safe(v.modRate, 0.25)) * 11;
    lfo.type = "sine";
    lfo.frequency.value = modRate;
    const primaryFreq = freq * Math.pow(2, (noteSemitones[0] ?? 0) / 12);
    lfoGain.gain.value = primaryFreq * modDepth * 0.08;

    lfo.connect(lfoGain);
    for (let noteIndex = 0; noteIndex < oscAs.length; noteIndex += 1) {
      lfoGain.connect(oscAs[noteIndex].frequency);
      lfoGain.connect(oscBs[noteIndex].frequency);
    }
    voiceGain.connect(filter);
    filter.connect(panNode);

    voiceGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setValueAtTime(EPS, now);
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(EPS, ampPerNote), now + attack);
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(EPS, ampPerNote * sustain), now + attack + decay);
    voiceGain.gain.setValueAtTime(Math.max(EPS, ampPerNote * sustain), now + attack + decay + 0.06);
    voiceGain.gain.exponentialRampToValueAtTime(EPS, now + attack + decay + release + 0.08);

    const stopAt = now + attack + decay + release + 0.12;
    for (const oscillator of oscAs) oscillator.start(now);
    for (const oscillator of oscBs) oscillator.start(now);
    lfo.start(now);
    for (const oscillator of oscAs) oscillator.stop(stopAt);
    for (const oscillator of oscBs) oscillator.stop(stopAt);
    lfo.stop(stopAt);
    const firstOsc = oscAs[0];
    if (!firstOsc) return;
    firstOsc.onended = () => {
      lfo.disconnect();
      lfoGain.disconnect();
      for (const oscillator of oscAs) oscillator.disconnect();
      for (const oscillator of oscBs) oscillator.disconnect();
      voiceGain.disconnect();
      filter.disconnect();
      panNode.disconnect();
      for (const send of sendGains) send.disconnect();
    };
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
    getStereoScopeData,
    getSpectrumData,
    getMasterActivity,
  };
}
