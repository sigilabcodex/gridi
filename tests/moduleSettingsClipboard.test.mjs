import assert from 'node:assert/strict';
import test from 'node:test';
import { makeControl, makeSound, makeTrigger, makeVisual } from '../src/patch.ts';
import { createModuleSettingsClipboard } from '../src/ui/state/moduleSettingsClipboard.ts';

test('copy/paste settings transfers compatible drum state without session context or preset provenance', () => {
  const source = makeSound('drum', 0, 'source-trigger');
  source.basePitch = 0.78;
  source.decay = 0.61;
  source.drumChannel = '04';
  const target = makeSound('drum', 1, 'target-trigger');
  target.basePitch = 0.12;
  target.decay = 0.2;
  target.name = 'Target drum';
  target.x = 6;
  target.y = 3;
  target.drumChannel = '07';
  target.modulations = { basePitch: 'control-a' };
  target.presetName = 'Linked preset';
  target.presetMeta = { modulePresetId: 'preset-a', modulePresetSource: 'factory' };
  const originalId = target.id;
  const clipboard = createModuleSettingsClipboard();

  assert.equal(clipboard.copySettingsFromModule(source), true);
  assert.equal(clipboard.canPasteSettingsToModule(target), true);
  assert.equal(clipboard.pasteSettingsToModule(target), true);
  assert.equal(target.basePitch, 0.78);
  assert.equal(target.decay, 0.61);
  assert.equal(target.id, originalId);
  assert.equal(target.name, 'Target drum');
  assert.deepEqual([target.x, target.y], [6, 3]);
  assert.equal(target.triggerSource, 'target-trigger');
  assert.equal(target.drumChannel, '07');
  assert.deepEqual(target.modulations, { basePitch: 'control-a' });
  assert.equal(target.presetName, 'Linked preset');
  assert.deepEqual(target.presetMeta, { modulePresetId: 'preset-a', modulePresetSource: 'factory' });
});

test('copy/paste settings supports synth-to-synth while preserving reception and routing', () => {
  const source = makeSound('tonal', 0, 'source-trigger');
  source.cutoff = 0.82;
  source.release = 0.73;
  source.reception = 'poly';
  const target = makeSound('tonal', 1, 'target-trigger');
  target.cutoff = 0.2;
  target.release = 0.1;
  target.reception = 'mono';
  const clipboard = createModuleSettingsClipboard();

  clipboard.copySettingsFromModule(source);
  assert.equal(clipboard.pasteSettingsToModule(target), true);
  assert.equal(target.cutoff, 0.82);
  assert.equal(target.release, 0.73);
  assert.equal(target.reception, 'mono');
  assert.equal(target.triggerSource, 'target-trigger');
});

test('copy/paste settings rejects incompatible module families', () => {
  const source = makeSound('drum', 0);
  const target = makeSound('tonal', 0);
  const clipboard = createModuleSettingsClipboard();

  clipboard.copySettingsFromModule(source);
  assert.equal(clipboard.canPasteSettingsToModule(target), false);
  assert.equal(clipboard.pasteSettingsToModule(target), false);
});

test('copy/paste settings rejects GEN modules with different modes and preserves mode when compatible', () => {
  const source = makeTrigger(0);
  source.mode = 'euclidean';
  source.density = 0.72;
  const differentMode = makeTrigger(1);
  differentMode.mode = 'radar';
  const sameMode = makeTrigger(2);
  sameMode.mode = 'euclidean';
  sameMode.density = 0.1;
  const clipboard = createModuleSettingsClipboard();

  clipboard.copySettingsFromModule(source);
  assert.equal(clipboard.canPasteSettingsToModule(differentMode), false);
  assert.equal(clipboard.pasteSettingsToModule(differentMode), false);
  assert.equal(differentMode.mode, 'radar');
  assert.equal(clipboard.pasteSettingsToModule(sameMode), true);
  assert.equal(sameMode.density, 0.72);
  assert.equal(sameMode.mode, 'euclidean');
});

test('copy/paste settings rejects CTRL and VIS modules with different kinds', () => {
  const lfo = makeControl('lfo', 0);
  lfo.amount = 0.9;
  const drift = makeControl('drift', 0);
  const scope = makeVisual('scope', 0);
  scope.fftSize = 512;
  const spectrum = makeVisual('spectrum', 0);
  const clipboard = createModuleSettingsClipboard();

  clipboard.copySettingsFromModule(lfo);
  assert.equal(clipboard.pasteSettingsToModule(drift), false);
  assert.equal(drift.kind, 'drift');
  clipboard.copySettingsFromModule(scope);
  assert.equal(clipboard.pasteSettingsToModule(spectrum), false);
  assert.equal(spectrum.kind, 'spectrum');
});

test('module settings clipboard is temporary and can be cleared', () => {
  const source = makeSound('drum', 0);
  const target = makeSound('drum', 1);
  const clipboard = createModuleSettingsClipboard();

  clipboard.copySettingsFromModule(source);
  assert.ok(clipboard.getPayload());
  clipboard.clear();
  assert.equal(clipboard.getPayload(), null);
  assert.equal(clipboard.canPasteSettingsToModule(target), false);
});
