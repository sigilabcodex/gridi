// src/engine/scheduler.ts
import type { ControlModule, Patch, SoundModule, TriggerModule } from "../patch.ts";
import { clamp, getSoundModules, isControl, isTrigger, normalizeDrumChannelMode } from "../patch.ts";
import type { Engine } from "./audio";
import { createPatternModuleForTrigger } from "./pattern/module.ts";
import { sampleControl01 } from "./control.ts";
import { compileRoutingGraph } from "../routingGraph.ts";
import { drumLaneForChannelMode, laneRoleFromPatternEvent, normalizeDrumLane, noteOffsetsFromPatternEvent, preferredLaneForDrumModule, type GridiTriggerEvent } from "./events.ts";

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
    if (running) {
      const currentBeat = getBeatAbs(engine.ctx.currentTime);
      for (const sound of getSoundModules(patch)) {
        const st = getSequenceState(sound.id);
        st.lastScheduledBeat = Math.max(st.lastScheduledBeat, currentBeat);
      }
      return;
    }
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
    const drumCountByTriggerId = new Map<string, number>();
    for (const sound of getSoundModules(patch)) {
      if (sound.type !== "drum") continue;
      const trigger = resolveTrigger(sound, patch.modules);
      if (!trigger?.enabled) continue;
      drumCountByTriggerId.set(trigger.id, (drumCountByTriggerId.get(trigger.id) ?? 0) + 1);
    }

    for (const sound of getSoundModules(patch)) {
      if (!sound.enabled) continue;
      const trigger = resolveTrigger(sound, patch.modules);
      if (!trigger || !trigger.enabled) continue;

      const st = getSequenceState(sound.id);
      const effectiveTrigger = modulateTrigger(trigger, patch, now);
      const channelMode = sound.type === "drum" ? normalizeDrumChannelMode(sound.drumChannel) : "auto";
      const explicitChannel = sound.type === "drum" && channelMode !== "auto" ? channelMode : null;
      const streamVoiceId = explicitChannel ? `${trigger.id}::drum-channel::${explicitChannel}` : sound.id;
      const window = createPatternModuleForTrigger(effectiveTrigger).renderWindow({
        voiceId: streamVoiceId,
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
            lane: normalizeDrumLane(laneRoleFromPatternEvent(ev)),
          }
          : {
            kind: "note",
            timeSec: eventTimeSec,
            velocity: ev.value,
            notes: noteOffsetsFromPatternEvent(ev, effectiveTrigger),
          };
        if (sound.type === "drum" && voiceEvent.kind === "drum") {
          const explicitLane = explicitChannel ? drumLaneForChannelMode(explicitChannel) : null;
          if (explicitLane && explicitLane !== normalizeDrumLane(voiceEvent.lane)) {
            st.lastScheduledBeat = eventBeat;
            continue;
          }
          const connectedDrumCount = drumCountByTriggerId.get(trigger.id) ?? 0;
          if (!explicitChannel && connectedDrumCount > 1) {
            const preferredLane = preferredLaneForDrumModule(sound);
            if (preferredLane && preferredLane !== normalizeDrumLane(voiceEvent.lane)) {
              st.lastScheduledBeat = eventBeat;
              continue;
            }
          }
        }
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
