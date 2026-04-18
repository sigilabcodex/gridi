import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMidiMessage } from '../src/ui/midiInput.ts';

test('parseMidiMessage handles note on and note off', () => {
  assert.deepEqual(parseMidiMessage([0x90, 60, 100]), {
    type: 'noteon',
    note: 60,
    velocity: 100 / 127,
    channel: 1,
  });

  assert.deepEqual(parseMidiMessage([0x80, 60, 64]), {
    type: 'noteoff',
    note: 60,
    velocity: 64 / 127,
    channel: 1,
  });
});

test('parseMidiMessage treats note-on with zero velocity as note-off', () => {
  assert.deepEqual(parseMidiMessage([0x90, 72, 0]), {
    type: 'noteoff',
    note: 72,
    velocity: 0,
    channel: 1,
  });
});

test('parseMidiMessage ignores non-note statuses', () => {
  assert.equal(parseMidiMessage([0xB0, 10, 127]), null);
});
