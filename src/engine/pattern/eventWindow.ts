export type EventWindowEvent = {
  beatOffset: number;
  voiceId: string;
  voiceIndex: number;
  velocity?: number;
};

export type EventWindow = {
  startBeat: number;
  endBeat: number;
  events: readonly EventWindowEvent[];
};
