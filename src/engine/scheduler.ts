import type { Patch } from "../patch";
import type { Engine } from "./audio";

export type Scheduler = {
  running: boolean;
  start(patch: Patch): void;
  stop(): void;
  setBpm(bpm: number): void;
};

export function createScheduler(engine: Engine): Scheduler {
  let running = false;
  let bpm = 120;
  let timer: number | null = null;
  let step = 0;

  function tick(patch: Patch) {
    // prueba: dispara una voz distinta cada step
    const i = step % patch.voices.length;
    engine.triggerVoice(i, patch);
    step++;

    const intervalMs = (60_000 / bpm) / 4; // 16ths
    timer = window.setTimeout(() => tick(patch), intervalMs);
  }

  function start(patch: Patch) {
    if (running) return;
    running = true;
    step = 0;
    tick(patch);
  }

  function stop() {
    running = false;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function setBpm(x: number) {
    bpm = x;
  }

  return { running, start, stop, setBpm };
}

