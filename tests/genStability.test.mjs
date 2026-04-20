import assert from 'node:assert/strict';
import test from 'node:test';
import { createPatternModuleForTrigger } from '../src/engine/pattern/module.ts';
import { createGearModel } from '../src/engine/pattern/gear.ts';

function makeTrigger(overrides = {}) {
  return {
    id: 'trg-stability',
    type: 'trigger',
    name: 'GEN',
    enabled: true,
    mode: 'gear',
    seed: 4401,
    determinism: 0.7,
    gravity: 0.6,
    accent: 0.5,
    density: 0.5,
    subdiv: 4,
    length: 32,
    drop: 0,
    weird: 0.4,
    euclidRot: 0,
    caRule: 90,
    caInit: 0.25,
    ...overrides,
  };
}

test('gear model supports up to four interlocking rings', () => {
  const trigger = makeTrigger({ mode: 'gear', density: 1, length: 48, subdiv: 8, weird: 0.72 });
  const model = createGearModel(trigger, 'voice-a');
  assert.equal(model.ringCount, 4);
  assert.equal(model.rings.length, 4);
  assert.ok(model.rings.every((ring) => ring.direction === 1 || ring.direction === -1));
  assert.ok(model.steps >= 8 && model.steps <= 128);
});

test('accent depth shapes velocity while preserving hit structure', () => {
  const base = makeTrigger({
    mode: 'euclidean',
    seed: 1221,
    length: 24,
    density: 0.55,
    weird: 0.4,
    gravity: 0.6,
    determinism: 0.7,
    drop: 0,
  });
  const soft = createPatternModuleForTrigger({ ...base, accent: 0 }).renderWindow({ trigger: { ...base, accent: 0 }, voiceId: 'voice-a', startBeat: 0, endBeat: 2 });
  const hard = createPatternModuleForTrigger({ ...base, accent: 1 }).renderWindow({ trigger: { ...base, accent: 1 }, voiceId: 'voice-a', startBeat: 0, endBeat: 2 });

  assert.deepEqual(
    soft.events.map((event) => event.beatOffset),
    hard.events.map((event) => event.beatOffset),
    'accent must not alter hit placement',
  );
  assert.ok(
    soft.events.some((event, index) => Math.abs(event.value - hard.events[index].value) > 0.02),
    'accent should alter at least part of the velocity contour',
  );
});

test('gen event velocities remain inside safety headroom for dense scenarios', () => {
  for (const mode of ['gear', 'sonar', 'hybrid', 'non-euclidean']) {
    const trigger = makeTrigger({
      mode,
      seed: 2288,
      length: 64,
      density: 0.9,
      weird: 0.82,
      gravity: 0.77,
      determinism: 0.46,
      drop: 0,
    });
    const window = createPatternModuleForTrigger(trigger).renderWindow({ trigger, voiceId: 'voice-a', startBeat: 0, endBeat: 4 });
    for (const ev of window.events) {
      assert.ok(ev.value >= 0.15 && ev.value <= 0.9, `${mode} produced out-of-range value ${ev.value}`);
    }
  }
});
