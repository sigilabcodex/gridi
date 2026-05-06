import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADD_MODULE_FAMILIES,
  getAddModuleFamily,
  getAddModuleRootKeyboardMetadata,
  getAddModuleSubtypeItems,
} from '../src/ui/AddModuleSlot.ts';
import { makeControl, makeSound, makeTrigger, makeVisual } from '../src/patch.ts';

function createModuleForPick(pick, index = 0) {
  if (pick === 'drum' || pick === 'tonal') return makeSound(pick, index);
  if (pick === 'trigger') return makeTrigger(index);
  if (pick === 'control-lfo') return makeControl('lfo', index);
  if (pick === 'control-drift') return makeControl('drift', index);
  if (pick === 'control-stepped') return makeControl('stepped', index);
  return makeVisual(pick, index);
}

test('add-module IA exposes expected family-first order', () => {
  assert.deepEqual(
    ADD_MODULE_FAMILIES.map((family) => ({ id: family.id, code: family.code, defaultPick: family.defaultPick })),
    [
      { id: 'gen', code: 'GEN', defaultPick: 'trigger' },
      { id: 'drum', code: 'DRUM', defaultPick: 'drum' },
      { id: 'synth', code: 'SYNTH', defaultPick: 'tonal' },
      { id: 'ctrl', code: 'CTRL', defaultPick: 'control-lfo' },
      { id: 'vis', code: 'VIS', defaultPick: 'scope' },
    ]
  );
});

test('add-module family defaults preserve existing module creation mappings', () => {
  const created = ADD_MODULE_FAMILIES.map((family, index) => createModuleForPick(family.defaultPick, index));

  assert.deepEqual(
    created.map((module) => ({ type: module.type, engine: module.engine, kind: module.kind ?? null })),
    [
      { type: 'trigger', engine: 'trigger', kind: null },
      { type: 'drum', engine: 'drum', kind: null },
      { type: 'tonal', engine: 'synth', kind: null },
      { type: 'control', engine: 'control', kind: 'lfo' },
      { type: 'visual', engine: 'visual', kind: 'scope' },
    ]
  );
});

test('add-module control and visual subtypes still create supported variants', () => {
  assert.deepEqual(getAddModuleSubtypeItems('ctrl').map((item) => item.value), [
    'control-lfo',
    'control-drift',
    'control-stepped',
  ]);
  assert.deepEqual(getAddModuleSubtypeItems('vis').map((item) => item.value), [
    'scope',
    'spectrum',
    'vectorscope',
    'spectral-depth',
    'flow',
    'ritual',
    'glitch',
    'cymat',
  ]);

  for (const item of getAddModuleSubtypeItems('ctrl')) {
    const module = createModuleForPick(item.value);
    assert.equal(module.type, 'control');
    assert.equal(item.value, `control-${module.kind}`);
  }

  for (const item of getAddModuleSubtypeItems('vis')) {
    const module = createModuleForPick(item.value);
    assert.equal(module.type, 'visual');
    assert.equal(module.kind, item.value);
  }
});

test('add-module subtype lookup is empty for direct-add families', () => {
  assert.equal(getAddModuleFamily('gen').defaultPick, 'trigger');
  assert.deepEqual(getAddModuleSubtypeItems('gen'), []);
  assert.deepEqual(getAddModuleSubtypeItems('drum'), []);
  assert.deepEqual(getAddModuleSubtypeItems('synth'), []);
});

test('add-module root keyboard metadata explicitly marks subtype-capable families', () => {
  assert.deepEqual(getAddModuleRootKeyboardMetadata(), [
    { familyId: 'gen', defaultPick: 'trigger', opensSubtypes: false },
    { familyId: 'drum', defaultPick: 'drum', opensSubtypes: false },
    { familyId: 'synth', defaultPick: 'tonal', opensSubtypes: false },
    { familyId: 'ctrl', defaultPick: 'control-lfo', opensSubtypes: true },
    { familyId: 'vis', defaultPick: 'scope', opensSubtypes: true },
  ]);
});

test('add-module keyboard subtype intent is independent from visible family copy', () => {
  const originalCopy = ADD_MODULE_FAMILIES.map((family) => ({
    family,
    code: family.code,
    label: family.label,
    desc: family.desc,
  }));

  try {
    for (const { family } of originalCopy) {
      family.code = `Copy ${family.id}`;
      family.label = `Visible ${family.id}`;
      family.desc = `Description ${family.id}`;
    }

    assert.deepEqual(
      getAddModuleRootKeyboardMetadata().map(({ familyId, opensSubtypes }) => ({ familyId, opensSubtypes })),
      [
        { familyId: 'gen', opensSubtypes: false },
        { familyId: 'drum', opensSubtypes: false },
        { familyId: 'synth', opensSubtypes: false },
        { familyId: 'ctrl', opensSubtypes: true },
        { familyId: 'vis', opensSubtypes: true },
      ]
    );
  } finally {
    for (const { family, code, label, desc } of originalCopy) {
      family.code = code;
      family.label = label;
      family.desc = desc;
    }
  }
});
