import type { PatternEvent } from "./pattern/module.ts";
import type { TriggerModule } from "../patch.ts";

export type DrumLaneRole = "low" | "mid" | "high" | "accent";
export type SynthReceptionPolicy = "mono" | "poly";

export type DrumTriggerEvent = {
  kind: "drum";
  timeSec: number;
  velocity: number;
  lane?: DrumLaneRole;
};

export type NoteTriggerEvent = {
  kind: "note";
  timeSec: number;
  velocity: number;
  /**
   * Semitone offsets relative to the module's tonal base frequency.
   * This keeps current tonal behavior backward-compatible while making
   * room for multi-note event streams.
   */
  notes: number[];
  durationSec?: number;
  registerHint?: "low" | "mid" | "high";
};

export type GridiTriggerEvent = DrumTriggerEvent | NoteTriggerEvent;

export function selectNotesForReception(policy: SynthReceptionPolicy, notes: number[]): number[] {
  const finite = notes.filter((note) => Number.isFinite(note));
  if (policy === "mono") return [finite[0] ?? 0];
  return (finite.length ? finite : [0]).slice(0, 4);
}

export function laneRoleFromPatternEvent(event: PatternEvent): DrumLaneRole {
  const laneIndex = ((event.targetLane ?? 0) % 4 + 4) % 4;
  return laneIndex === 0 ? "low" : laneIndex === 1 ? "mid" : laneIndex === 2 ? "high" : "accent";
}

export function tonalValueFromPatternEvent(event: PatternEvent, trigger: TriggerModule) {
  const laneIndex = ((event.targetLane ?? 0) % 4 + 4) % 4;
  const laneCenters = [0.18, 0.38, 0.62, 0.84];
  const modeBias = trigger.mode === "fractal" || trigger.mode === "sonar" ? 0.62 : trigger.mode === "gear" ? 0.68 : 0.52;
  return Math.max(0, Math.min(1, event.value * (1 - modeBias) + laneCenters[laneIndex] * modeBias));
}

export function noteOffsetsFromPatternEvent(event: PatternEvent, trigger: TriggerModule): number[] {
  const normalized = tonalValueFromPatternEvent(event, trigger);
  const primary = (normalized - 0.5) * 14;
  const lane = ((event.targetLane ?? 0) % 4 + 4) % 4;

  if (lane === 1) return [primary, primary + 7];
  if (lane === 2) return [primary, primary + 12];
  if (lane === 3) return [primary, primary + 4, primary + 7];
  return [primary];
}
