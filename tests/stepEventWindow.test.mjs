import assert from 'node:assert/strict';
import { renderStepWindow } from '../src/engine/pattern/stepEventWindow.ts';
import { genStepPattern } from '../src/engine/pattern/stepPatternModule.ts';

function makeVoice(overrides = {}) {
  return {
    id: 'voice-1',
    type: 'voice',
    name: 'TEST',
    enabled: true,
    kind: 'drum',
    mode: 'step',
    seed: 12345,
    determinism: 0.8,
    gravity: 0.6,
    density: 0.5,
    subdiv: 4,
    length: 16,
    drop: 0,
    amp: 0.12,
    timbre: 0.5,
    pan: 0,
    weird: 0.5,
    euclidRot: 0,
    caRule: 90,
    caInit: 0.25,
    ...overrides,
  };
}

function eventBeats(window) {
  return window.events.map((e) => window.startBeat + e.beatOffset);
}

(function testDeterministicOutput() {
  const voice = makeVoice({ seed: 777, length: 12, density: 0.4, subdiv: 2 });
  const a = renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 1.25, endBeat: 4.25 });
  const b = renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 1.25, endBeat: 4.25 });

  assert.deepEqual(a, b, 'renderStepWindow should be deterministic for same inputs');

  const p1 = Array.from(genStepPattern(voice));
  const p2 = Array.from(genStepPattern(voice));
  assert.deepEqual(p1, p2, 'genStepPattern should be deterministic for same voice seed/params');
})();

(function testOverlappingWindowsNoDupesWithLastScheduledBeat() {
  const voice = makeVoice({ seed: 222, length: 16, density: 0.45, subdiv: 4 });
  const windows = [
    renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 0.0, endBeat: 0.6 }),
    renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 0.25, endBeat: 0.85 }),
  ];

  const eps = 1e-9;
  let lastScheduledBeat = Number.NEGATIVE_INFINITY;
  const scheduled = [];

  for (const window of windows) {
    for (const ev of window.events) {
      const beat = window.startBeat + ev.beatOffset;
      if (beat <= lastScheduledBeat + eps) continue;
      scheduled.push(beat);
      lastScheduledBeat = beat;
    }
  }

  const reference = renderStepWindow({
    voice,
    voiceId: voice.id,
    voiceIndex: 0,
    startBeat: 0.0,
    endBeat: 0.85,
  });
  const expected = eventBeats(reference);

  assert.deepEqual(scheduled, expected, 'lastScheduledBeat dedupe should match one-pass window output');

  const uniqueCount = new Set(scheduled.map((v) => v.toFixed(9))).size;
  assert.equal(uniqueCount, scheduled.length, 'scheduled beats should contain no duplicates');
})();

(function testDeterministicDropPerStepAcrossWindows() {
  const voice = makeVoice({ seed: 901, length: 16, density: 1, subdiv: 4, drop: 0.5 });
  const a = renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 2.0, endBeat: 3.0 });
  const b = renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 2.0, endBeat: 3.0 });
  assert.deepEqual(a, b, 'drop decisions should be deterministic for same window');

  const windows = [
    renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 2.0, endBeat: 2.7 }),
    renderStepWindow({ voice, voiceId: voice.id, voiceIndex: 0, startBeat: 2.3, endBeat: 3.0 }),
  ];

  const eps = 1e-9;
  let lastScheduledBeat = Number.NEGATIVE_INFINITY;
  const scheduled = [];

  for (const window of windows) {
    for (const ev of window.events) {
      const beat = window.startBeat + ev.beatOffset;
      if (beat <= lastScheduledBeat + eps) continue;
      scheduled.push(beat);
      lastScheduledBeat = beat;
    }
  }

  const reference = renderStepWindow({
    voice,
    voiceId: voice.id,
    voiceIndex: 0,
    startBeat: 2.0,
    endBeat: 3.0,
  });
  assert.deepEqual(scheduled, eventBeats(reference), 'overlap + dedupe should match single-pass dropped window');
})();

console.log('stepEventWindow tests passed');
