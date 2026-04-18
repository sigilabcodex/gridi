// src/engine/scheduler.ts
import type { ControlModule, Patch, SoundModule, TriggerModule } from "../patch.ts";
import { clamp, getSoundModules, isControl, isTrigger } from "../patch.ts";
import type { Engine } from "./audio";
import { createPatternModuleForTrigger } from "./pattern/module.ts";
import { sampleControl01 } from "./control.ts";
import { compileRoutingGraph } from "../routingGraph.ts";
import { laneRoleFromPatternEvent, noteOffsetsFromPatternEvent, type GridiTriggerEvent } from "./events.ts";

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
  let compiledRouting = compileRoutingGraph({ modules: [], buses: [], connections: [] });
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
    const triggerId = compiledRouting.eventSourceBySoundId.get(sound.id) ?? sound.triggerSource;
    if (!triggerId) return null;
    const trg = allModules.find((m): m is TriggerModule => m.id === triggerId && isTrigger(m));
    return trg ?? null;
  }



  function modulateTrigger(trigger: TriggerModule, activePatch: Patch, nowSec: number): TriggerModule {
    const controlId = trigger.modulations?.density;
    if (!controlId) return trigger;
    const control = activePatch.modules.find((m): m is ControlModule => m.id === controlId && isControl(m));
    if (!control || !control.enabled) return trigger;
    const value = sampleControl01(control, nowSec);
    return { ...trigger, density: clamp(trigger.density + (value - 0.5) * 0.85, 0, 1) };
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
    compiledRouting = compileRoutingGraph(next);
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
      const effectiveTrigger = modulateTrigger(trigger, patch, now);
      const window = createPatternModuleForTrigger(effectiveTrigger).renderWindow({
        voiceId: sound.id,
        trigger: effectiveTrigger,
        startBeat: windowStartBeatAbs,
        endBeat: windowEndBeatAbs,
      });

      for (const ev of window.events) {
        const eventBeat = window.startBeat + ev.beatOffset;
        if (eventBeat <= st.lastScheduledBeat + 1e-9) continue;
        const eventTimeSec = now + ev.beatOffset * secPerBeat;
        const voiceEvent: GridiTriggerEvent = sound.type === "drum"
          ? {
            kind: "drum",
            timeSec: eventTimeSec,
            velocity: ev.value,
            lane: laneRoleFromPatternEvent(ev),
          }
          : {
            kind: "note",
            timeSec: eventTimeSec,
            velocity: ev.value,
            notes: noteOffsetsFromPatternEvent(ev, effectiveTrigger),
          };
        engine.triggerVoice(sound.id, patch, eventTimeSec, voiceEvent);
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
