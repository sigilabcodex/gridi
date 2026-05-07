import type { Patch } from "../patch.ts";
import type { PatchRoute } from "../routingGraph.ts";
import type { GridiTriggerEvent } from "./events.ts";

export const DEFAULT_MIDI_BASE_NOTE = 60;
export const DEFAULT_MIDI_GATE_MS = 120;
export const DEFAULT_MIDI_CHANNEL = 1;
export const DEFAULT_MIDI_VELOCITY_SCALE = 1;
export const DEFAULT_MIDI_MAP_MODE = "melodic";
export const DEFAULT_GM_BASIC_DRUM_MAP = [36, 38, 42, 46, 49, 45, 47, 50] as const;
export const GM_BASIC_DRUM_MAP_LABEL = "GM basic: 36/38/42/46…";

const DRUM_LANE_INDEX_BY_ROLE = {
  low: 0,
  mid: 1,
  high: 2,
  accent: 3,
} as const;

export type MidiOutMessage = [number, number, number];
export type MidiMapMode = "melodic" | "drum";

export type MidiOutPanicOptions = {
  channel?: number;
  includeAllNotesOff?: boolean;
};

export type MidiOutRouteConfig = {
  route: PatchRoute;
  sourceModuleId: string;
  outputId: string | null;
  outputName: string | null;
  channel: number;
  baseNote: number;
  gateMs: number;
  velocityScale: number;
  mapMode: MidiMapMode;
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

export function normalizeMidiVelocityScale(value: unknown, fallback = DEFAULT_MIDI_VELOCITY_SCALE) {
  const scale = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, scale));
}

export function normalizeMidiMapMode(value: unknown, fallback: MidiMapMode = DEFAULT_MIDI_MAP_MODE): MidiMapMode {
  return value === "drum" || value === "melodic" ? value : fallback;
}

export function makeNoteOnMessage(note: number, velocity: number, channel = DEFAULT_MIDI_CHANNEL): MidiOutMessage {
  return [0x90 + normalizeMidiChannel(channel) - 1, clampMidiNoteNumber(note), normalizeMidiVelocity(velocity)];
}

export function makeNoteOffMessage(note: number, channel = DEFAULT_MIDI_CHANNEL): MidiOutMessage {
  return [0x80 + normalizeMidiChannel(channel) - 1, clampMidiNoteNumber(note), 0];
}

export function makeAllNotesOffMessage(channel = DEFAULT_MIDI_CHANNEL): MidiOutMessage {
  return [0xb0 + normalizeMidiChannel(channel) - 1, 123, 0];
}

export function makeMidiTestNoteMessages(params: {
  baseNote?: number;
  velocityScale?: number;
  channel?: number;
} = {}): { noteOn: MidiOutMessage; noteOff: MidiOutMessage; note: number; velocity: number; channel: number } {
  const channel = normalizeMidiChannel(params.channel);
  const note = clampMidiNoteNumber(params.baseNote);
  const velocity = normalizeMidiVelocity(normalizeMidiVelocityScale(params.velocityScale) * 127);
  return {
    noteOn: makeNoteOnMessage(note, velocity, channel),
    noteOff: makeNoteOffMessage(note, channel),
    note,
    velocity,
    channel,
  };
}

export function makeMidiPanicMessages(options: MidiOutPanicOptions = {}): MidiOutMessage[] {
  const channel = normalizeMidiChannel(options.channel);
  const messages: MidiOutMessage[] = [];
  for (let note = 0; note <= 127; note += 1) messages.push(makeNoteOffMessage(note, channel));
  if (options.includeAllNotesOff !== false) messages.push(makeAllNotesOffMessage(channel));
  return messages;
}

export function midiDrumNoteFromGridiEvent(event: GridiTriggerEvent, baseNote = DEFAULT_MIDI_BASE_NOTE) {
  const base = clampMidiNoteNumber(baseNote);
  if (event.kind !== "drum") return base;
  const laneIndex = typeof event.laneIndex === "number" && Number.isFinite(event.laneIndex)
    ? Math.round(event.laneIndex)
    : event.lane === "low" || event.lane === "mid" || event.lane === "high" || event.lane === "accent"
      ? DRUM_LANE_INDEX_BY_ROLE[event.lane]
      : null;
  if (laneIndex === null) return base;
  return clampMidiNoteNumber(DEFAULT_GM_BASIC_DRUM_MAP[((laneIndex % DEFAULT_GM_BASIC_DRUM_MAP.length) + DEFAULT_GM_BASIC_DRUM_MAP.length) % DEFAULT_GM_BASIC_DRUM_MAP.length] ?? base);
}

export function midiNoteFromGridiEvent(event: GridiTriggerEvent, baseNote = DEFAULT_MIDI_BASE_NOTE, mapMode: MidiMapMode = DEFAULT_MIDI_MAP_MODE) {
  const base = clampMidiNoteNumber(baseNote);
  if (mapMode === "drum") return midiDrumNoteFromGridiEvent(event, base);
  if (event.kind === "note") {
    const offset = event.notes.find((note) => Number.isFinite(note)) ?? 0;
    return clampMidiNoteNumber(base + Math.round(offset));
  }
  return base;
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
        velocityScale: normalizeMidiVelocityScale(meta.midiVelocityScale),
        mapMode: normalizeMidiMapMode(meta.midiMapMode),
      };
    });
}
