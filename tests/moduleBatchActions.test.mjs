import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSound, makeTrigger } from '../src/patch.ts';
import { validatePatchRouting } from '../src/routingGraph.ts';
import { deleteSelectedModules, duplicateSelectedModules } from '../src/ui/state/moduleBatchActions.ts';
import { makePatch } from './helpers.mjs';

function ids(patch) {
  return patch.modules.map((module) => module.id);
}

test('delete selected modules removes selected modules and clears selection', () => {
  const trigger = makeTrigger(0, 'GEN');
  const drum = makeSound('drum', 0, trigger.id);
  const synth = makeSound('tonal', 0, trigger.id);
  const patch = makePatch([trigger, drum, synth]);

  const result = deleteSelectedModules(patch, [drum.id, synth.id]);

  assert.equal(result.deletedCount, 2);
  assert.deepEqual(ids(patch), [trigger.id]);
  assert.deepEqual(result.selection.selectedModuleIds, []);
});

test('deleting selected generator clears affected voice triggerSource and typed routes', () => {
  const trigger = makeTrigger(0, 'GEN');
  const drum = makeSound('drum', 0, trigger.id);
  const patch = makePatch([trigger, drum]);
  patch.routes = [
    {
      id: 'evt-1',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: drum.id, port: 'trigger-in' },
      enabled: true,
    },
  ];

  deleteSelectedModules(patch, [trigger.id]);

  assert.equal(patch.modules.length, 1);
  assert.equal(patch.modules[0].id, drum.id);
  assert.equal(patch.modules[0].triggerSource, null);
  assert.deepEqual(patch.routes, []);
  assert.deepEqual(validatePatchRouting(patch).issues, []);
});

test('duplicate selected creates new ids, copies params, and selects duplicates', () => {
  const trigger = makeTrigger(0, 'GEN');
  const drum = makeSound('drum', 0, trigger.id);
  drum.basePitch = 0.77;
  drum.decay = 0.22;
  trigger.x = 0;
  trigger.y = 0;
  drum.x = 1;
  drum.y = 0;
  const patch = makePatch([trigger, drum]);

  const result = duplicateSelectedModules(patch, [drum.id]);
  const duplicate = patch.modules.find((module) => module.id === result.newIds[0]);

  assert.equal(result.duplicatedCount, 1);
  assert.ok(duplicate);
  assert.notEqual(duplicate.id, drum.id);
  assert.equal(duplicate.type, 'drum');
  assert.equal(duplicate.basePitch, 0.77);
  assert.equal(duplicate.decay, 0.22);
  assert.equal(duplicate.triggerSource, trigger.id);
  assert.deepEqual(result.selection.selectedModuleIds, [duplicate.id]);
});

test('duplicate selected remaps selected-internal trigger routing', () => {
  const trigger = makeTrigger(0, 'GEN');
  const drum = makeSound('drum', 0, trigger.id);
  trigger.x = 0;
  trigger.y = 0;
  drum.x = 1;
  drum.y = 0;
  const patch = makePatch([trigger, drum]);

  const result = duplicateSelectedModules(patch, [trigger.id, drum.id]);
  const duplicateTriggerId = result.idMap.get(trigger.id);
  const duplicateDrumId = result.idMap.get(drum.id);
  const duplicateDrum = patch.modules.find((module) => module.id === duplicateDrumId);

  assert.ok(duplicateTriggerId);
  assert.ok(duplicateDrum);
  assert.equal(duplicateDrum.triggerSource, duplicateTriggerId);
});

test('duplicate selected remaps selected-internal typed event routes', () => {
  const trigger = makeTrigger(0, 'GEN');
  const drum = makeSound('drum', 0, null);
  const patch = makePatch([trigger, drum]);
  patch.routes = [
    {
      id: 'evt-1',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: drum.id, port: 'trigger-in' },
      enabled: true,
    },
  ];

  const result = duplicateSelectedModules(patch, [trigger.id, drum.id]);
  const duplicateRoute = patch.routes.find((route) => route.id !== 'evt-1');

  assert.ok(duplicateRoute);
  assert.equal(duplicateRoute.source.moduleId, result.idMap.get(trigger.id));
  assert.equal(duplicateRoute.target.moduleId, result.idMap.get(drum.id));
  assert.deepEqual(validatePatchRouting(patch).issues, []);
});


test('duplicate selected routed voice keeps external generator route valid', () => {
  const trigger = makeTrigger(0, 'GEN');
  const drum = makeSound('drum', 0, null);
  const patch = makePatch([trigger, drum]);
  patch.routes = [
    {
      id: 'evt-external-source',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: drum.id, port: 'trigger-in' },
      enabled: true,
    },
  ];

  const result = duplicateSelectedModules(patch, [drum.id]);
  const duplicateRoute = patch.routes.find((route) => route.id !== 'evt-external-source');

  assert.ok(duplicateRoute);
  assert.equal(duplicateRoute.source.moduleId, trigger.id);
  assert.equal(duplicateRoute.target.moduleId, result.idMap.get(drum.id));
  assert.deepEqual(validatePatchRouting(patch).issues, []);
});
