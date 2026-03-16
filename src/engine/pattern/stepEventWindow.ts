import type { TriggerModule } from "../../patch.ts";
import { createPatternModuleForTrigger } from "./module.ts";
import type { EventWindow } from "./eventWindow.ts";

type StepWindowRenderParams = {
  trigger: TriggerModule;
  voiceId: string;
  startBeat: number;
  endBeat: number;
};

export function renderStepWindow(params: StepWindowRenderParams): EventWindow {
  const { trigger, voiceId, startBeat, endBeat } = params;
  return createPatternModuleForTrigger(trigger).renderWindow({
    voiceId,
    trigger,
    startBeat,
    endBeat,
  });
}
