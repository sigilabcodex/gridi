export type AudioModuleLifecycle = {
  connect(destination: AudioNode): void;
  disconnect(): void;
  update(params: Record<string, unknown>): void;
  dispose(): void;
};

export type AudioModuleIO = {
  readonly id: string;
  readonly input: AudioNode;
  readonly output: AudioNode;
};

export type AudioModuleInstance = AudioModuleIO & AudioModuleLifecycle;
