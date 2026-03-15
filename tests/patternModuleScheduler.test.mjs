import assert from 'node:assert/strict';
import { createPatternModuleForVoice } from '../src/engine/pattern/module.ts';
import { createScheduler } from '../src/engine/scheduler.ts';

function makeVoice(overrides = {}) {
  return {
    id: 'voice-1',
    type: 'voice',
    name: 'TEST',
    enabled: true,
    kind: 'drum',
    mode: 'step',
    seed: 12345,
    determinism: 0.8,
    gravity: 0.6,
    density: 0.5,
    subdiv: 4,
    length: 16,
    drop: 0,
    amp: 0.12,
    timbre: 0.5,
    pan: 0,
    weird: 0.5,
    euclidRot: 0,
    caRule: 90,
    caInit: 0.25,
    ...overrides,
  };
}

function makePatch(voice) {
  return {
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [voice],
  };
}

(function testPatternModuleDeterministicWindow() {
  const voice = makeVoice({ seed: 777, length: 12, density: 0.4, subdiv: 2 });
  const module = createPatternModuleForVoice(voice);

  const request = {
    voice,
    voiceId: voice.id,
    source: { type: 'self' },
    startBeat: 1.25,
    endBeat: 4.25,
  };

  const a = module.renderWindow(request);
  const b = module.renderWindow(request);
  assert.deepEqual(a, b, 'PatternModule window rendering should be deterministic');
})();

(function testPatternModuleOverlapDedupe() {
  const voice = makeVoice({ seed: 901, length: 16, density: 1, subdiv: 4, drop: 0.5 });
  const module = createPatternModuleForVoice(voice);

  const windows = [
    module.renderWindow({ voice, voiceId: voice.id, source: { type: 'self' }, startBeat: 2.0, endBeat: 2.7 }),
    module.renderWindow({ voice, voiceId: voice.id, source: { type: 'self' }, startBeat: 2.3, endBeat: 3.0 }),
  ];

  const eps = 1e-9;
  let lastScheduledBeat = Number.NEGATIVE_INFINITY;
  const scheduled = [];

  for (const window of windows) {
    for (const ev of window.events) {
      const beat = window.startBeat + ev.beatOffset;
      if (beat <= lastScheduledBeat + eps) continue;
      scheduled.push(beat);
      lastScheduledBeat = beat;
    }
  }

  const reference = module.renderWindow({
    voice,
    voiceId: voice.id,
    source: { type: 'self' },
    startBeat: 2.0,
    endBeat: 3.0,
  });
  const expected = reference.events.map((ev) => reference.startBeat + ev.beatOffset);

  assert.deepEqual(scheduled, expected, 'overlap + scheduler dedupe should match one-pass render');
})();

(function testSchedulerParityForStepVoice() {
  const voice = makeVoice({ seed: 1, density: 1, drop: 0, subdiv: 4, length: 8 });
  const patch = makePatch(voice);

  const triggered = [];
  const engine = {
    ctx: { currentTime: 0 },
    triggerVoice: (_i, _patch, when) => {
      triggered.push(when);
    },
  };

  let intervalFn = null;
  globalThis.window = {
    setInterval: (fn) => {
      intervalFn = fn;
      return 1;
    },
    clearInterval: () => {},
  };

  const scheduler = createScheduler(engine);
  scheduler.setBpm(120);
  scheduler.setPatch(patch);
  scheduler.start();

  for (const t of [0, 0.025, 0.05, 0.075]) {
    engine.ctx.currentTime = t;
    intervalFn();
  }

  scheduler.stop();

  const secPerBeat = 60 / 120;
  const beats = triggered.map((t) => +(t / secPerBeat).toFixed(6));

  // lookahead windows overlap heavily; dedupe should keep one event per step beat.
  assert.deepEqual(beats, [0, 0.125, 0.25, 0.375], 'scheduler should preserve step scheduling semantics via PatternModule');

  const unique = new Set(beats);
  assert.equal(unique.size, beats.length, 'scheduler should not duplicate events across overlap windows');
})();

console.log('pattern module + scheduler tests passed');
