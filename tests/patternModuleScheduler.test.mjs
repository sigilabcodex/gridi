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
    patternSource: 'self',
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
    buses: [],
    connections: [],
  };
}

function absoluteBeats(window) {
  return window.events.map((ev) => window.startBeat + ev.beatOffset);
}

(function testPatternModuleDeterminismPerEngine() {
  const modes = ['step', 'euclid', 'ca', 'hybrid', 'fractal'];

  for (const mode of modes) {
    const voice = makeVoice({ mode, seed: 777, length: 12, density: 0.4, subdiv: 2, drop: 0.23, euclidRot: 3, caRule: 110 });
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
    assert.deepEqual(a, b, `mode ${mode}: window rendering should be deterministic`);
  }
})();

(function testPatternModuleOverlapDedupePerEngine() {
  const modes = ['step', 'euclid', 'ca', 'hybrid', 'fractal'];

  for (const mode of modes) {
    const voice = makeVoice({ mode, seed: 901, length: 16, density: 0.8, subdiv: 4, drop: 0.5, weird: 0.65, caInit: 0.4 });
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

    assert.deepEqual(scheduled, absoluteBeats(reference), `mode ${mode}: overlap + scheduler dedupe should match one-pass render`);

    const unique = new Set(scheduled.map((b) => b.toFixed(9)));
    assert.equal(unique.size, scheduled.length, `mode ${mode}: deduped schedule should contain no duplicates`);
  }
})();

(function testEventOrderingAndBoundsPerEngine() {
  const modes = ['step', 'euclid', 'ca', 'hybrid', 'fractal'];

  for (const mode of modes) {
    const voice = makeVoice({ mode, seed: 333, length: 24, density: 0.5, subdiv: 4, drop: 0.2, euclidRot: 2 });
    const module = createPatternModuleForVoice(voice);

    const window = module.renderWindow({
      voice,
      voiceId: voice.id,
      source: { type: 'self' },
      startBeat: 0.8,
      endBeat: 3.9,
    });

    const beats = absoluteBeats(window);
    for (let i = 0; i < beats.length; i++) {
      assert.ok(beats[i] >= window.startBeat - 1e-9, `mode ${mode}: beat should be >= start`);
      assert.ok(beats[i] < window.endBeat + 1e-9, `mode ${mode}: beat should be < end`);
      if (i > 0) assert.ok(beats[i] > beats[i - 1] - 1e-9, `mode ${mode}: events should be ordered`);
    }
  }
})();

(function testModeSemantics() {
  const euclidA = makeVoice({ mode: 'euclid', length: 16, density: 0.25, euclidRot: 0, drop: 0, weird: 0, determinism: 1, gravity: 0.5 });
  const euclidB = makeVoice({ ...euclidA, euclidRot: 4 });

  const eA = createPatternModuleForVoice(euclidA).renderWindow({
    voice: euclidA,
    voiceId: euclidA.id,
    source: { type: 'self' },
    startBeat: 0,
    endBeat: 2,
  });
  const eB = createPatternModuleForVoice(euclidB).renderWindow({
    voice: euclidB,
    voiceId: euclidB.id,
    source: { type: 'self' },
    startBeat: 0,
    endBeat: 2,
  });
  assert.notDeepEqual(absoluteBeats(eA), absoluteBeats(eB), 'euclid rotation should phase-shift event placement');

  const caOff = makeVoice({ mode: 'ca', length: 16, density: 1, caRule: 0, caInit: 0.7, drop: 0 });
  const caOn = makeVoice({ mode: 'ca', length: 16, density: 1, caRule: 255, caInit: 0.7, drop: 0 });
  const caOffEvents = createPatternModuleForVoice(caOff).renderWindow({ voice: caOff, voiceId: caOff.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 }).events;
  const caOnEvents = createPatternModuleForVoice(caOn).renderWindow({ voice: caOn, voiceId: caOn.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 }).events;
  assert.equal(caOffEvents.length, 0, 'CA rule 0 should decay to silence');
  assert.ok(caOnEvents.length > 0, 'CA rule 255 should produce activity');

  const hybrid = makeVoice({ mode: 'hybrid', length: 16, density: 0.4, drop: 0, seed: 999, weird: 0.7 });
  const euclid = makeVoice({ ...hybrid, mode: 'euclid' });
  const step = makeVoice({ ...hybrid, mode: 'step' });
  const hBeats = absoluteBeats(createPatternModuleForVoice(hybrid).renderWindow({ voice: hybrid, voiceId: hybrid.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 }));
  const eBeats = absoluteBeats(createPatternModuleForVoice(euclid).renderWindow({ voice: euclid, voiceId: euclid.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 }));
  const sBeats = absoluteBeats(createPatternModuleForVoice(step).renderWindow({ voice: step, voiceId: step.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 }));
  assert.notDeepEqual(hBeats, eBeats, 'hybrid should not collapse to euclid');
  assert.notDeepEqual(hBeats, sBeats, 'hybrid should not collapse to step');

  const fractal = makeVoice({ mode: 'fractal', length: 32, density: 0.5, drop: 0, seed: 8181, weird: 0.4, gravity: 0.2 });
  const fractalWindow = createPatternModuleForVoice(fractal).renderWindow({
    voice: fractal,
    voiceId: fractal.id,
    source: { type: 'self' },
    startBeat: 0,
    endBeat: 4,
  });
  assert.ok(fractalWindow.events.length > 0, 'fractal/proto should create coherent non-empty motifs at medium density');
})();

(function testSchedulerParityForStepVoice() {
  const voice = makeVoice({ seed: 1, density: 1, drop: 0, subdiv: 4, length: 8, mode: 'step' });
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

(function testSchedulerUsesExternalPatternSourceDeterministically() {
  const source = makeVoice({ id: 'source-voice', mode: 'euclid', length: 16, density: 0.25, drop: 0, seed: 7, patternSource: 'self' });
  const follower = makeVoice({ id: 'follower-voice', mode: 'step', seed: 123, density: 1, drop: 0, patternSource: source.id });

  const patch = {
    ...makePatch(follower),
    modules: [follower, source],
    buses: [],
    connections: [],
  };

  const triggered = [];
  const engine = {
    ctx: { currentTime: 0 },
    triggerVoice: (i, _patch, when) => {
      triggered.push({ i, when });
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
  const beats = triggered.filter((x) => x.i === 0).map((x) => +(x.when / secPerBeat).toFixed(6));

  const expected = createPatternModuleForVoice(source).renderWindow({
    voice: source,
    voiceId: follower.id,
    source: { type: 'module', moduleId: source.id },
    startBeat: 0,
    endBeat: 0.48,
  }).events.map((ev) => +ev.beatOffset.toFixed(6));

  assert.deepEqual(beats, expected, 'follower voice should schedule using external source pattern deterministically');
})();

(function testSchedulerFallsBackToSelfForMissingSource() {
  const voice = makeVoice({ id: 'lonely-voice', mode: 'step', patternSource: 'missing-source', density: 1, drop: 0, subdiv: 4, length: 8 });
  const patch = makePatch(voice);

  const triggered = [];
  const engine = {
    ctx: { currentTime: 0 },
    triggerVoice: (_i, _patch, when) => triggered.push(when),
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
  engine.ctx.currentTime = 0;
  intervalFn();
  scheduler.stop();

  const secPerBeat = 60 / 120;
  const beats = triggered.map((t) => +(t / secPerBeat).toFixed(6));
  assert.deepEqual(beats, [0], 'missing external source should gracefully fall back to self pattern');
})();

console.log('pattern module + scheduler tests passed');
