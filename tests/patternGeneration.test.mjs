import assert from 'node:assert/strict';
import test from 'node:test';
import { createPatternModuleForVoice } from '../src/engine/pattern/module.ts';
import { genStepPattern } from '../src/engine/pattern/stepPatternModule.ts';
import { absoluteBeats, makeVoice } from './helpers.mjs';

test('step pattern is deterministic for same input', () => {
  const voice = makeVoice({ seed: 777, length: 12, density: 0.4, subdiv: 2 });
  assert.deepEqual(Array.from(genStepPattern(voice)), Array.from(genStepPattern(voice)));
});

test('pattern module rendering is deterministic across all engines', () => {
  const modes = ['step', 'euclid', 'ca', 'hybrid', 'fractal'];
  for (const mode of modes) {
    const voice = makeVoice({ mode, seed: 901, length: 16, density: 0.7, drop: 0.3, weird: 0.65, caRule: 110 });
    const module = createPatternModuleForVoice(voice);
    const request = { voice, voiceId: voice.id, source: { type: 'self' }, startBeat: 1.25, endBeat: 4.25 };
    assert.deepEqual(module.renderWindow(request), module.renderWindow(request));
  }
});

test('engine-specific behavior invariants hold', () => {
  const euclidA = makeVoice({ mode: 'euclid', length: 15, density: 0.33, euclidRot: 0, drop: 0, determinism: 1, weird: 0 });
  const euclidB = makeVoice({ ...euclidA, euclidRot: 2 });

  assert.notDeepEqual(
    absoluteBeats(createPatternModuleForVoice(euclidA).renderWindow({ voice: euclidA, voiceId: euclidA.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 })),
    absoluteBeats(createPatternModuleForVoice(euclidB).renderWindow({ voice: euclidB, voiceId: euclidB.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 })),
  );

  const caOff = makeVoice({ mode: 'ca', caRule: 0, density: 1, drop: 0 });
  const caOn = makeVoice({ mode: 'ca', caRule: 255, density: 1, drop: 0 });
  assert.equal(createPatternModuleForVoice(caOff).renderWindow({ voice: caOff, voiceId: caOff.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 }).events.length, 0);
  assert.ok(createPatternModuleForVoice(caOn).renderWindow({ voice: caOn, voiceId: caOn.id, source: { type: 'self' }, startBeat: 0, endBeat: 2 }).events.length > 0);
});
