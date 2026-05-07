import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampMidiNoteNumber,
  makeNoteOffMessage,
  makeNoteOnMessage,
  midiNoteFromGridiEvent,
  midiOutRoutesForSource,
  normalizeMidiChannel,
  normalizeMidiGateMs,
  normalizeMidiVelocity,
} from '../src/engine/midiOut.ts';
import { makePatch, makeTrigger } from './helpers.mjs';

test('MIDI note-on message bytes use normalized channel, note, and velocity', () => {
  assert.deepEqual(makeNoteOnMessage(60, 100, 1), [0x90, 60, 100]);
  assert.deepEqual(makeNoteOnMessage(61.4, 0.5, 16), [0x9f, 61, 64]);
});

test('MIDI note-off message bytes use note-off status and zero velocity', () => {
  assert.deepEqual(makeNoteOffMessage(64, 2), [0x81, 64, 0]);
});

test('MIDI channel, note, velocity, and gate normalization clamp to safe ranges', () => {
  assert.equal(normalizeMidiChannel(-1), 1);
  assert.equal(normalizeMidiChannel(99), 16);
  assert.equal(clampMidiNoteNumber(-10), 0);
  assert.equal(clampMidiNoteNumber(140), 127);
  assert.equal(normalizeMidiVelocity(0), 1);
  assert.equal(normalizeMidiVelocity(2), 2);
  assert.equal(normalizeMidiVelocity(999), 127);
  assert.equal(normalizeMidiGateMs(-10), 1);
  assert.equal(normalizeMidiGateMs(20000), 10000);
});

test('event-to-MIDI-note mapping uses tonal offsets, drum lanes, and fallback base note', () => {
  assert.equal(midiNoteFromGridiEvent({ kind: 'note', timeSec: 1, velocity: 0.8, notes: [7.2] }, 60), 67);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, lane: 'low' }, 60), 36);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8 }, 64), 64);
});

test('MIDI Out route filtering only returns enabled module-to-external MIDI routes for source', () => {
  const trigger = makeTrigger({ id: 'gen-a' });
  const other = makeTrigger({ id: 'gen-b' });
  const patch = makePatch([trigger, other]);
  patch.routes = [
    {
      id: 'midi-out-a',
      domain: 'midi',
      source: { kind: 'module', moduleId: 'gen-a', port: 'trigger-out' },
      target: { kind: 'external', externalType: 'midi', portId: 'out-1', channel: 3 },
      enabled: true,
      metadata: { midiBaseNote: 62, midiGateMs: 240, midiOutputName: 'Loopback' },
    },
    {
      id: 'midi-in-ignored',
      domain: 'midi',
      source: { kind: 'external', externalType: 'midi', portId: 'in-1' },
      target: { kind: 'module', moduleId: 'gen-a', port: 'midi-in' },
      enabled: true,
    },
    {
      id: 'midi-out-other',
      domain: 'midi',
      source: { kind: 'module', moduleId: 'gen-b', port: 'trigger-out' },
      target: { kind: 'external', externalType: 'midi', portId: 'out-2' },
      enabled: true,
    },
  ];

  assert.deepEqual(midiOutRoutesForSource(patch, 'gen-a').map((route) => ({
    outputId: route.outputId,
    outputName: route.outputName,
    channel: route.channel,
    baseNote: route.baseNote,
    gateMs: route.gateMs,
  })), [{ outputId: 'out-1', outputName: 'Loopback', channel: 3, baseNote: 62, gateMs: 240 }]);
});

import { createScheduler } from '../src/engine/scheduler.ts';
import { makeSound } from './helpers.mjs';

function withWindowTimer(fn) {
  const prevWindow = globalThis.window;
  let intervalFn = null;
  globalThis.window = { setInterval: (cb) => (intervalFn = cb, 1), clearInterval: () => {} };
  try { return fn(() => intervalFn && intervalFn()); } finally { globalThis.window = prevWindow; }
}

test('scheduler observer receives scheduled events without changing triggerVoice dispatch', () => {
  const trigger = makeTrigger({ id: 'observer-gen', seed: 4, density: 1, drop: 0, subdiv: 4, length: 8, mode: 'step' });
  const sound = makeSound({ id: 'observer-sound', triggerSource: trigger.id });
  const patch = makePatch([sound, trigger]);
  const triggered = [];
  const observed = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (id, _patch, when, event) => triggered.push({ id, when, event }) };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setScheduledEventObserver((event) => observed.push(event));
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    engine.ctx.currentTime = 0;
    tick();
    scheduler.stop();
  });

  assert.ok(triggered.length > 0);
  assert.equal(observed.length, triggered.length);
  assert.equal(observed[0].source.id, trigger.id);
  assert.equal(observed[0].target.id, sound.id);
  assert.equal(observed[0].timeSec, triggered[0].when);
  assert.deepEqual(observed[0].triggerEvent, triggered[0].event);
});
