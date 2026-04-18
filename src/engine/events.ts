import type { PatternEvent } from "./pattern/module.ts";
import type { DrumModule, SynthReceptionMode, TriggerModule } from "../patch.ts";

export type DrumLaneRole = "low" | "mid" | "high" | "accent";
export const DRUM_LANES: readonly DrumLaneRole[] = ["low", "mid", "high", "accent"];
export const DEFAULT_DRUM_LANE: DrumLaneRole = "mid";

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

export function selectNotesForReception(policy: SynthReceptionMode, notes: number[]): number[] {
  const finite = notes.filter((note) => Number.isFinite(note));
  if (policy === "mono") return [finite[0] ?? 0];
  return (finite.length ? finite : [0]).slice(0, 4);
}

export function laneRoleFromPatternEvent(event: PatternEvent): DrumLaneRole {
  const laneIndex = ((event.targetLane ?? 0) % 4 + 4) % 4;
  return laneIndex === 0 ? "low" : laneIndex === 1 ? "mid" : laneIndex === 2 ? "high" : "accent";
}

export function normalizeDrumLane(lane: DrumTriggerEvent["lane"]): DrumLaneRole {
  return lane === "low" || lane === "mid" || lane === "high" || lane === "accent" ? lane : DEFAULT_DRUM_LANE;
}

export function preferredLaneForDrumModule(module: DrumModule): DrumLaneRole | null {
  const pitch = Number.isFinite(module.basePitch) ? module.basePitch : null;
  if (pitch == null) return null;
  if (pitch < 0.3) return "low";
  if (pitch < 0.62) return "mid";
  if (pitch < 0.88) return "high";
  return "accent";
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
