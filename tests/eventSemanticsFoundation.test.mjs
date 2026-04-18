import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '../src/engine/scheduler.ts';
import { migratePatch } from '../src/patch.ts';
import { laneRoleFromPatternEvent, noteOffsetsFromPatternEvent, selectNotesForReception, tonalValueFromPatternEvent } from '../src/engine/events.ts';
import { createPatternModuleForTrigger } from '../src/engine/pattern/module.ts';

function withWindowTimer(fn) {
  const prevWindow = globalThis.window;
  let intervalFn = null;
  globalThis.window = { setInterval: (cb) => (intervalFn = cb, 1), clearInterval: () => {} };
  try { return fn(() => intervalFn && intervalFn()); } finally { globalThis.window = prevWindow; }
}

test('scheduler emits drum semantic events with lane roles', () => {
  const patch = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [
      { id: 'trg-1', type: 'trigger', name: 'TRG', enabled: true, mode: 'step', seed: 5, determinism: 0.8, gravity: 0.6, density: 0.8, subdiv: 4, length: 16, drop: 0, weird: 0.5, euclidRot: 0, caRule: 90, caInit: 0.25 },
      { id: 'drm-1', type: 'drum', name: 'DRM', enabled: true, triggerSource: 'trg-1', amp: 0.2, pan: 0 },
    ],
    buses: [],
    connections: [],
  });

  const triggered = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (_id, _patch, _when, event) => triggered.push(event) };
  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    engine.ctx.currentTime = 0;
    tick();
    scheduler.stop();
  });

  assert.ok(triggered.length > 0);
  for (const event of triggered) {
    assert.equal(event.kind, 'drum');
    assert.ok(['low', 'mid', 'high', 'accent'].includes(event.lane));
    assert.equal(typeof event.velocity, 'number');
  }
  assert.ok(new Set(triggered.map((event) => event.lane)).size > 1);
});

test('note semantics are deterministic and preserve scalar-compatible primary note', () => {
  const trigger = {
    id: 'trg-1',
    type: 'trigger',
    name: 'TRG',
    enabled: true,
    mode: 'fractal',
    seed: 14,
    determinism: 0.8,
    gravity: 0.6,
    density: 0.7,
    subdiv: 4,
    length: 16,
    drop: 0,
    weird: 0.5,
    euclidRot: 0,
    caRule: 90,
    caInit: 0.25,
  };
  const window = createPatternModuleForTrigger(trigger).renderWindow({ trigger, voiceId: 'ton-1', startBeat: 0, endBeat: 0.5 });
  assert.ok(window.events.length > 0);
  const event = window.events[0];
  const notesA = noteOffsetsFromPatternEvent(event, trigger);
  const notesB = noteOffsetsFromPatternEvent(event, trigger);
  assert.deepEqual(notesA, notesB);

  const normalized = tonalValueFromPatternEvent(event, trigger);
  const scalarCompatiblePrimary = (normalized - 0.5) * 14;
  assert.ok(Math.abs(notesA[0] - scalarCompatiblePrimary) < 1e-9);
});

test('mono/poly reception policy selects notes safely and deterministically', () => {
  const notes = [1, 4, 7, 11, 14];
  assert.deepEqual(selectNotesForReception('mono', notes), [1]);
  assert.deepEqual(selectNotesForReception('poly', notes), [1, 4, 7, 11]);
  assert.deepEqual(selectNotesForReception('poly', []), [0]);
});
