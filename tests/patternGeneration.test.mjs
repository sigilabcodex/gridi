import assert from 'node:assert/strict';
import test from 'node:test';
import { createPatternModuleForTrigger } from '../src/engine/pattern/module.ts';
import { absoluteBeats, makeTrigger } from './helpers.mjs';

test('step trigger is deterministic for same seed/params', () => {
  const trigger = makeTrigger({ seed: 777, length: 12, density: 0.4, subdiv: 2 });
  const winA = createPatternModuleForTrigger(trigger).renderWindow({ trigger, voiceId: 'v1', startBeat: 0, endBeat: 2 });
  const winB = createPatternModuleForTrigger(trigger).renderWindow({ trigger, voiceId: 'v1', startBeat: 0, endBeat: 2 });
  assert.deepEqual(absoluteBeats(winA), absoluteBeats(winB));
});

test('all trigger modes produce bounded monotonic windows', () => {
  for (const mode of ['step', 'euclid', 'ca', 'hybrid', 'fractal']) {
    const trigger = makeTrigger({ mode, seed: 901, length: 16, density: 0.7, drop: 0.3, weird: 0.65, caRule: 110 });
    const window = createPatternModuleForTrigger(trigger).renderWindow({ trigger, voiceId: 'v1', startBeat: 0, endBeat: 4 });
    const beats = absoluteBeats(window);
    assert.ok(beats.every((b) => b >= 0 && b < 4));
    assert.ok(beats.every((b, i) => i === 0 || b >= beats[i - 1]));
  }
});

test('euclid rotation and CA rule differences change output', () => {
  const euclidA = makeTrigger({ mode: 'euclid', length: 15, density: 0.33, euclidRot: 0, drop: 0, determinism: 1, weird: 0 });
  const euclidB = makeTrigger({ ...euclidA, euclidRot: 2 });
  assert.notDeepEqual(
    absoluteBeats(createPatternModuleForTrigger(euclidA).renderWindow({ trigger: euclidA, voiceId: 'v1', startBeat: 0, endBeat: 2 })),
    absoluteBeats(createPatternModuleForTrigger(euclidB).renderWindow({ trigger: euclidB, voiceId: 'v1', startBeat: 0, endBeat: 2 })),
  );

  const caOff = makeTrigger({ mode: 'ca', caRule: 0, caInit: 1, density: 1, drop: 0 });
  const caOn = makeTrigger({ mode: 'ca', caRule: 255, caInit: 1, density: 1, drop: 0 });
  assert.notDeepEqual(
    absoluteBeats(createPatternModuleForTrigger(caOff).renderWindow({ trigger: caOff, voiceId: 'v1', startBeat: 0, endBeat: 2 })),
    absoluteBeats(createPatternModuleForTrigger(caOn).renderWindow({ trigger: caOn, voiceId: 'v1', startBeat: 0, endBeat: 2 })),
  );
});
