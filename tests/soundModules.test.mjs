import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPatch, makeSound, makeTrigger, makeVisual, migratePatch } from '../src/patch.ts';

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


test('module identity separates instance name, engine, and preset', () => {
  const trigger = makeTrigger(1);
  const drum = makeSound('drum', 0, trigger.id);
  const synth = makeSound('tonal', 1, trigger.id);
  const visual = makeVisual('scope', 0);

  assert.equal(trigger.name, 'Trigger 2');
  assert.equal(trigger.engine, 'trigger');
  assert.equal(trigger.presetName, 'Sparse Euclid');

  assert.equal(drum.name, 'Drum 1');
  assert.equal(drum.engine, 'drum');
  assert.equal(drum.presetName, 'Deep Kick');

  assert.equal(synth.name, 'Synth 2');
  assert.equal(synth.engine, 'synth');
  assert.equal(synth.presetName, 'Rubber Bass');

  assert.equal(visual.name, 'Scope 1');
  assert.equal(visual.engine, 'visual');
  assert.equal(visual.presetName, 'Scope Default');
});

test('default patch uses readable module instance names', () => {
  const names = defaultPatch().modules.map((m) => m.name);
  assert.deepEqual(names, ['Trigger 1', 'Drum 1', 'Trigger 2', 'Drum 2', 'Synth 1', 'Control 1', 'Scope 1']);
});


test('migration assigns deterministic coordinates to legacy sequential modules', () => {
  const migrated = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [
      { id: 'a', type: 'trigger', name: 'A', enabled: true },
      { id: 'b', type: 'drum', name: 'B', enabled: true, triggerSource: null, amp: 0.2, pan: 0 },
      { id: 'c', type: 'visual', name: 'C', enabled: true, kind: 'scope' },
    ],
    buses: [],
    connections: [],
  });

  assert.deepEqual(
    migrated.modules.map((module) => ({ id: module.id, x: module.x, y: module.y })),
    [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 1, y: 0 },
      { id: 'c', x: 2, y: 0 },
    ]
  );
});

test('migration preserves explicit coordinate gaps when positions are already present', () => {
  const migrated = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [
      { id: 'a', type: 'trigger', name: 'A', enabled: true, x: 0, y: 0 },
      { id: 'b', type: 'drum', name: 'B', enabled: true, triggerSource: null, amp: 0.2, pan: 0, x: 2, y: 0 },
      { id: 'c', type: 'visual', name: 'C', enabled: true, kind: 'scope', x: 1, y: 1 },
    ],
    buses: [],
    connections: [],
  });

  assert.deepEqual(
    migrated.modules.map((module) => ({ id: module.id, x: module.x, y: module.y })),
    [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 2, y: 0 },
      { id: 'c', x: 1, y: 1 },
    ]
  );
});
