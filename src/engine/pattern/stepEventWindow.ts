import type { VoiceModule } from "../../patch";
import { genStepPattern } from "./stepPatternModule.ts";
import type { EventWindow } from "./eventWindow.ts";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return h | 0;
}

function stepRandom01(seed: number, voiceId: string, stepIndex: number) {
  let x = (seed | 0) ^ hashString(voiceId) ^ Math.imul(stepIndex | 0, 0x9e3779b1);
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

export function renderStepWindow(params: {
  voice: VoiceModule;
  voiceId: string;
  voiceIndex: number;
  startBeat: number;
  endBeat: number;
}): EventWindow {
  const { voice, voiceId, voiceIndex, startBeat, endBeat } = params;
  const pattern = genStepPattern(voice);
  const stepsPerBeat = 2 * voice.subdiv;
  const drop = clamp01(voice.drop);
  const eps = 1e-9;

  const firstStep = Math.ceil(startBeat * stepsPerBeat - eps);
  const events: Array<{ beatOffset: number; voiceId: string; voiceIndex: number }> = [];

  for (let step = firstStep; ; step++) {
    const beat = step / stepsPerBeat;
    if (beat >= endBeat - eps) break;
    if (beat < startBeat - eps) continue;

    const idx = pattern.length > 0 ? ((step % pattern.length) + pattern.length) % pattern.length : 0;
    if (!pattern[idx]) continue;
    if (drop > 0 && stepRandom01(voice.seed, voiceId, step) < drop) continue;

    events.push({
      beatOffset: beat - startBeat,
      voiceId,
      voiceIndex,
    });
  }

  return {
    startBeat,
    endBeat,
    events,
  };
}
