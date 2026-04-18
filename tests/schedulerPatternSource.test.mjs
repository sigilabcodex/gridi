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
