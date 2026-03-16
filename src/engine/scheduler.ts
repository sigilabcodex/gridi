// src/engine/scheduler.ts
import type { Patch, SoundModule, TriggerModule } from "../patch.ts";
import { getSoundModules, isTrigger } from "../patch.ts";
import type { Engine } from "./audio";
import { createPatternModuleForTrigger } from "./pattern/module.ts";

export type Scheduler = {
  readonly running: boolean;
  setBpm(bpm: number): void;
  setPatch(patch: Patch, opts?: { regen?: boolean }): void;
  regenAll(): void;
  start(): void;
  stop(): void;
};

type SequenceState = { lastScheduledBeat: number };

export function createScheduler(engine: Engine): Scheduler {
  let running = false;
  const lookaheadSec = 0.12;
  const intervalMs = 25;
  let timer: number | null = null;

  let bpm = 124;
  let patch: Patch | null = null;
  let transportStartTimeSec = 0;
  let transportStartBeatAbs = 0;
  const sequenceStates = new Map<string, SequenceState>();

  const getSequenceState = (id: string) => {
    let st = sequenceStates.get(id);
    if (!st) {
      st = { lastScheduledBeat: Number.NEGATIVE_INFINITY };
      sequenceStates.set(id, st);
    }
    return st;
  };

  const secondsPerBeat = () => 60 / bpm;
  const getBeatAbs = (nowSec: number) => transportStartBeatAbs + (nowSec - transportStartTimeSec) / secondsPerBeat();

  function resolveTrigger(sound: SoundModule, allModules: Patch["modules"]): TriggerModule | null {
    if (!sound.triggerSource) return null;
    const trg = allModules.find((m) => m.id === sound.triggerSource && isTrigger(m));
    return trg ?? null;
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

  function regenAll() {
    if (!patch) return;
    for (const sound of getSoundModules(patch)) {
      getSequenceState(sound.id).lastScheduledBeat = Number.NEGATIVE_INFINITY;
    }
  }

  function setPatch(next: Patch, opts?: { regen?: boolean }) {
    patch = next;
    if (opts?.regen !== false) regenAll();
  }

  function scheduleLoop() {
    if (!running || !patch) return;

    const now = engine.ctx.currentTime;
    const windowStartBeatAbs = getBeatAbs(now);
    const windowEndBeatAbs = getBeatAbs(now + lookaheadSec);
    const secPerBeat = secondsPerBeat();

    for (const sound of getSoundModules(patch)) {
      if (!sound.enabled) continue;
      const trigger = resolveTrigger(sound, patch.modules);
      if (!trigger || !trigger.enabled) continue;

      const st = getSequenceState(sound.id);
      const window = createPatternModuleForTrigger(trigger).renderWindow({
        voiceId: sound.id,
        trigger,
        startBeat: windowStartBeatAbs,
        endBeat: windowEndBeatAbs,
      });

      for (const ev of window.events) {
        const eventBeat = window.startBeat + ev.beatOffset;
        if (eventBeat <= st.lastScheduledBeat + 1e-9) continue;
        engine.triggerVoice(sound.id, patch, now + ev.beatOffset * secPerBeat);
        st.lastScheduledBeat = eventBeat;
      }
    }
  }

  function start() {
    if (running) return;
    running = true;
    for (const st of sequenceStates.values()) st.lastScheduledBeat = Number.NEGATIVE_INFINITY;
    transportStartTimeSec = engine.ctx.currentTime;
    transportStartBeatAbs = 0;
    timer = window.setInterval(scheduleLoop, intervalMs);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    for (const st of sequenceStates.values()) st.lastScheduledBeat = Number.NEGATIVE_INFINITY;
    transportStartTimeSec = 0;
    transportStartBeatAbs = 0;
  }

  return { get running() { return running; }, setBpm, setPatch, regenAll, start, stop };
}
