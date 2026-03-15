import type { VoiceModule } from "../../patch.ts";
import { createStepPatternModule } from "./module.ts";
import type { EventWindow } from "./eventWindow.ts";

type StepWindowRenderParams = {
  voice: VoiceModule;
  voiceId: string;
  voiceIndex: number;
  startBeat: number;
  endBeat: number;
};

const stepModule = createStepPatternModule();

export function renderStepWindow(params: StepWindowRenderParams): EventWindow {
  const { voice, voiceId, startBeat, endBeat } = params;
  return stepModule.renderWindow({
    voice,
    voiceId,
    source: { type: "self" },
    startBeat,
    endBeat,
  });
}
