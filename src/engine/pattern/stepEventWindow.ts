import type { VoiceModule } from "../../patch";
import { genStepPattern } from "./stepPatternModule.ts";
import type { EventWindow } from "./eventWindow.ts";

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
  const eps = 1e-9;

  const firstStep = Math.ceil(startBeat * stepsPerBeat - eps);
  const events: Array<{ beatOffset: number; voiceId: string; voiceIndex: number }> = [];

  for (let step = firstStep; ; step++) {
    const beat = step / stepsPerBeat;
    if (beat >= endBeat - eps) break;
    if (beat < startBeat - eps) continue;

    const idx = pattern.length > 0 ? ((step % pattern.length) + pattern.length) % pattern.length : 0;
    if (!pattern[idx]) continue;

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
