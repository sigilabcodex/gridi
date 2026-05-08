import type { Patch, TriggerModule } from "../patch.ts";
import type { PatchRoute } from "../routingGraph.ts";
import { laneRoleFromPatternEvent, noteOffsetsFromPatternEvent, normalizeDrumLane, type GridiTriggerEvent } from "./events.ts";
import type { PatternEvent } from "./pattern/module.ts";

export const DEFAULT_MIDI_BASE_NOTE = 60;
export const DEFAULT_MIDI_GATE_MS = 120;
export const DEFAULT_MIDI_CHANNEL = 1;
export const DEFAULT_MIDI_VELOCITY_SCALE = 1;
export const DEFAULT_MIDI_MAP_MODE = "melodic";
export const DEFAULT_MIDI_DRUM_MAP_PRESET = "gm-basic";
export const DEFAULT_GM_BASIC_DRUM_MAP = [36, 38, 42, 46, 49, 45, 47, 50] as const;
export const LOW_DRUM_KIT_MAP = [35, 36, 38, 40, 41, 43, 42, 39] as const;
export const CYMBAL_HAT_TEST_MAP = [42, 44, 46, 49, 51, 42, 46, 51] as const;

const DRUM_LANE_INDEX_BY_ROLE = {
  low: 0,
  mid: 1,
  high: 2,
  accent: 3,
} as const;

export type MidiOutMessage = [number, number, number];
export type MidiMapMode = "melodic" | "drum";
export type MidiDrumMapPreset = "gm-basic" | "chromatic-base" | "low-kit" | "cymbal-test" | "single-base";

export const MIDI_DRUM_MAP_PRESETS: readonly { value: MidiDrumMapPreset; label: string; summary: string }[] = [
  { value: "gm-basic", label: "GM Basic", summary: "GM Basic: 36/38/42/46/49/45/47/50" },
  { value: "chromatic-base", label: "Chromatic from Base", summary: "Chromatic from Base: base + lane" },
  { value: "low-kit", label: "Low drum kit", summary: "Low drum kit: 35/36/38/40/41/43/42/39" },
  { value: "cymbal-test", label: "Cymbal/hat test", summary: "Cymbal/hat test: 42/44/46/49/51…" },
  { value: "single-base", label: "Single base note", summary: "Single base note: always base" },
] as const;

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
  drumMapPreset: MidiDrumMapPreset;
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

export function normalizeMidiDrumMapPreset(value: unknown, fallback: MidiDrumMapPreset = DEFAULT_MIDI_DRUM_MAP_PRESET): MidiDrumMapPreset {
  return value === "gm-basic" || value === "chromatic-base" || value === "low-kit" || value === "cymbal-test" || value === "single-base" ? value : fallback;
}

export function midiDrumMapPresetLabel(value: unknown) {
  const preset = normalizeMidiDrumMapPreset(value);
  return MIDI_DRUM_MAP_PRESETS.find((entry) => entry.value === preset)?.label ?? "GM Basic";
}

export function midiDrumMapPresetSummary(value: unknown) {
  const preset = normalizeMidiDrumMapPreset(value);
  return MIDI_DRUM_MAP_PRESETS.find((entry) => entry.value === preset)?.summary ?? MIDI_DRUM_MAP_PRESETS[0].summary;
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

export type MidiMappedNote = {
  note: number;
  source: "melodic" | "drum-lane" | "fallback-base";
  laneIndex: number | null;
  laneRole: string | null;
  drumMapPreset?: MidiDrumMapPreset;
};

function positiveModulo(value: number, length: number) {
  return ((value % length) + length) % length;
}

export function midiDrumLaneIndexFromGridiEvent(event: GridiTriggerEvent) {
  if (event.kind !== "drum") return null;
  if (typeof event.laneIndex === "number" && Number.isFinite(event.laneIndex)) return Math.round(event.laneIndex);
  return event.lane === "low" || event.lane === "mid" || event.lane === "high" || event.lane === "accent"
    ? DRUM_LANE_INDEX_BY_ROLE[event.lane]
    : null;
}

export function midiDrumNoteFromLaneIndex(laneIndex: number | null, baseNote = DEFAULT_MIDI_BASE_NOTE, preset: MidiDrumMapPreset = DEFAULT_MIDI_DRUM_MAP_PRESET) {
  const base = clampMidiNoteNumber(baseNote);
  const normalizedPreset = normalizeMidiDrumMapPreset(preset);
  if (laneIndex === null) return base;
  const lane = Math.round(laneIndex);
  if (normalizedPreset === "chromatic-base") return clampMidiNoteNumber(base + lane);
  if (normalizedPreset === "single-base") return base;
  const map = normalizedPreset === "low-kit"
    ? LOW_DRUM_KIT_MAP
    : normalizedPreset === "cymbal-test"
      ? CYMBAL_HAT_TEST_MAP
      : DEFAULT_GM_BASIC_DRUM_MAP;
  return clampMidiNoteNumber(map[positiveModulo(lane, map.length)] ?? base);
}

export function midiDrumNoteFromGridiEvent(event: GridiTriggerEvent, baseNote = DEFAULT_MIDI_BASE_NOTE, preset: MidiDrumMapPreset = DEFAULT_MIDI_DRUM_MAP_PRESET) {
  const base = clampMidiNoteNumber(baseNote);
  if (event.kind !== "drum") return base;
  return midiDrumNoteFromLaneIndex(midiDrumLaneIndexFromGridiEvent(event), base, preset);
}

export function resolveMidiNoteFromGridiEvent(event: GridiTriggerEvent, baseNote = DEFAULT_MIDI_BASE_NOTE, mapMode: MidiMapMode = DEFAULT_MIDI_MAP_MODE, drumMapPreset: MidiDrumMapPreset = DEFAULT_MIDI_DRUM_MAP_PRESET): MidiMappedNote {
  const base = clampMidiNoteNumber(baseNote);
  if (mapMode === "drum") {
    const laneIndex = midiDrumLaneIndexFromGridiEvent(event);
    const laneRole = event.kind === "drum" && event.lane ? event.lane : null;
    return {
      note: midiDrumNoteFromLaneIndex(laneIndex, base, drumMapPreset),
      source: laneIndex === null ? "fallback-base" : "drum-lane",
      laneIndex,
      laneRole,
      drumMapPreset: normalizeMidiDrumMapPreset(drumMapPreset),
    };
  }
  if (event.kind === "note") {
    const offset = event.notes.find((note) => Number.isFinite(note)) ?? 0;
    return { note: clampMidiNoteNumber(base + Math.round(offset)), source: "melodic", laneIndex: null, laneRole: null };
  }
  return { note: base, source: "fallback-base", laneIndex: null, laneRole: event.kind === "drum" && event.lane ? event.lane : null };
}

export function midiNoteFromGridiEvent(event: GridiTriggerEvent, baseNote = DEFAULT_MIDI_BASE_NOTE, mapMode: MidiMapMode = DEFAULT_MIDI_MAP_MODE, drumMapPreset: MidiDrumMapPreset = DEFAULT_MIDI_DRUM_MAP_PRESET) {
  return resolveMidiNoteFromGridiEvent(event, baseNote, mapMode, drumMapPreset).note;
}


export function gridiEventFromPatternEventForMidiRoute(params: {
  patternEvent: PatternEvent;
  trigger: TriggerModule;
  timeSec: number;
  mapMode?: MidiMapMode;
}): GridiTriggerEvent {
  const mode = normalizeMidiMapMode(params.mapMode);
  if (mode === "drum") {
    return {
      kind: "drum",
      timeSec: params.timeSec,
      velocity: params.patternEvent.value,
      lane: normalizeDrumLane(laneRoleFromPatternEvent(params.patternEvent)),
      laneIndex: typeof params.patternEvent.targetLane === "number" && Number.isFinite(params.patternEvent.targetLane)
        ? Math.round(params.patternEvent.targetLane)
        : undefined,
    };
  }
  return {
    kind: "note",
    timeSec: params.timeSec,
    velocity: params.patternEvent.value,
    notes: noteOffsetsFromPatternEvent(params.patternEvent, params.trigger),
  };
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
        drumMapPreset: normalizeMidiDrumMapPreset(meta.midiDrumMapPreset),
      };
    });
}
