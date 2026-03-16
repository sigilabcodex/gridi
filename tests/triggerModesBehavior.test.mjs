import assert from 'node:assert/strict';
import test from 'node:test';
import { createPatternModuleForTrigger } from '../src/engine/pattern/module.ts';
import { makeTrigger } from './helpers.mjs';

const MODES = ['step', 'euclid', 'ca', 'hybrid', 'fractal'];

function renderBinaryCycle(trigger, voiceId = 'voice-a') {
  const beats = trigger.length / (2 * Math.max(1, trigger.subdiv | 0));
  const window = createPatternModuleForTrigger(trigger).renderWindow({ trigger, voiceId, startBeat: 0, endBeat: beats });
  const stepsPerBeat = 2 * trigger.subdiv;
  const out = new Uint8Array(trigger.length);
  for (const ev of window.events) {
    const absoluteBeat = window.startBeat + ev.beatOffset;
    const step = Math.round(absoluteBeat * stepsPerBeat);
    out[((step % trigger.length) + trigger.length) % trigger.length] = 1;
  }
  return out;
}

function hamming(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

test('all modes are deterministic for same trigger and seed', () => {
  for (const mode of MODES) {
    const trigger = makeTrigger({ mode, seed: 4242, length: 32, subdiv: 4, density: 0.56, drop: 0, determinism: 0.73, gravity: 0.48, weird: 0.31, euclidRot: 3, caRule: 110, caInit: 0.4 });
    const a = renderBinaryCycle(trigger, 'v1');
    const b = renderBinaryCycle(trigger, 'v1');
    assert.deepEqual([...a], [...b], `${mode} mode changed between identical renders`);
  }
});

test('mode outputs are meaningfully distinct for same global params', () => {
  const base = makeTrigger({ seed: 9001, length: 32, subdiv: 4, density: 0.5, drop: 0, determinism: 0.6, gravity: 0.55, weird: 0.45, euclidRot: 2, caRule: 90, caInit: 0.5 });
  const patterns = MODES.map((mode) => renderBinaryCycle({ ...base, mode }, 'v1'));
  const labels = MODES;

  let distinctPairs = 0;
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const diff = hamming(patterns[i], patterns[j]);
      if (diff >= 4) distinctPairs++;
      assert.ok(diff > 0, `modes ${labels[i]} and ${labels[j]} unexpectedly identical`);
    }
  }

  assert.ok(distinctPairs >= 8, `expected many mode pairs to diverge strongly, got ${distinctPairs}`);
});

test('step mode forms repeating motif when determinism is low-chaos', () => {
  const trigger = makeTrigger({ mode: 'step', seed: 101, length: 16, subdiv: 4, density: 0.5, determinism: 0.2, gravity: 0.6, weird: 0 });
  const bits = renderBinaryCycle(trigger, 'v1');
  const first = bits.slice(0, 4);
  const second = bits.slice(4, 8);
  const third = bits.slice(8, 12);
  const fourth = bits.slice(12, 16);
  assert.deepEqual([...first], [...second]);
  assert.deepEqual([...first], [...third]);
  assert.deepEqual([...first], [...fourth]);
});

test('euclid mode keeps pulse count with deterministic settings', () => {
  const trigger = makeTrigger({ mode: 'euclid', seed: 12, length: 24, subdiv: 4, density: 0.375, drop: 0, determinism: 1, gravity: 0, weird: 0, euclidRot: 0 });
  const bits = renderBinaryCycle(trigger, 'v1');
  const pulses = bits.reduce((n, x) => n + x, 0);
  assert.equal(pulses, Math.round(trigger.length * trigger.density));
});

test('ca rule 255 with full init and density produces full-on pattern', () => {
  const trigger = makeTrigger({ mode: 'ca', seed: 77, length: 16, subdiv: 4, density: 1, drop: 0, caRule: 255, caInit: 1, weird: 0, gravity: 0.5 });
  const bits = renderBinaryCycle(trigger, 'v1');
  assert.ok(bits.every((x) => x === 1));
});
