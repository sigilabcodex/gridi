import assert from 'node:assert/strict';
import test from 'node:test';
import { createPatternModuleForTrigger } from '../src/engine/pattern/module.ts';
import { absoluteBeats, makeTrigger } from './helpers.mjs';

function dedupeMerge(a, b) {
  const eps = 1e-9;
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const x = i < a.length ? a[i] : Infinity;
    const y = j < b.length ? b[j] : Infinity;
    const next = x <= y ? x : y;
    if (out.length === 0 || Math.abs(out[out.length - 1] - next) > eps) out.push(next);
    if (Math.abs(x - next) <= eps) i++;
    if (Math.abs(y - next) <= eps) j++;
  }
  return out;
}

test('event windows merge without duplicates across overlap', () => {
  const trigger = makeTrigger({ seed: 222, length: 16, density: 0.45, subdiv: 4 });
  const module = createPatternModuleForTrigger(trigger);
  const w1 = module.renderWindow({ trigger, voiceId: 'v1', startBeat: 0, endBeat: 1 });
  const w2 = module.renderWindow({ trigger, voiceId: 'v1', startBeat: 0.75, endBeat: 1.75 });

  const merged = dedupeMerge(absoluteBeats(w1), absoluteBeats(w2));
  const single = absoluteBeats(module.renderWindow({ trigger, voiceId: 'v1', startBeat: 0, endBeat: 1.75 }));
  assert.deepEqual(merged, single);
});

test('drop remains deterministic across repeated renders by mode', () => {
  for (const mode of ['step', 'euclid', 'ca', 'hybrid', 'fractal']) {
    const trigger = makeTrigger({ mode, seed: 901, length: 16, density: 0.8, drop: 0.5, weird: 0.65, caInit: 0.4 });
    const module = createPatternModuleForTrigger(trigger);
    const a = absoluteBeats(module.renderWindow({ trigger, voiceId: 'v1', startBeat: 0, endBeat: 2 }));
    const b = absoluteBeats(module.renderWindow({ trigger, voiceId: 'v1', startBeat: 0, endBeat: 2 }));
    assert.deepEqual(a, b, `drop determinism failed for mode ${mode}`);
  }
});
