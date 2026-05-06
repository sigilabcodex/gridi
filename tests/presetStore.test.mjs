import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyPatch, getTriggers, isSound, makeControl, makeSound, makeTrigger, migratePatch } from '../src/patch.ts';
import {
  defaultPresetSession,
  factoryExamplePresets,
  loadPresetSession,
  makePresetExportPayload,
  makeSinglePresetExportPayload,
  parsePresetImportPayload,
  resetPresetSessionToFactoryExamples,
  restoreMissingFactoryExamples,
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

test('formatDocumentTitle formats session and fallback titles', async () => {
  globalThis.__APP_VERSION__ = 'test-version';
  globalThis.__APP_BUILD__ = 'test-build';
  globalThis.__APP_BRANCH__ = 'test-branch';
  globalThis.__APP_DIRTY__ = false;
  const { APP_TITLE, formatDocumentTitle } = await import('../src/version.ts');
  assert.equal(formatDocumentTitle('TESTING'), 'GRIDI - TESTING');
  assert.equal(formatDocumentTitle('  Session 16  '), 'GRIDI - Session 16');
  assert.equal(formatDocumentTitle(''), APP_TITLE);
  assert.equal(formatDocumentTitle('   '), APP_TITLE);
  assert.equal(formatDocumentTitle(null), APP_TITLE);
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
  assert.equal(imported.presets.length, 4);
  const second = imported.presets.find((preset) => preset.id === 'preset-b');
  assert.ok(second);
  assert.equal(second.patch.modules[1].triggerSource, second.patch.modules[0].id);
});

test('empty patch template produces zero modules with baseline patch metadata', () => {
  const patch = emptyPatch();
  assert.equal(patch.version, '0.3');
  assert.equal(patch.modules.length, 0);
  assert.equal(patch.bpm, 124);
  assert.equal(patch.masterGain, 0.8);
});

function assertValidPatchRouting(patch) {
  const migrated = migratePatch(patch);
  assert.equal(migrated.version, '0.3');
  const moduleIds = new Set(migrated.modules.map((module) => module.id));
  assert.equal(moduleIds.size, migrated.modules.length);
  for (const module of migrated.modules) {
    assert.equal(typeof module.id, 'string');
    assert.equal(typeof module.name, 'string');
    assert.equal(typeof module.x, 'number');
    assert.equal(typeof module.y, 'number');
    if (isSound(module) && module.triggerSource) {
      assert.ok(moduleIds.has(module.triggerSource), `${module.name} routes to missing trigger ${module.triggerSource}`);
    }
  }
}

test('default preset session includes curated factory examples', () => {
  const session = defaultPresetSession();
  assert.deepEqual(session.presets.map((preset) => preset.name), [
    'Example 01 · Basic Pulse',
    'Example 02 · Dual Generators',
    'Example 03 · Experimental Field',
  ]);
  assert.equal(session.selectedPresetId, 'factory-example-01');
  assert.ok(session.presets.every((preset) => preset.source === 'factory'));
});

test('factory examples have valid patch structure and clear routing', () => {
  const presets = factoryExamplePresets();
  const byName = new Map(presets.map((preset) => [preset.name, preset.patch]));

  assert.equal(byName.get('Example 01 · Basic Pulse').modules.filter((module) => module.type === 'trigger').length, 1);
  assert.equal(byName.get('Example 01 · Basic Pulse').modules.filter((module) => module.type === 'drum').length, 2);
  assert.equal(byName.get('Example 01 · Basic Pulse').modules.filter((module) => module.type === 'tonal').length, 1);
  assert.equal(byName.get('Example 01 · Basic Pulse').modules.find((module) => module.type === 'tonal').reception, 'mono');

  assert.equal(byName.get('Example 02 · Dual Generators').modules.filter((module) => module.type === 'trigger').length, 2);
  assert.equal(byName.get('Example 02 · Dual Generators').modules.filter((module) => module.type === 'drum').length, 5);

  assert.ok(getTriggers(byName.get('Example 03 · Experimental Field')).some((trigger) => trigger.mode === 'radar'));
  assert.ok(getTriggers(byName.get('Example 03 · Experimental Field')).some((trigger) => trigger.mode === 'gear'));
  assert.ok(byName.get('Example 03 · Experimental Field').modules.some((module) => module.type === 'tonal'));

  for (const preset of presets) assertValidPatchRouting(preset.patch);
});

test('loading existing local sessions preserves them and appends missing factory examples', () => {
  withMockStorage(() => {
    const userPatch = makeLinkedPatch();
    localStorage.setItem('gridi.presets.v0_33', JSON.stringify({
      version: '0.33',
      selectedPresetId: 'legacy-user',
      presets: [{ id: 'legacy-user', name: 'Session 13', patch: userPatch, createdAt: 1, updatedAt: 2 }],
    }));

    const session = loadPresetSession();
    assert.equal(session.selectedPresetId, 'legacy-user');
    assert.equal(session.presets[0].id, 'legacy-user');
    assert.equal(session.presets[0].source, undefined);
    assert.ok(session.presets.some((preset) => preset.name === 'Example 01 · Basic Pulse' && preset.source === 'factory'));
    assert.equal(session.presets.length, 4);
  });
});


test('reset preset session returns only curated factory examples with valid selection', () => {
  const session = resetPresetSessionToFactoryExamples();
  const factory = factoryExamplePresets();

  assert.deepEqual(session.presets.map((preset) => preset.id), factory.map((preset) => preset.id));
  assert.deepEqual(session.presets.map((preset) => preset.name), factory.map((preset) => preset.name));
  assert.equal(session.selectedPresetId, factory[0].id);
  assert.ok(session.presets.some((preset) => preset.id === session.selectedPresetId));
  assert.ok(session.presets.every((preset) => preset.source === 'factory'));
});

test('restore missing factory examples appends missing examples without duplicates', () => {
  const [firstFactory, secondFactory] = factoryExamplePresets();
  const userPreset = {
    id: 'user-session',
    name: 'User Session',
    patch: makeLinkedPatch(),
    createdAt: 10,
    updatedAt: 11,
    source: 'user',
  };
  const restored = restoreMissingFactoryExamples({
    version: '0.33',
    selectedPresetId: secondFactory.id,
    presets: [userPreset, firstFactory, secondFactory],
  });

  assert.equal(restored.presets.filter((preset) => preset.id === firstFactory.id).length, 1);
  assert.equal(restored.presets.filter((preset) => preset.id === secondFactory.id).length, 1);
  assert.equal(restored.presets.filter((preset) => preset.source === 'factory').length, factoryExamplePresets().length);
  assert.deepEqual(restored.presets.slice(0, 3).map((preset) => preset.id), ['user-session', firstFactory.id, secondFactory.id]);
  assert.equal(restored.selectedPresetId, secondFactory.id);
});

test('restore missing factory examples preserves existing user sessions', () => {
  const userPreset = {
    id: 'local-user',
    name: 'Local User',
    patch: makeLinkedPatch(),
    createdAt: 20,
    updatedAt: 21,
    source: 'user',
  };
  const restored = restoreMissingFactoryExamples({
    version: '0.33',
    selectedPresetId: userPreset.id,
    presets: [userPreset],
  });

  assert.equal(restored.presets[0].id, userPreset.id);
  assert.equal(restored.presets[0].name, userPreset.name);
  assert.equal(restored.selectedPresetId, userPreset.id);
  assert.equal(restored.presets.length, 1 + factoryExamplePresets().length);
});

test('factory reset session export/import round-trips without compatibility changes', () => {
  const session = resetPresetSessionToFactoryExamples();
  const imported = parsePresetImportPayload(JSON.stringify(makePresetExportPayload(session)));

  assert.ok(imported);
  assert.equal(imported.selectedPresetId, session.selectedPresetId);
  assert.deepEqual(imported.presets.map((preset) => preset.id), session.presets.map((preset) => preset.id));
  assert.deepEqual(imported.presets.map((preset) => preset.name), session.presets.map((preset) => preset.name));
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

test('factory drum and synth expansions continue code numbering without replacing existing presets', () => {
  withMockStorage(() => {
    const records = loadModulePresetLibrary();
    const drumCodes = records
      .filter((record) => record.family === 'drum' && record.source === 'factory')
      .map((record) => record.code);
    const synthCodes = records
      .filter((record) => record.family === 'tonal' && record.source === 'factory')
      .map((record) => record.code);

    assert.deepEqual(drumCodes, [
      'DRUM001',
      'DRUM002',
      'DRUM003',
      'DRUM004',
      'DRUM005',
      'DRUM006',
      'DRUM007',
      'DRUM008',
      'DRUM009',
      'DRUM010',
      'DRUM011',
      'DRUM012',
      'DRUM013',
      'DRUM014',
      'DRUM015',
      'DRUM016',
    ]);
    assert.deepEqual(synthCodes, [
      'SYNTH001',
      'SYNTH002',
      'SYNTH003',
      'SYNTH004',
      'SYNTH005',
      'SYNTH006',
      'SYNTH007',
      'SYNTH008',
      'SYNTH009',
      'SYNTH010',
      'SYNTH011',
      'SYNTH012',
      'SYNTH013',
      'SYNTH014',
      'SYNTH015',
      'SYNTH016',
    ]);
    assert.ok(records.some((record) => record.id === 'factory-drum-tight-snare' && record.name === 'Tight Snare'));
    assert.ok(records.some((record) => record.id === 'factory-synth-noise-sweep' && record.name === 'Noise Sweep'));
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
