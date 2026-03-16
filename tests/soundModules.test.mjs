import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSound, migratePatch } from '../src/patch.ts';

test('drum and tonal defaults are distinct and specialized', () => {
  const drum = makeSound('drum', 0, 'trg-1');
  const tonal = makeSound('tonal', 1, 'trg-2');

  assert.equal(drum.type, 'drum');
  assert.equal(tonal.type, 'tonal');
  assert.ok('basePitch' in drum);
  assert.ok('pitchEnvAmt' in drum);
  assert.ok('waveform' in tonal);
  assert.ok('sustain' in tonal);
  assert.ok(!('waveform' in drum));
  assert.ok(!('pitchEnvAmt' in tonal));
});

test('migration maps legacy timbre to new drum and tonal models', () => {
  const migrated = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [
      { id: 'd1', type: 'drum', name: 'D', enabled: true, triggerSource: null, amp: 0.2, timbre: 0.8, pan: 0 },
      { id: 't1', type: 'tonal', name: 'T', enabled: true, triggerSource: null, amp: 0.2, timbre: 0.2, pan: 0 },
    ],
    buses: [],
    connections: [],
  });

  const drum = migrated.modules.find((m) => m.id === 'd1');
  const tonal = migrated.modules.find((m) => m.id === 't1');
  assert.equal(drum.type, 'drum');
  assert.equal(tonal.type, 'tonal');
  assert.ok(typeof drum.basePitch === 'number');
  assert.ok(typeof tonal.waveform === 'number');
});

test('new sound modules instantiate safely with full parameter surface', () => {
  for (let i = 0; i < 8; i++) {
    const kind = i % 2 === 0 ? 'drum' : 'tonal';
    const module = makeSound(kind, i, null);
    assert.equal(module.enabled, true);
    assert.equal(module.triggerSource, null);
  }
});
