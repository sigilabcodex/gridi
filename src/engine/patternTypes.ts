import type { VoiceModule } from "../patch";

/**
 * PR-1 scaffolding type for immutable sequencing event windows.
 * Timebase is beat-relative offset inside a requested beat window.
 */
export type EventWindowEvent = {
  readonly voiceId: string;
  readonly beatOffset: number;
  readonly velocity?: number;
  readonly eventId?: string;
};

export type EventWindow = {
  readonly startBeat: number;
  readonly endBeat: number;
  readonly events: readonly EventWindowEvent[];
};

export type PatternRenderContext = {
  readonly bpm: number;
  readonly voiceId: string;
  readonly voice: VoiceModule;
};

/**
 * Pilot contract (PR-1): implemented in PR-2 for step mode only.
 * No runtime usage introduced in PR-1.
 */
export type PatternModule = {
  setParams(nextParams: VoiceModule, effectiveAtStep: number): void;
  renderWindow(startBeat: number, endBeat: number, ctx: PatternRenderContext): EventWindow;
};
