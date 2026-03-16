// src/engine/scheduler.ts
import type { Patch, VoiceModule } from "../patch.ts";
import { getVoices, isVoice } from "../patch.ts";
import type { Engine } from "./audio";
import { createPatternModuleForVoice } from "./pattern/module.ts";

export type Scheduler = {
  readonly running: boolean;

  setBpm(bpm: number): void;
  setPatch(patch: Patch, opts?: { regen?: boolean }): void;

  regenAll(): void;

  start(): void;
  stop(): void;
};

type VoiceSequenceState = {
  lastScheduledBeat: number;
};

export function createScheduler(engine: Engine): Scheduler {
  let running = false;

  const lookaheadSec = 0.12;
  const intervalMs = 25;
  let timer: number | null = null;

  let bpm = 124;
  let patch: Patch | null = null;
  let transportStartTimeSec = 0;
  let transportStartBeatAbs = 0;

  // states by VOICE ID (stable across reordering)
  const sequenceStates = new Map<string, VoiceSequenceState>();

  function getVoiceId(v: VoiceModule, i: number) {
    return v.id || `idx:${i}`;
  }

  function getSequenceState(voiceId: string): VoiceSequenceState {
    let st = sequenceStates.get(voiceId);
    if (!st) {
      st = {
        lastScheduledBeat: Number.NEGATIVE_INFINITY,
      };
      sequenceStates.set(voiceId, st);
    }
    return st;
  }

  function setBpm(next: number) {
    const clamped = Math.max(20, Math.min(400, next | 0));
    if (running) {
      const nowSec = engine.ctx.currentTime;
      transportStartBeatAbs = getBeatAbs(nowSec);
      transportStartTimeSec = nowSec;
    }
    bpm = clamped;
  }

  function secondsPerBeat() {
    return 60 / bpm;
  }

  function getBeatAbs(nowSec: number) {
    return transportStartBeatAbs + (nowSec - transportStartTimeSec) / secondsPerBeat();
  }

  function regenAll() {
    if (!patch) return;
    const voices = getVoices(patch);
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      const id = getVoiceId(v, i);
      const st = getSequenceState(id);
      st.lastScheduledBeat = Number.NEGATIVE_INFINITY;
    }
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

      const voiceId = getVoiceId(v, i);
      const st = getSequenceState(voiceId);

      const secPerBeat = secondsPerBeat();
      const windowStartSec = now;
      const windowStartBeatAbs = getBeatAbs(windowStartSec);
      const windowEndBeatAbs = getBeatAbs(windowStartSec + lookaheadSec);

      const sourceId = v.patternSource === "self" ? "self" : v.patternSource;
      const sourceVoice = sourceId === "self"
        ? v
        : patch.modules.find((m) => m.id === sourceId && isVoice(m)) ?? v;
      const sourceRef = sourceId === "self" || sourceVoice === v
        ? { type: "self" as const }
        : { type: "module" as const, moduleId: sourceId };

      const window = createPatternModuleForVoice(sourceVoice).renderWindow({
        voice: sourceVoice,
        voiceId,
        source: sourceRef,
        startBeat: windowStartBeatAbs,
        endBeat: windowEndBeatAbs,
      });

      const eps = 1e-9;
      for (const ev of window.events) {
        const eventBeat = window.startBeat + ev.beatOffset;
        if (eventBeat <= st.lastScheduledBeat + eps) continue;

        const eventSec = windowStartSec + ev.beatOffset * secPerBeat;
        engine.triggerVoice(i, patch, eventSec);
        st.lastScheduledBeat = eventBeat;
      }
    }
  }

  function start() {
    if (running) return;
    running = true;

    const now = engine.ctx.currentTime;

    if (patch) {
      const voices = getVoices(patch);
      for (let i = 0; i < voices.length; i++) {
        const v = voices[i];
        const id = getVoiceId(v, i);
        const st = getSequenceState(id);
        st.lastScheduledBeat = Number.NEGATIVE_INFINITY;
      }
    } else {
      for (const st of sequenceStates.values()) {
        st.lastScheduledBeat = Number.NEGATIVE_INFINITY;
      }
    }

    transportStartTimeSec = now;
    transportStartBeatAbs = 0;

    timer = window.setInterval(scheduleLoop, intervalMs);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (timer !== null) window.clearInterval(timer);
    timer = null;

    for (const st of sequenceStates.values()) {
      st.lastScheduledBeat = Number.NEGATIVE_INFINITY;
    }
    transportStartTimeSec = 0;
    transportStartBeatAbs = 0;
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
