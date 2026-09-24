import assert from 'node:assert/strict';
import test from 'node:test';
import { isEditableShortcutTarget } from '../src/ui/state/keyboardShortcuts.ts';

test('global shortcuts are suppressed for form controls and contenteditable targets', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(isEditableShortcutTarget({ tagName }), true, `${tagName} should own keyboard input`);
  }
  assert.equal(isEditableShortcutTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableShortcutTarget({ tagName: 'BUTTON', isContentEditable: false }), false);
  assert.equal(isEditableShortcutTarget(null), false);
});
