import type { Mode, VoiceModule } from "../../patch";
import { renderLegacyVoicePattern } from "./legacyPatternRenderer";
import { genStepPattern } from "./stepPatternModule";

export type PatternSourceRef =
  | { readonly type: "self" }
  | { readonly type: "module"; readonly moduleId: string };

export type PatternEvent = {
  readonly voiceId: string;
  readonly beatOffset: number;
  readonly velocity?: number;
  readonly eventId?: string;
};

export type PatternEventWindow = {
  readonly startBeat: number;
  readonly endBeat: number;
  readonly events: readonly PatternEvent[];
};

export type PatternRenderRequest = {
  readonly voiceId: string;
  readonly voice: VoiceModule;
  readonly source: PatternSourceRef;
  readonly startBeat: number;
  readonly endBeat: number;
};

export type PatternModule = {
  readonly id: string;
  readonly kind: string;
  renderWindow(request: PatternRenderRequest): PatternEventWindow;
};

const EPS = 1e-9;

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

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function toStepWindowEvents(params: {
  pattern: Uint8Array;
  voice: VoiceModule;
  voiceId: string;
  startBeat: number;
  endBeat: number;
  droppedStep?: (step: number) => boolean;
}): PatternEventWindow {
  const { pattern, voice, voiceId, startBeat, endBeat, droppedStep } = params;
  const subdiv = Math.max(1, voice.subdiv | 0);
  const stepsPerBeat = 2 * subdiv;
  const firstStep = Math.ceil(startBeat * stepsPerBeat - EPS);
  const events: PatternEvent[] = [];

  for (let step = firstStep; ; step++) {
    const beat = step / stepsPerBeat;
    if (beat >= endBeat - EPS) break;
    if (beat < startBeat - EPS) continue;

    const idx = pattern.length > 0 ? ((step % pattern.length) + pattern.length) % pattern.length : 0;
    if (pattern[idx] !== 1) continue;
    if (droppedStep?.(step)) continue;

    events.push({
      voiceId,
      beatOffset: beat - startBeat,
    });
  }

  return {
    startBeat,
    endBeat,
    events,
  };
}

export function createStepPatternModule(): PatternModule {
  return {
    id: "pattern:self:step",
    kind: "step",
    renderWindow(request) {
      const pattern = genStepPattern(request.voice);
      const drop = clamp01(request.voice.drop);

      return toStepWindowEvents({
        pattern,
        voice: request.voice,
        voiceId: request.voiceId,
        startBeat: request.startBeat,
        endBeat: request.endBeat,
        droppedStep: (step) => drop > 0 && stepRandom01(request.voice.seed, request.voiceId, step) < drop,
      });
    },
  };
}

export function createLegacyGridPatternModule(mode: Exclude<Mode, "step">): PatternModule {
  return {
    id: `pattern:self:${mode}`,
    kind: `legacy-${mode}`,
    renderWindow(request) {
      const pattern = renderLegacyVoicePattern(request.voice);
      return toStepWindowEvents({
        pattern,
        voice: request.voice,
        voiceId: request.voiceId,
        startBeat: request.startBeat,
        endBeat: request.endBeat,
      });
    },
  };
}

export function createPatternModuleForVoice(voice: VoiceModule): PatternModule {
  if (voice.mode === "step") return createStepPatternModule();
  return createLegacyGridPatternModule(voice.mode);
}
