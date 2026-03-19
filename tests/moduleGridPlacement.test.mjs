import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSound, makeTrigger } from '../src/patch.ts';
import { resolveGridLayout } from '../src/workspacePlacement.ts';

test('grid layout resolution keeps canonical module object references', () => {
  const trigger = makeTrigger(0, 'TRG');
  const drum = makeSound('drum', 0, trigger.id);
  trigger.x = 0;
  trigger.y = 0;
  drum.x = 1;
  drum.y = 0;

  const layout = resolveGridLayout([trigger, drum]);

  assert.equal(layout.modulesByPosition.get('0,0'), trigger);
  assert.equal(layout.modulesByPosition.get('1,0'), drum);
});

test('grid layout resolution canonicalizes wider-grid coordinates for lookup', () => {
  const trigger = makeTrigger(0, 'TRG');
  trigger.x = 4;
  trigger.y = 0;

  const layout = resolveGridLayout([trigger]);

  assert.equal(layout.modulesByPosition.get('1,1'), trigger);
  assert.equal(layout.slotByModuleId.get(trigger.id), 4);
});
