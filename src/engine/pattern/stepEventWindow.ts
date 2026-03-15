import type { VoiceModule } from "../../patch";
import { createStepPatternModule } from "./module";
import type { EventWindow } from "./eventWindow";

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
