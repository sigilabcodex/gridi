// src/engine/scheduler.ts
import type { Patch, VoiceModule } from "../patch";
import { getVoices } from "../patch";
import type { Engine } from "./audio";
import { renderStepWindow } from "./pattern/stepEventWindow";
import { renderLegacyVoicePattern } from "./pattern/legacyPatternRenderer";

export type Scheduler = {
  readonly running: boolean;

  setBpm(bpm: number): void;
  setPatch(patch: Patch, opts?: { regen?: boolean }): void;

  regenAll(): void;

  start(): void;
  stop(): void;
};

// PR-1 ownership note: scheduler currently mutates sequencing state (step/nextTime/pattern).
type VoiceSequenceState = {
  step: number;
  nextTime: number;
  pattern: Uint8Array; // 0/1 steps
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

  // Invariant: sequence state is keyed by stable voice id, not transient array position.
  // This keeps playback continuity when UI reorders modules.

  function getVoiceId(v: VoiceModule, i: number) {
    // Prefer stable id. Fallback to index-based (only if id missing).
    // (Ideally VoiceModule.id is always present.)
    return (v as any).id ? String((v as any).id) : `idx:${i}`;
  }

  function getSequenceState(voiceId: string): VoiceSequenceState {
    let st = sequenceStates.get(voiceId);
    if (!st) {
      st = {
        step: 0,
        nextTime: 0,
        pattern: new Uint8Array([1]),
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

  function voiceStepDur(v: VoiceModule) {
    const beat = secondsPerBeat();
    const subdiv = Math.max(1, v.subdiv | 0);
    const denom = 2 * subdiv; // 1->2,2->4,4->8,8->16
    return beat / denom;
  }

  function getBeatAbs(nowSec: number) {
    return transportStartBeatAbs + (nowSec - transportStartTimeSec) / secondsPerBeat();
  }

  function regenVoicePattern(voiceId: string, v: VoiceModule) {
    const st = getSequenceState(voiceId);
    const p = renderLegacyVoicePattern(v);
    st.pattern = p;
    st.step = 0;
    st.lastScheduledBeat = Number.NEGATIVE_INFINITY;
    // st.nextTime intentionally NOT forced here; start()/stop() handle timing reset
  }

  function regenAll() {
    if (!patch) return;
    const voices = getVoices(patch);
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      const id = getVoiceId(v, i);
      regenVoicePattern(id, v);
    }
  }

  function setPatch(next: Patch, opts?: { regen?: boolean }) {
    patch = next;
    if (opts?.regen !== false) regenAll();
  }

  function scheduleLoop() {
    // Scheduler responsibility (current): advance transport cursors and dispatch exact audio times.
    // TODO(v0.32): replace step-mode path with PatternModule windows for all sequencing modes.
    if (!running || !patch) return;

    const voices = getVoices(patch);
    const ctx = engine.ctx;
    const now = ctx.currentTime;

    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      if (!v || !v.enabled) continue;

      const voiceId = getVoiceId(v, i);
      const st = getSequenceState(voiceId);

      if (v.mode === "step") {
        const secPerBeat = secondsPerBeat();
        const windowStartSec = now;
        const windowStartBeatAbs = getBeatAbs(windowStartSec);
        const windowEndBeatAbs = getBeatAbs(windowStartSec + lookaheadSec);

        const window = renderStepWindow({
          voice: v,
          voiceId,
          voiceIndex: i,
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
        continue;
      }

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
        const st = getSequenceState(id);
        st.step = 0;
        st.nextTime = now;
        st.lastScheduledBeat = Number.NEGATIVE_INFINITY;
      }
    } else {
      // If no patch yet, just reset any existing states
      for (const st of sequenceStates.values()) {
        st.step = 0;
        st.nextTime = now;
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

    // Reset scheduler timing state
    for (const st of sequenceStates.values()) {
      st.nextTime = 0;
      st.step = 0;
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
