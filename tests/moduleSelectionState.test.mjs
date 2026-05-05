import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModuleSelectionState,
  pruneModuleSelection,
  replaceModuleSelection,
  toggleModuleSelection,
} from '../src/ui/state/moduleSelection.ts';

test('replace selection keeps only clicked module', () => {
  const initial = createModuleSelectionState();
  const next = replaceModuleSelection(initial, 'mod-a');
  assert.deepEqual(next.selectedModuleIds, ['mod-a']);
  assert.equal(next.selectionAnchorId, 'mod-a');
  assert.equal(next.selectionMode, 'replace');
});

test('toggle selection adds and removes module ids', () => {
  const initial = replaceModuleSelection(createModuleSelectionState(), 'mod-a');
  const added = toggleModuleSelection(initial, 'mod-b');
  assert.deepEqual(added.selectedModuleIds.sort(), ['mod-a', 'mod-b']);
  assert.equal(added.selectionAnchorId, 'mod-b');
  assert.equal(added.selectionMode, 'add');

  const removed = toggleModuleSelection(added, 'mod-a');
  assert.deepEqual(removed.selectedModuleIds, ['mod-b']);
});

test('prune removes deleted modules from selection and anchor', () => {
  const state = {
    selectedModuleIds: ['mod-a', 'mod-b'],
    selectionAnchorId: 'mod-b',
    selectionMode: 'add',
  };
  const pruned = pruneModuleSelection(state, ['mod-a']);
  assert.deepEqual(pruned.selectedModuleIds, ['mod-a']);
  assert.equal(pruned.selectionAnchorId, null);
});

test('selection is preserved by id after reorder', () => {
  const state = {
    selectedModuleIds: ['mod-b', 'mod-a'],
    selectionAnchorId: 'mod-b',
    selectionMode: 'add',
  };
  const reorderedIds = ['mod-c', 'mod-a', 'mod-b'];
  const preserved = pruneModuleSelection(state, reorderedIds);
  assert.deepEqual(preserved.selectedModuleIds, ['mod-b', 'mod-a']);
  assert.equal(preserved.selectionAnchorId, 'mod-b');
});
