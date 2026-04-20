import type { ModuleType } from "../patch";

export type TargetParameter = { key: string; label: string };
export type TargetParameterGroup = {
  key: string;
  label: string;
  parameters: TargetParameter[];
};

const GROUPS_BY_TYPE: Record<"trigger" | "drum" | "tonal", TargetParameterGroup[]> = {
  trigger: [
    {
      key: "rhythm",
      label: "Rhythm",
      parameters: [
        { key: "density", label: "Density" },
        { key: "length", label: "Length" },
        { key: "subdiv", label: "Subdivision" },
        { key: "drop", label: "Drop" },
      ],
    },
    {
      key: "feel",
      label: "Feel",
      parameters: [
        { key: "determinism", label: "Determinism" },
        { key: "gravity", label: "Gravity" },
        { key: "weird", label: "Variation" },
        { key: "accent", label: "Accent" },
      ],
    },
    {
      key: "pattern",
      label: "Pattern",
      parameters: [
        { key: "euclidRot", label: "Euclid rotate" },
        { key: "caRule", label: "CA rule" },
        { key: "caInit", label: "CA init" },
      ],
    },
  ],
  drum: [
    {
      key: "envelope",
      label: "Envelope",
      parameters: [
        { key: "attack", label: "Attack" },
        { key: "decay", label: "Decay" },
        { key: "amp", label: "Level" },
      ],
    },
    {
      key: "tone",
      label: "Tone",
      parameters: [
        { key: "basePitch", label: "Pitch" },
        { key: "tone", label: "Tone" },
        { key: "bodyTone", label: "Body tone" },
        { key: "noise", label: "Noise" },
        { key: "snap", label: "Snap" },
        { key: "pitchEnvAmt", label: "Bend" },
      ],
    },
    {
      key: "spatial",
      label: "Spatial",
      parameters: [
        { key: "pan", label: "Pan" },
        { key: "stereoWidth", label: "Width" },
        { key: "panBias", label: "Pan bias" },
      ],
    },
    {
      key: "dynamics",
      label: "Dynamics",
      parameters: [
        { key: "comp", label: "Comp" },
        { key: "compThreshold", label: "Threshold" },
        { key: "compRatio", label: "Ratio" },
        { key: "boost", label: "Boost" },
      ],
    },
  ],
  tonal: [
    {
      key: "envelope",
      label: "Envelope",
      parameters: [
        { key: "attack", label: "Attack" },
        { key: "decay", label: "Decay" },
        { key: "sustain", label: "Sustain" },
        { key: "release", label: "Release" },
        { key: "amp", label: "Level" },
      ],
    },
    {
      key: "tone",
      label: "Tone",
      parameters: [
        { key: "cutoff", label: "Cutoff" },
        { key: "resonance", label: "Resonance" },
        { key: "waveform", label: "Wave" },
        { key: "modDepth", label: "Drive" },
        { key: "modRate", label: "FM" },
      ],
    },
    {
      key: "pitch",
      label: "Pitch",
      parameters: [
        { key: "coarseTune", label: "Coarse" },
        { key: "fineTune", label: "Fine" },
        { key: "glide", label: "Glide" },
      ],
    },
    {
      key: "spatial",
      label: "Spatial",
      parameters: [{ key: "pan", label: "Pan" }],
    },
  ],
};

export function getControllableFamilies(): ModuleType[] {
  return ["drum", "tonal", "trigger"];
}

export function getTargetParameterGroups(moduleType: ModuleType): TargetParameterGroup[] {
  if (moduleType === "drum" || moduleType === "tonal" || moduleType === "trigger") {
    return GROUPS_BY_TYPE[moduleType];
  }
  return [];
}
