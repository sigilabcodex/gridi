import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPatch, emptyPatch, makeControl, makeSound, makeTrigger } from '../src/patch.ts';
import {
  defaultPresetSession,
  makePresetExportPayload,
  makeSinglePresetExportPayload,
  parsePresetImportPayload,
  sanitizePresetName,
} from '../src/ui/persistence/presetStore.ts';
import {
  applyModulePreset,
  formatModulePresetDisplayName,
  listModulePresetsForModule,
  loadModulePresetLibrary,
  saveModulePresetFromModule,
} from '../src/ui/persistence/modulePresetStore.ts';

function withMockStorage(run) {
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  try {
    run();
  } finally {
    if (typeof original === 'undefined') delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
}

function makeLinkedPatch() {
  const trigger = makeTrigger(0, 'TRG_A');
  const drum = makeSound('drum', 0, trigger.id);

  trigger.x = 0;
  trigger.y = 0;
  drum.x = 2;
  drum.y = 1;

  return {
    version: '0.3',
    bpm: 120,
    swing: 0,
    masterGain: 1,
    masterMute: false,
    modules: [trigger, drum],
    buses: [{ id: 'master', gain: 1 }],
    connections: [
      {
        from: { moduleId: drum.id, out: 'main' },
        to: { type: 'bus', id: 'master' },
      },
    ],
  };
}

test('sanitizePresetName trims and normalizes whitespace', () => {
  assert.equal(sanitizePresetName('  My   Groove   ', 'Fallback'), 'My Groove');
  assert.equal(sanitizePresetName('   ', 'Fallback'), 'Fallback');
});

test('single preset export/import roundtrip preserves module relationships', () => {
  const patch = makeLinkedPatch();
  const preset = {
    id: 'preset-a',
    name: 'Linked',
    patch,
    createdAt: 1,
    updatedAt: 2,
  };

  const payload = makeSinglePresetExportPayload(preset);
  const imported = parsePresetImportPayload(JSON.stringify(payload));

  assert.ok(imported);
  assert.equal(imported.presets.length, 1);
  const importedPreset = imported.presets[0];
  assert.equal(importedPreset.patch.modules[1].triggerSource, importedPreset.patch.modules[0].id);
});

test('session export/import roundtrip preserves selected preset and patches', () => {
  const session = defaultPresetSession();
  session.presets.push({
    id: 'preset-b',
    name: 'Second',
    patch: makeLinkedPatch(),
    createdAt: 3,
    updatedAt: 4,
  });
  session.selectedPresetId = 'preset-b';

  const payload = makePresetExportPayload(session);
  const imported = parsePresetImportPayload(JSON.stringify(payload));

  assert.ok(imported);
  assert.equal(imported.selectedPresetId, 'preset-b');
  assert.equal(imported.presets.length, 2);
  assert.equal(imported.presets[1].patch.modules[1].triggerSource, imported.presets[1].patch.modules[0].id);
});

test('empty patch template produces zero modules with baseline patch metadata', () => {
  const patch = emptyPatch();
  assert.equal(patch.version, '0.3');
  assert.equal(patch.modules.length, 0);
  assert.equal(patch.bpm, 124);
  assert.equal(patch.masterGain, 0.8);
});

test('default preset session remains starter/example seeded from defaultPatch', () => {
  const session = defaultPresetSession();
  assert.equal(session.presets.length, 1);
  assert.equal(session.presets[0].name, 'Starter Session');
  assert.equal(session.presets[0].patch.modules.length, defaultPatch().modules.length);
  assert.notEqual(session.presets[0].patch.modules.length, 0);
});

test('invalid import payloads return null safely', () => {
  assert.equal(parsePresetImportPayload('{'), null);
  assert.equal(parsePresetImportPayload('{}'), null);
  assert.equal(parsePresetImportPayload(JSON.stringify({ presets: [{ name: 'bad' }] })), null);
});


test('preset import preserves explicit module coordinates', () => {
  const payload = JSON.stringify({
    preset: {
      id: 'preset-coords',
      name: 'Coords',
      patch: makeLinkedPatch(),
      createdAt: 10,
      updatedAt: 11,
    },
  });

  const imported = parsePresetImportPayload(payload);
  assert.ok(imported);
  assert.deepEqual(
    imported.presets[0].patch.modules.map((module) => ({ id: module.id, x: module.x, y: module.y })),
    [
      { id: imported.presets[0].patch.modules[0].id, x: 0, y: 0 },
      { id: imported.presets[0].patch.modules[1].id, x: 2, y: 1 },
    ]
  );
});


test('module preset filtering only returns compatible family/type entries', () => {
  const drum = makeSound('drum', 0);
  const control = makeControl('drift', 0);
  const records = [
    { id: 'drum-a', name: 'Deep Kick', family: 'drum', subtype: 'drum', state: { enabled: true, amp: 0.3, pan: 0, basePitch: 0.42, decay: 0.3, transient: 0.6, snap: 0.25, noise: 0.2, bodyTone: 0.5, pitchEnvAmt: 0.55, pitchEnvDecay: 0.25, tone: 0.45 }, createdAt: 1, updatedAt: 1 },
    { id: 'synth-a', name: 'Rubber Bass', family: 'tonal', subtype: 'tonal', state: { enabled: true, amp: 0.2, pan: 0, waveform: 0.25, coarseTune: 0, fineTune: 0, attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.5, cutoff: 0.55, resonance: 0.2, glide: 0.08, modDepth: 0.15, modRate: 0.25 }, createdAt: 1, updatedAt: 1 },
    { id: 'control-a', name: 'Warm Drift', family: 'control', subtype: 'drift', state: { enabled: true, kind: 'drift', waveform: 'sine', speed: 0.2, amount: 0.4, phase: 0, rate: 0.3, randomness: 0.6 }, createdAt: 1, updatedAt: 1 },
  ];

  assert.deepEqual(listModulePresetsForModule(records, drum).map((record) => record.id), ['drum-a']);
  assert.deepEqual(listModulePresetsForModule(records, control).map((record) => record.id), ['control-a']);
});

test('saving and loading a module preset preserves module identity while updating preset identity', () => {
  const drum = makeSound('drum', 0);
  drum.name = 'Kick Lane';
  drum.basePitch = 0.73;
  drum.triggerSource = 'external-trigger';

  const library = [];
  const saved = saveModulePresetFromModule(library, drum, { name: 'Punch Kick' });

  assert.ok(saved);
  assert.equal(library.length, 1);
  assert.equal(drum.name, 'Kick Lane');
  assert.equal(drum.presetName, 'Punch Kick');
  assert.equal(drum.presetMeta.modulePresetId, library[0].id);

  drum.basePitch = 0.11;
  drum.triggerSource = 'keep-this-routing';
  const applied = applyModulePreset(drum, library[0]);

  assert.equal(applied, true);
  assert.equal(drum.name, 'Kick Lane');
  assert.equal(drum.presetName, 'Punch Kick');
  assert.equal(drum.basePitch, 0.73);
  assert.equal(drum.triggerSource, 'keep-this-routing');
});

test('formatModulePresetDisplayName uses code when present', () => {
  assert.equal(formatModulePresetDisplayName({ code: 'GEN001', name: 'Sparse Euclid' }), 'GEN001 · Sparse Euclid');
  assert.equal(formatModulePresetDisplayName({ name: 'User Kick' }), 'User Kick');
});

test('factory presets include stable codes', () => {
  withMockStorage(() => {
    const records = loadModulePresetLibrary();
    const triggerFactory = records.find((record) => record.name === 'Sparse Euclid');
    assert.ok(triggerFactory?.code?.startsWith('GEN'));
    assert.ok(records.some((record) => record.code === 'DRUM001'));
    assert.ok(records.some((record) => record.code === 'SYNTH001'));
    assert.ok(records.some((record) => record.code === 'CTRL001'));
    assert.ok(records.some((record) => record.code === 'VIS001'));
  });
});

test('module preset normalization keeps optional code and tolerates missing code', () => {
  const payload = [
    { id: 'user-a', code: 'DRUM099', name: 'Coded User', family: 'drum', subtype: 'drum', state: { enabled: true, amp: 0.2, pan: 0, basePitch: 0.4, decay: 0.3, transient: 0.6, snap: 0.5, noise: 0.2, bodyTone: 0.3, pitchEnvAmt: 0.4, pitchEnvDecay: 0.2, tone: 0.3 }, createdAt: 1, updatedAt: 2 },
    { id: 'user-b', name: 'Legacy User', family: 'drum', subtype: 'drum', state: { enabled: true, amp: 0.2, pan: 0, basePitch: 0.4, decay: 0.3, transient: 0.6, snap: 0.5, noise: 0.2, bodyTone: 0.3, pitchEnvAmt: 0.4, pitchEnvDecay: 0.2, tone: 0.3 }, createdAt: 1, updatedAt: 2 },
  ];
  withMockStorage(() => {
    localStorage.setItem('gridi.module-presets.v1', JSON.stringify(payload));
    const records = loadModulePresetLibrary();
    const coded = records.find((record) => record.id === 'user-a');
    const legacy = records.find((record) => record.id === 'user-b');
    assert.equal(coded?.code, 'DRUM099');
    assert.equal(legacy?.code, undefined);
  });
});
