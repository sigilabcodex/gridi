import type { MidiInputStatus } from "../midiInput";
import type { MidiOutputStatus } from "../midiOutput";

const MIDI_CHIP_NAME_MAX = 18;

function compactMidiName(name: string | null | undefined, fallback: string) {
  const value = (name ?? "").trim() || fallback;
  return value.length > MIDI_CHIP_NAME_MAX ? `${value.slice(0, MIDI_CHIP_NAME_MAX - 1)}…` : value;
}

function midiInputChipPart(status: MidiInputStatus, targetLabel: string | null) {
  if (status.kind === "unsupported") return "In unsupported";
  if (status.kind === "pending") return "In pending";
  if (status.kind === "denied") return "In denied";
  if (status.kind === "idle") return "In unavailable";
  if (status.warning) return "In fallback";
  const input = compactMidiName(status.name, "input");
  const target = targetLabel ? ` → ${compactMidiName(targetLabel, "target")}` : "";
  return `In ${input}${target}`;
}

function midiOutputChipPart(status: MidiOutputStatus, sourceLabel: string | null) {
  if (!sourceLabel) return "Out off";
  if (status.kind === "unsupported") return "Out unsupported";
  if (status.kind === "pending") return "Out pending";
  if (status.kind === "denied") return "Out denied";
  if (status.kind === "idle") return "Out unavailable";
  return `Out ${compactMidiName(status.name, "output")}`;
}

export function formatMidiIoChipLabel(params: {
  inputStatus: MidiInputStatus;
  outputStatus: MidiOutputStatus;
  inputTargetLabel: string | null;
  outputSourceLabel: string | null;
}) {
  return `MIDI: ${midiInputChipPart(params.inputStatus, params.inputTargetLabel)} · ${midiOutputChipPart(params.outputStatus, params.outputSourceLabel)}`;
}

function midiLastSentText(lastSent: NonNullable<Extract<MidiOutputStatus, { kind: "sending" }>["lastSent"]>) {
  const lane = typeof lastSent.laneIndex === "number" ? ` · lane ${lastSent.laneIndex}` : lastSent.source === "fallback-base" ? " · fallback base" : "";
  return `Last: Ch ${lastSent.channel} Note ${lastSent.note}${lane} · Vel ${lastSent.velocity}`;
}

export function midiOutputCompactStatusText(status: MidiOutputStatus, sourceLabel: string | null) {
  const source = sourceLabel ? `GEN stream ${sourceLabel}` : "Source off";
  if (!sourceLabel) return `MIDI Out off · ${source}`;
  if (status.kind === "unsupported") return `MIDI Out unsupported · ${source}`;
  if (status.kind === "pending") return `MIDI Out permission needed · ${source}`;
  if (status.kind === "denied") return `MIDI Out denied · ${source}`;
  if (status.kind === "idle") return `${status.message} · ${source}`;
  if (status.kind === "sending") return `${midiLastSentText(status.lastSent)} → ${status.name} · ${source}`;
  const last = status.lastSent ? ` · ${midiLastSentText(status.lastSent)}` : "";
  const warning = status.warning ? `${status.warning} · ` : "";
  return `${warning}Output ${status.name} · ${source}${last}`;
}
