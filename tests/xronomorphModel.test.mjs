import assert from 'node:assert/strict';
import test from 'node:test';
import { buildXronoMorphPatternModel } from '../src/engine/pattern/module.ts';
import { makeTrigger } from './helpers.mjs';

test('xronomorph model is deterministic and bounded', () => {
  const trigger = makeTrigger({ mode: 'xronomorph', seed: 777, length: 24, density: 0.62, weird: 0.51, gravity: 0.44, determinism: 0.67, drop: 0.2 });
  const a = buildXronoMorphPatternModel(trigger, 'v1');
  const b = buildXronoMorphPatternModel(trigger, 'v1');
  assert.deepEqual(Array.from(a.output), Array.from(b.output));
  assert.equal(a.output.length, trigger.length);
  for (const pattern of [a.sourceEuclid, a.sourceCA, a.sourceStep, a.output, a.agreement]) {
    for (const bit of pattern) assert.ok(bit === 0 || bit === 1);
  }
});

test('xronomorph morph influences disagreement/variation when determinism is low', () => {
  const base = makeTrigger({ mode: 'xronomorph', seed: 1001, length: 32, density: 0.55, gravity: 0.4, determinism: 0.2, drop: 0 });
  const lowMorph = buildXronoMorphPatternModel({ ...base, weird: 0.05 }, 'v1');
  const highMorph = buildXronoMorphPatternModel({ ...base, weird: 0.95 }, 'v1');

  const disagreementCount = (model) => Array.from(model.agreement).reduce((sum, bit) => sum + (bit ? 0 : 1), 0);
  assert.ok(disagreementCount(highMorph) >= disagreementCount(lowMorph));
});

test('xronomorph dominant source track matches chooser thresholds', () => {
  const trigger = makeTrigger({ mode: 'xronomorph', seed: 234, length: 20, weird: 0.7, subdiv: 6 });
  const model = buildXronoMorphPatternModel(trigger, 'v1');
  for (let i = 0; i < model.chooser.length; i++) {
    const c = model.chooser[i];
    const expected = c < 0.33 ? 0 : c < 0.66 ? 1 : 2;
    assert.equal(model.dominantSourceByStep[i], expected);
  }
});
