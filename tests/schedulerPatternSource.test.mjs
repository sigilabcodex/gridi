import assert from 'node:assert/strict';
import test from 'node:test';
import { createPatternModuleForVoice } from '../src/engine/pattern/module.ts';
import { createScheduler } from '../src/engine/scheduler.ts';
import { makePatch, makeVoice } from './helpers.mjs';

function withWindowTimer(fn) {
  const prevWindow = globalThis.window;
  let intervalFn = null;
  globalThis.window = {
    setInterval: (callback) => {
      intervalFn = callback;
      return 1;
    },
    clearInterval: () => {},
  };

  try {
    return fn(() => intervalFn && intervalFn());
  } finally {
    globalThis.window = prevWindow;
  }
}

test('scheduler overlap dedupe keeps one event per beat for step voice', () => {
  const voice = makeVoice({ seed: 1, density: 1, drop: 0, subdiv: 4, length: 8, mode: 'step' });
  const patch = makePatch([voice]);
  const triggered = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (_i, _patch, when) => triggered.push(when) };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();

    for (const t of [0, 0.025, 0.05, 0.075]) {
      engine.ctx.currentTime = t;
      tick();
    }
    scheduler.stop();
  });

  const secPerBeat = 60 / 120;
  const beats = triggered.map((t) => +(t / secPerBeat).toFixed(6));
  assert.deepEqual(beats, [0, 0.125, 0.25, 0.375]);
  assert.equal(new Set(beats).size, beats.length);
});

test('external pattern source is used deterministically by follower voice', () => {
  const source = makeVoice({ id: 'source-voice', mode: 'euclid', length: 16, density: 0.25, drop: 0, seed: 7, patternSource: 'self' });
  const follower = makeVoice({ id: 'follower-voice', mode: 'step', density: 1, drop: 0, patternSource: source.id });
  const patch = makePatch([follower, source]);
  const triggered = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (i, _patch, when) => triggered.push({ i, when }) };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();

    for (const t of [0, 0.025, 0.05, 0.075]) {
      engine.ctx.currentTime = t;
      tick();
    }
    scheduler.stop();
  });

  const secPerBeat = 60 / 120;
  const beats = triggered.filter((x) => x.i === 0).map((x) => +(x.when / secPerBeat).toFixed(6));
  const expected = createPatternModuleForVoice(source)
    .renderWindow({ voice: source, voiceId: follower.id, source: { type: 'module', moduleId: source.id }, startBeat: 0, endBeat: 0.48 })
    .events.map((ev) => +ev.beatOffset.toFixed(6));

  assert.deepEqual(beats, expected);
});

test('missing or self-id pattern source falls back to self safely', () => {
  const candidates = [
    makeVoice({ id: 'missing-fallback', mode: 'step', patternSource: 'nope', density: 1, drop: 0, subdiv: 4, length: 8 }),
    makeVoice({ id: 'same-id-fallback', mode: 'step', patternSource: 'same-id-fallback', density: 1, drop: 0, subdiv: 4, length: 8 }),
  ];

  for (const voice of candidates) {
    const patch = makePatch([voice]);
    const triggered = [];
    const engine = { ctx: { currentTime: 0 }, triggerVoice: (_i, _patch, when) => triggered.push(when) };

    withWindowTimer((tick) => {
      const scheduler = createScheduler(engine);
      scheduler.setBpm(120);
      scheduler.setPatch(patch);
      scheduler.start();
      engine.ctx.currentTime = 0;
      tick();
      scheduler.stop();
    });

    const secPerBeat = 60 / 120;
    const actual = triggered.map((t) => +(t / secPerBeat).toFixed(6));
    const expected = createPatternModuleForVoice(voice)
      .renderWindow({ voice, voiceId: voice.id, source: { type: 'self' }, startBeat: 0, endBeat: 0.24 })
      .events.map((ev) => +ev.beatOffset.toFixed(6));
    assert.deepEqual(actual, expected);
  }
});
