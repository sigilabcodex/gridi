import assert from 'node:assert/strict';
import test from 'node:test';
import { createPatternModuleForVoice } from '../src/engine/pattern/module.ts';
import { renderStepWindow } from '../src/engine/pattern/stepEventWindow.ts';
import { absoluteBeats, makeVoice } from './helpers.mjs';

function dedupeOverlappedWindows(windows) {
  let lastScheduledBeat = Number.NEGATIVE_INFINITY;
  const eps = 1e-9;
  const scheduled = [];

  for (const window of windows) {
    for (const ev of window.events) {
      const beat = window.startBeat + ev.beatOffset;
      if (beat <= lastScheduledBeat + eps) continue;
      scheduled.push(beat);
      lastScheduledBeat = beat;
    }
  }
  return scheduled;
}

test('step event windows are deterministic and bounded', () => {
  const voice = makeVoice({ seed: 222, length: 16, density: 0.45, subdiv: 4 });
  const a = renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 0.8, endBeat: 3.9 });
  const b = renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 0.8, endBeat: 3.9 });
  assert.deepEqual(a, b);

  const beats = absoluteBeats(a);
  beats.forEach((beat, idx) => {
    assert.ok(beat >= a.startBeat - 1e-9);
    assert.ok(beat < a.endBeat + 1e-9);
    if (idx > 0) assert.ok(beat >= beats[idx - 1] - 1e-9);
  });
});

test('overlapped look-ahead windows dedupe to one-pass equivalent', () => {
  const modes = ['step', 'euclid', 'ca', 'hybrid', 'fractal'];

  for (const mode of modes) {
    const voice = makeVoice({ mode, seed: 901, length: 16, density: 0.8, drop: 0.5, weird: 0.65, caInit: 0.4 });
    const module = createPatternModuleForVoice(voice);
    const windows = [
      module.renderWindow({ voice, voiceId: voice.id, source: { type: 'self' }, startBeat: 2.0, endBeat: 2.7 }),
      module.renderWindow({ voice, voiceId: voice.id, source: { type: 'self' }, startBeat: 2.3, endBeat: 3.0 }),
    ];
    const scheduled = dedupeOverlappedWindows(windows);
    const reference = module.renderWindow({ voice, voiceId: voice.id, source: { type: 'self' }, startBeat: 2.0, endBeat: 3.0 });

    assert.deepEqual(scheduled, absoluteBeats(reference));
    assert.equal(new Set(scheduled.map((n) => n.toFixed(9))).size, scheduled.length);
  }
});
