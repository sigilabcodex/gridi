import { clamp } from "../patch.ts";

export const DRUM_PITCH_SAFE_RANGE_SEMITONES = 7;
const DRUM_PITCH_MIN_MIDI = 24;
const DRUM_PITCH_MAX_MIDI = 84;

export function isTypedDrumPitchSourceSelected(typedSourceId: string | null, effectiveRuntimeSourceId: string | null) {
  return !!typedSourceId && effectiveRuntimeSourceId === typedSourceId;
}

export function drumPitchModulationSemitones(basePitch: number, controlValue: number) {
  const baseMidi = DRUM_PITCH_MIN_MIDI + clamp(basePitch, 0, 1) * (DRUM_PITCH_MAX_MIDI - DRUM_PITCH_MIN_MIDI);
  const offset = (clamp(controlValue, 0, 1) - 0.5) * DRUM_PITCH_SAFE_RANGE_SEMITONES * 2;
  return clamp(offset, DRUM_PITCH_MIN_MIDI - baseMidi, DRUM_PITCH_MAX_MIDI - baseMidi);
}

export function modulatedDrumBaseFrequency(
  basePitch: number,
  extraHz: number,
  controlValue: number | null,
  typedSourceSelected: boolean,
) {
  const normalizedBase = clamp(basePitch, 0, 1);
  const baseline = 45 + normalizedBase * 180 + extraHz;
  if (controlValue == null) return baseline;

  if (typedSourceSelected) {
    const semitones = drumPitchModulationSemitones(normalizedBase, controlValue);
    return baseline * Math.pow(2, semitones / 12);
  }

  // Keep the historic legacy-map curve byte-for-byte equivalent in behavior.
  const legacyPitch = clamp(normalizedBase + (clamp(controlValue, 0, 1) - 0.5) * 0.9, 0, 1);
  return 45 + legacyPitch * 180 + extraHz;
}
