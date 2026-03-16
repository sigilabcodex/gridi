import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSound, makeTrigger } from '../src/patch.ts';
import {
  defaultPresetSession,
  makePresetExportPayload,
  makeSinglePresetExportPayload,
  parsePresetImportPayload,
  sanitizePresetName,
} from '../src/ui/persistence/presetStore.ts';

function makeLinkedPatch() {
  const trigger = makeTrigger(0, 'TRG_A');
  const drum = makeSound('drum', 0, trigger.id);

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

test('invalid import payloads return null safely', () => {
  assert.equal(parsePresetImportPayload('{'), null);
  assert.equal(parsePresetImportPayload('{}'), null);
  assert.equal(parsePresetImportPayload(JSON.stringify({ presets: [{ name: 'bad' }] })), null);
});
