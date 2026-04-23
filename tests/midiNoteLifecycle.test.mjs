import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveMidiVoiceTracker } from '../src/engine/liveMidiNotes.ts';
import { selectNotesForReception } from '../src/engine/events.ts';

function voice(label) {
  return { label };
}

test('single note press/release drains cleanly', () => {
  const tracker = createLiveMidiVoiceTracker();
  tracker.add('synth-a', 60, voice('c4'));
  const released = tracker.take('synth-a', 60);
  assert.equal(released?.voice.label, 'c4');
  assert.equal(tracker.size(), 0);
});

test('repeated same-note presses/releases are deterministic FIFO', () => {
  const tracker = createLiveMidiVoiceTracker();
  tracker.add('synth-a', 64, voice('first'));
  tracker.add('synth-a', 64, voice('second'));

  assert.equal(tracker.take('synth-a', 64)?.voice.label, 'first');
  assert.equal(tracker.take('synth-a', 64)?.voice.label, 'second');
  assert.equal(tracker.take('synth-a', 64), null);
  assert.equal(tracker.size(), 0);
});

test('poly chord press/release tracks notes independently', () => {
  const tracker = createLiveMidiVoiceTracker();
  tracker.add('synth-a', 60, voice('c'));
  tracker.add('synth-a', 64, voice('e'));
  tracker.add('synth-a', 67, voice('g'));

  assert.equal(tracker.take('synth-a', 64)?.voice.label, 'e');
  assert.equal(tracker.size('synth-a'), 2);
  assert.equal(tracker.take('synth-a', 60)?.voice.label, 'c');
  assert.equal(tracker.take('synth-a', 67)?.voice.label, 'g');
  assert.equal(tracker.size('synth-a'), 0);
});

test('dense simultaneous input and overlapping note-offs leaves no orphans', () => {
  const tracker = createLiveMidiVoiceTracker();
  for (let i = 0; i < 24; i += 1) tracker.add('synth-a', 48 + (i % 12), voice(`v${i}`));
  for (let i = 0; i < 24; i += 1) tracker.take('synth-a', 48 + (i % 12));
  assert.equal(tracker.size('synth-a'), 0);
  assert.equal(tracker.size(), 0);
});

test('rapid overlapping input cleanup supports panic/all-notes-off', () => {
  const tracker = createLiveMidiVoiceTracker();
  tracker.add('synth-a', 60, voice('a1'));
  tracker.add('synth-a', 60, voice('a2'));
  tracker.add('synth-a', 61, voice('a3'));
  tracker.add('synth-b', 72, voice('b1'));

  const aDrain = tracker.drainModule('synth-a');
  assert.equal(aDrain.length, 3);
  assert.equal(tracker.size('synth-a'), 0);
  assert.equal(tracker.size('synth-b'), 1);

  const all = tracker.drainAll();
  assert.equal(all.length, 1);
  assert.equal(all[0]?.voice.label, 'b1');
  assert.equal(tracker.size(), 0);
});

test('mono/poly reception semantics remain stable', () => {
  assert.deepEqual(selectNotesForReception('mono', [0, 4, 7]), [0]);
  assert.deepEqual(selectNotesForReception('poly', [0, 4, 7, 12, 16]), [0, 4, 7, 12]);
});
