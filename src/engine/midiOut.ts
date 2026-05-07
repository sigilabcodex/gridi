import type { Patch } from "../patch.ts";
import type { PatchRoute } from "../routingGraph.ts";
import type { GridiTriggerEvent } from "./events.ts";

export const DEFAULT_MIDI_BASE_NOTE = 60;
export const DEFAULT_MIDI_GATE_MS = 120;
export const DEFAULT_MIDI_CHANNEL = 1;

const DRUM_LANE_NOTES = {
  low: 36,
  mid: 38,
  high: 42,
  accent: 46,
} as const;

export type MidiOutMessage = [number, number, number];

export type MidiOutRouteConfig = {
  route: PatchRoute;
  sourceModuleId: string;
  outputId: string | null;
  outputName: string | null;
  channel: number;
  baseNote: number;
  gateMs: number;
};

export function normalizeMidiChannel(value: unknown, fallback = DEFAULT_MIDI_CHANNEL) {
  const channel = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(1, Math.min(16, channel));
}

export function clampMidiNoteNumber(value: unknown, fallback = DEFAULT_MIDI_BASE_NOTE) {
  const note = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(0, Math.min(127, note));
}

export function normalizeMidiVelocity(value: unknown) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const scaled = numeric <= 1 ? Math.round(numeric * 127) : Math.round(numeric);
  return Math.max(1, Math.min(127, scaled));
}

export function normalizeMidiGateMs(value: unknown, fallback = DEFAULT_MIDI_GATE_MS) {
  const ms = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(1, Math.min(10000, ms));
}

export function makeNoteOnMessage(note: number, velocity: number, channel = DEFAULT_MIDI_CHANNEL): MidiOutMessage {
  return [0x90 + normalizeMidiChannel(channel) - 1, clampMidiNoteNumber(note), normalizeMidiVelocity(velocity)];
}

export function makeNoteOffMessage(note: number, channel = DEFAULT_MIDI_CHANNEL): MidiOutMessage {
  return [0x80 + normalizeMidiChannel(channel) - 1, clampMidiNoteNumber(note), 0];
}

export function midiNoteFromGridiEvent(event: GridiTriggerEvent, baseNote = DEFAULT_MIDI_BASE_NOTE) {
  const base = clampMidiNoteNumber(baseNote);
  if (event.kind === "note") {
    const offset = event.notes.find((note) => Number.isFinite(note)) ?? 0;
    return clampMidiNoteNumber(base + Math.round(offset));
  }
  const lane = event.lane === "low" || event.lane === "mid" || event.lane === "high" || event.lane === "accent" ? event.lane : null;
  return lane ? DRUM_LANE_NOTES[lane] : base;
}

export function midiOutRoutesForSource(patch: Patch, sourceModuleId: string): MidiOutRouteConfig[] {
  return (patch.routes ?? [])
    .filter((route) => (
      route.enabled &&
      route.domain === "midi" &&
      route.source.kind === "module" &&
      route.source.moduleId === sourceModuleId &&
      route.target.kind === "external" &&
      route.target.externalType === "midi"
    ))
    .map((route) => {
      const target = route.target.kind === "external" ? route.target : null;
      const meta = route.metadata ?? {};
      return {
        route,
        sourceModuleId,
        outputId: target?.portId ?? null,
        outputName: meta.midiOutputName ?? null,
        channel: normalizeMidiChannel(target?.channel),
        baseNote: clampMidiNoteNumber(meta.midiBaseNote),
        gateMs: normalizeMidiGateMs(meta.midiGateMs),
      };
    });
}
