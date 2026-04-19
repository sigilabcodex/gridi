import assert from 'node:assert/strict';
import test from 'node:test';
import { createPatternModuleForTrigger } from '../src/engine/pattern/module.ts';
import { createScheduler } from '../src/engine/scheduler.ts';
import { makePatch, makeSound, makeTrigger } from './helpers.mjs';

function withWindowTimer(fn) {
  const prevWindow = globalThis.window;
  let intervalFn = null;
  globalThis.window = { setInterval: (cb) => (intervalFn = cb, 1), clearInterval: () => {} };
  try { return fn(() => intervalFn && intervalFn()); } finally { globalThis.window = prevWindow; }
}

test('scheduler dedupes overlaps for linked trigger/sound pair', () => {
  const trigger = makeTrigger({ id: 'trg-1', seed: 1, density: 1, drop: 0, subdiv: 4, length: 8, mode: 'step' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([sound, trigger]);
  const triggered = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (_id, _patch, when) => triggered.push(when) };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of [0, 0.025, 0.05, 0.075]) { engine.ctx.currentTime = t; tick(); }
    scheduler.stop();
  });

  const secPerBeat = 60 / 120;
  const beats = triggered.map((t) => +(t / secPerBeat).toFixed(6));
  const expected = createPatternModuleForTrigger(trigger)
    .renderWindow({ trigger, voiceId: sound.id, startBeat: 0, endBeat: 0.48 })
    .events.map((ev) => +ev.beatOffset.toFixed(6));
  assert.deepEqual(beats, expected);
});

test('assigned trigger drives linked sound deterministically', () => {
  const trigger = makeTrigger({ id: 'source-trigger', mode: 'euclid', length: 16, density: 0.25, drop: 0, seed: 7 });
  const sound = makeSound({ id: 'follower', triggerSource: trigger.id });
  const patch = makePatch([sound, trigger]);
  const triggered = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (id, _patch, when) => triggered.push({ id, when }) };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of [0, 0.025, 0.05, 0.075]) { engine.ctx.currentTime = t; tick(); }
    scheduler.stop();
  });

  const secPerBeat = 60 / 120;
  const beats = triggered.filter((x) => x.id === sound.id).map((x) => +(x.when / secPerBeat).toFixed(6));
  const expected = createPatternModuleForTrigger(trigger)
    .renderWindow({ trigger, voiceId: sound.id, startBeat: 0, endBeat: 0.48 })
    .events.map((ev) => +ev.beatOffset.toFixed(6));

  assert.deepEqual(beats, expected);
});

test('missing trigger assignment is a safe no-op', () => {
  const sound = makeSound({ id: 'missing-trigger', triggerSource: 'nope' });
  const patch = makePatch([sound]);
  const triggered = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (_id, _patch, when) => triggered.push(when) };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    engine.ctx.currentTime = 0;
    tick();
    scheduler.stop();
  });

  assert.deepEqual(triggered, []);
});

test('scheduler resolves trigger from canonical event routes when triggerSource is absent', () => {
  const trigger = makeTrigger({ id: 'route-trigger', seed: 11, density: 0.6, drop: 0, mode: 'euclid' });
  const sound = makeSound({ id: 'route-sound', triggerSource: null });
  const patch = makePatch([sound, trigger]);
  patch.routes = [
    {
      id: 'evt-route',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
  ];

  const triggered = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (id, _patch, when) => triggered.push({ id, when }) };
  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of [0, 0.025, 0.05, 0.075]) { engine.ctx.currentTime = t; tick(); }
    scheduler.stop();
  });

  assert.ok(triggered.some((ev) => ev.id === sound.id));
});

test('multi-drum lane dispatch differentiates trigger flow by inferred drum role', () => {
  const trigger = makeTrigger({ id: 'lane-trigger', mode: 'step', length: 16, density: 1, drop: 0, seed: 9 });
  const lowDrum = makeSound({ id: 'drm-low', triggerSource: trigger.id, basePitch: 0.2 });
  const highDrum = makeSound({ id: 'drm-high', triggerSource: trigger.id, basePitch: 0.75 });
  const patch = makePatch([lowDrum, highDrum, trigger]);
  const triggered = [];
  const engine = {
    ctx: { currentTime: 0 },
    triggerVoice: (id, _patch, when, event) => triggered.push({ id, when, lane: event?.lane }),
  };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of [0, 0.025, 0.05, 0.075]) { engine.ctx.currentTime = t; tick(); }
    scheduler.stop();
  });

  const lowHits = triggered.filter((ev) => ev.id === lowDrum.id);
  const highHits = triggered.filter((ev) => ev.id === highDrum.id);
  assert.ok(lowHits.length > 0);
  assert.ok(highHits.length > 0);
  assert.ok(lowHits.every((ev) => ev.lane === 'low'));
  assert.ok(highHits.every((ev) => ev.lane === 'high'));
});

test('lane dispatch remains deterministic for the same patch', () => {
  const trigger = makeTrigger({ id: 'det-trigger', mode: 'euclid', length: 16, density: 0.8, drop: 0, seed: 5 });
  const lowDrum = makeSound({ id: 'det-low', triggerSource: trigger.id, basePitch: 0.18 });
  const midDrum = makeSound({ id: 'det-mid', triggerSource: trigger.id, basePitch: 0.45 });
  const highDrum = makeSound({ id: 'det-high', triggerSource: trigger.id, basePitch: 0.7 });
  const patch = makePatch([lowDrum, midDrum, highDrum, trigger]);

  function runPass() {
    const triggered = [];
    const engine = {
      ctx: { currentTime: 0 },
      triggerVoice: (id, _patch, when, event) => triggered.push({
        id,
        beat: +((when / (60 / 120)).toFixed(6)),
        lane: event?.lane,
      }),
    };
    withWindowTimer((tick) => {
      const scheduler = createScheduler(engine);
      scheduler.setBpm(120);
      scheduler.setPatch(patch);
      scheduler.start();
      for (const t of [0, 0.025, 0.05, 0.075]) { engine.ctx.currentTime = t; tick(); }
      scheduler.stop();
    });
    return triggered;
  }

  const passA = runPass();
  const passB = runPass();
  assert.deepEqual(passA, passB);
});

test('explicit drum channel override replaces inferred lane dispatch', () => {
  const trigger = makeTrigger({ id: 'manual-trigger', mode: 'step', length: 16, density: 1, drop: 0, seed: 3 });
  const manualLow = makeSound({ id: 'manual-low', triggerSource: trigger.id, basePitch: 0.82, drumChannel: '01' });
  const manualHigh = makeSound({ id: 'manual-high', triggerSource: trigger.id, basePitch: 0.18, drumChannel: '03' });
  const patch = makePatch([manualLow, manualHigh, trigger]);
  const triggered = [];
  const engine = {
    ctx: { currentTime: 0 },
    triggerVoice: (id, _patch, when, event) => triggered.push({ id, when, lane: event?.lane }),
  };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of [0, 0.025, 0.05, 0.075]) { engine.ctx.currentTime = t; tick(); }
    scheduler.stop();
  });

  const lowHits = triggered.filter((ev) => ev.id === manualLow.id);
  const highHits = triggered.filter((ev) => ev.id === manualHigh.id);
  assert.ok(lowHits.length > 0);
  assert.ok(highHits.length > 0);
  assert.ok(lowHits.every((ev) => ev.lane === 'low'));
  assert.ok(highHits.every((ev) => ev.lane === 'high'));
});

test('multiple drums can intentionally share the same explicit channel', () => {
  const trigger = makeTrigger({ id: 'shared-trigger', mode: 'step', length: 16, density: 1, drop: 0, seed: 13 });
  const first = makeSound({ id: 'shared-a', triggerSource: trigger.id, basePitch: 0.2, drumChannel: '02' });
  const second = makeSound({ id: 'shared-b', triggerSource: trigger.id, basePitch: 0.9, drumChannel: '02' });
  const patch = makePatch([first, second, trigger]);
  const triggered = [];
  const engine = {
    ctx: { currentTime: 0 },
    triggerVoice: (id, _patch, when, event) => triggered.push({ id, when, lane: event?.lane }),
  };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of [0, 0.025, 0.05, 0.075]) { engine.ctx.currentTime = t; tick(); }
    scheduler.stop();
  });

  const aHits = triggered.filter((ev) => ev.id === first.id);
  const bHits = triggered.filter((ev) => ev.id === second.id);
  assert.ok(aHits.length > 0);
  assert.ok(bHits.length > 0);
  assert.ok(aHits.every((ev) => ev.lane === 'mid'));
  assert.ok(bHits.every((ev) => ev.lane === 'mid'));
});
