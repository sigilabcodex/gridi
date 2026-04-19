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
