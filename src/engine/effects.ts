import type { EffectModule } from "../patch";
import { clamp } from "../patch";
import type { AudioModuleInstance } from "./audioModule";

class GainEffectModule implements AudioModuleInstance {
  readonly id: string;
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly ctx: AudioContext;

  constructor(ctx: AudioContext, module: EffectModule) {
    this.ctx = ctx;
    this.id = module.id;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.input.connect(this.output);
    this.update(module);
  }

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }

  update(params: Record<string, unknown>) {
    const bypass = params.bypass === true;
    const gain = clamp(typeof params.gain === "number" ? params.gain : 1, 0, 2);
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(bypass ? 1 : gain, now, 0.01);
  }

  dispose() {
    this.input.disconnect();
    this.output.disconnect();
  }
}

export function createEffectInstance(ctx: AudioContext, module: EffectModule): AudioModuleInstance {
  switch (module.kind) {
    case "gain":
    default:
      return new GainEffectModule(ctx, module);
  }
}
