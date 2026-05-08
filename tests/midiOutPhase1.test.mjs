import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampMidiNoteNumber,
  makeAllNotesOffMessage,
  makeMidiPanicMessages,
  makeMidiTestNoteMessages,
  gridiEventFromPatternEventForMidiRoute,
  makeNoteOffMessage,
  makeNoteOnMessage,
  midiDrumNoteFromLaneIndex,
  midiNoteFromGridiEvent,
  midiOutRoutesForSource,
  normalizeMidiChannel,
  normalizeMidiDrumMapPreset,
  normalizeMidiGateMs,
  normalizeMidiMapMode,
  normalizeMidiVelocity,
  normalizeMidiVelocityScale,
  resolveMidiNoteFromGridiEvent,
} from '../src/engine/midiOut.ts';
import { normalizePatchRoutes } from '../src/routingGraph.ts';
import { makePatch, makeTrigger } from './helpers.mjs';

test('MIDI note-on message bytes use normalized channel, note, and velocity', () => {
  assert.deepEqual(makeNoteOnMessage(60, 100, 1), [0x90, 60, 100]);
  assert.deepEqual(makeNoteOnMessage(61.4, 0.5, 16), [0x9f, 61, 64]);
});

test('MIDI note-off and all-notes-off message bytes use the selected channel', () => {
  assert.deepEqual(makeNoteOffMessage(64, 2), [0x81, 64, 0]);
  assert.deepEqual(makeAllNotesOffMessage(4), [0xb3, 123, 0]);
});

test('MIDI panic helper sends a bounded note-off sweep and all-notes-off', () => {
  const messages = makeMidiPanicMessages({ channel: 3 });
  assert.equal(messages.length, 129);
  assert.deepEqual(messages[0], [0x82, 0, 0]);
  assert.deepEqual(messages[127], [0x82, 127, 0]);
  assert.deepEqual(messages[128], [0xb2, 123, 0]);
  assert.deepEqual(makeMidiPanicMessages({ channel: 3, includeAllNotesOff: false }).at(-1), [0x82, 127, 0]);
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
  assert.equal(normalizeMidiVelocityScale(-0.5), 0);
  assert.equal(normalizeMidiVelocityScale(2), 1);
});

test('MIDI test note messages use selected mapping values', () => {
  assert.deepEqual(makeMidiTestNoteMessages({ baseNote: 64, velocityScale: 0.5, channel: 3 }), {
    noteOn: [0x92, 64, 64],
    noteOff: [0x82, 64, 0],
    note: 64,
    velocity: 64,
    channel: 3,
  });
});

test('event-to-MIDI-note mapping keeps melodic mode on base-note behavior', () => {
  assert.equal(midiNoteFromGridiEvent({ kind: 'note', timeSec: 1, velocity: 0.8, notes: [7.2] }, 60), 67);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, lane: 'low' }, 60), 60);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8 }, 64), 64);
});

test('GM Basic drum map mode maps expected lanes to notes and falls back to base note', () => {
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 0 }, 60, 'drum'), 36);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 1 }, 60, 'drum'), 38);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 2 }, 60, 'drum'), 42);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 3 }, 60, 'drum'), 46);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 4 }, 60, 'drum'), 49);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 5 }, 60, 'drum'), 45);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 6 }, 60, 'drum'), 47);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 7 }, 60, 'drum'), 50);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, lane: 'accent' }, 60, 'drum'), 46);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8 }, 64, 'drum'), 64);
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
      metadata: { midiBaseNote: 62, midiGateMs: 240, midiVelocityScale: 0.5, midiOutputName: 'Loopback' },
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
    velocityScale: route.velocityScale,
    mapMode: route.mapMode,
    drumMapPreset: route.drumMapPreset,
  })), [{ outputId: 'out-1', outputName: 'Loopback', channel: 3, baseNote: 62, gateMs: 240, velocityScale: 0.5, mapMode: 'melodic', drumMapPreset: 'gm-basic' }]);
});

test('old MIDI routes without mapping metadata load with Phase 1.2 defaults', () => {
  const trigger = makeTrigger({ id: 'gen-defaults' });
  const patch = makePatch([trigger]);
  patch.routes = [{
    id: 'old-midi-out',
    domain: 'midi',
    source: { kind: 'module', moduleId: 'gen-defaults', port: 'trigger-out' },
    target: { kind: 'external', externalType: 'midi', portId: 'out-old' },
    enabled: true,
  }];

  assert.deepEqual(midiOutRoutesForSource(patch, 'gen-defaults').map((route) => ({
    channel: route.channel,
    baseNote: route.baseNote,
    gateMs: route.gateMs,
    velocityScale: route.velocityScale,
    mapMode: route.mapMode,
    drumMapPreset: route.drumMapPreset,
  })), [{ channel: 1, baseNote: 60, gateMs: 120, velocityScale: 1, mapMode: 'melodic', drumMapPreset: 'gm-basic' }]);
});

test('MIDI route metadata normalization safely clamps Phase 1.2 mapping values', () => {
  const trigger = makeTrigger({ id: 'gen-clamped' });
  const patch = makePatch([trigger]);
  patch.routes = [{
    id: 'clamped-midi-out',
    domain: 'midi',
    source: { kind: 'module', moduleId: 'gen-clamped', port: 'trigger-out' },
    target: { kind: 'external', externalType: 'midi', portId: 'out-clamped', channel: 99 },
    enabled: true,
    metadata: { midiBaseNote: 140, midiGateMs: -20, midiVelocityScale: 2, midiMapMode: 'drum' },
  }];

  const [route] = normalizePatchRoutes(patch);
  assert.equal(route.target.kind === 'external' ? route.target.channel : null, undefined);
  assert.equal(route.metadata.midiBaseNote, 127);
  assert.equal(route.metadata.midiGateMs, 1);
  assert.equal(route.metadata.midiVelocityScale, 1);
  assert.equal(route.metadata.midiMapMode, 'drum');

  assert.deepEqual(midiOutRoutesForSource({ ...patch, routes: [route] }, 'gen-clamped').map((midiRoute) => ({
    channel: midiRoute.channel,
    baseNote: midiRoute.baseNote,
    gateMs: midiRoute.gateMs,
    velocityScale: midiRoute.velocityScale,
    mapMode: midiRoute.mapMode,
    drumMapPreset: midiRoute.drumMapPreset,
  })), [{ channel: 1, baseNote: 127, gateMs: 1, velocityScale: 1, mapMode: 'drum', drumMapPreset: 'gm-basic' }]);
});

test('MIDI event mapping respects route channel, base note, gate, velocity scale, and map mode', () => {
  const trigger = makeTrigger({ id: 'gen-map' });
  const patch = makePatch([trigger]);
  patch.routes = [{
    id: 'mapped-midi-out',
    domain: 'midi',
    source: { kind: 'module', moduleId: 'gen-map', port: 'trigger-out' },
    target: { kind: 'external', externalType: 'midi', portId: 'out-map', channel: 4 },
    enabled: true,
    metadata: { midiBaseNote: 65, midiGateMs: 90, midiVelocityScale: 0.25, midiMapMode: 'drum' },
  }];

  const [route] = midiOutRoutesForSource(patch, 'gen-map');
  const event = { kind: 'note', timeSec: 1, velocity: 0.8, notes: [2] };
  assert.equal(midiNoteFromGridiEvent(event, route.baseNote, 'melodic'), 67);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 1 }, route.baseNote, route.mapMode), 38);
  assert.equal(normalizeMidiVelocity(event.velocity * route.velocityScale), 25);
  assert.equal(route.channel, 4);
  assert.equal(route.gateMs, 90);
  assert.equal(route.mapMode, 'drum');
});

test('MIDI map mode normalization defaults old metadata to melodic', () => {
  assert.equal(normalizeMidiMapMode(undefined), 'melodic');
  assert.equal(normalizeMidiMapMode('drum'), 'drum');
  assert.equal(normalizeMidiMapMode('other'), 'melodic');
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


test('Chromatic from Base maps lane to base plus lane', () => {
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 0 }, 60, 'drum', 'chromatic-base'), 60);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 7 }, 60, 'drum', 'chromatic-base'), 67);
  assert.equal(midiDrumNoteFromLaneIndex(70, 80, 'chromatic-base'), 127);
});

test('Low-kit and cymbal-test drum maps return expected notes', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((lane) => midiDrumNoteFromLaneIndex(lane, 60, 'low-kit')), [35, 36, 38, 40, 41, 43, 42, 39]);
  assert.deepEqual([0, 1, 2, 3, 4].map((lane) => midiDrumNoteFromLaneIndex(lane, 60, 'cymbal-test')), [42, 44, 46, 49, 51]);
});

test('Single-base drum map always returns base note', () => {
  assert.equal(midiDrumNoteFromLaneIndex(0, 64, 'single-base'), 64);
  assert.equal(midiDrumNoteFromLaneIndex(7, 64, 'single-base'), 64);
  assert.equal(midiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8, laneIndex: 3 }, 64, 'drum', 'single-base'), 64);
});

test('Missing drum lane/index fallback is explicit in diagnostics', () => {
  assert.deepEqual(resolveMidiNoteFromGridiEvent({ kind: 'drum', timeSec: 1, velocity: 0.8 }, 64, 'drum', 'gm-basic'), {
    note: 64,
    source: 'fallback-base',
    laneIndex: null,
    laneRole: null,
    drumMapPreset: 'gm-basic',
  });
});

test('MIDI drum map preset normalization defaults old metadata safely', () => {
  assert.equal(normalizeMidiDrumMapPreset(undefined), 'gm-basic');
  assert.equal(normalizeMidiDrumMapPreset('chromatic-base'), 'chromatic-base');
  assert.equal(normalizeMidiDrumMapPreset('unknown'), 'gm-basic');
});


test('GEN stream observer emits when local voice target is disabled', () => {
  const trigger = makeTrigger({ id: 'gen-independent', seed: 4, density: 1, drop: 0, subdiv: 4, length: 8, mode: 'step' });
  const mutedSound = makeSound({ id: 'muted-local-voice', triggerSource: trigger.id, enabled: false });
  const patch = makePatch([mutedSound, trigger]);
  const triggered = [];
  const generated = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: (id, _patch, when, event) => triggered.push({ id, when, event }) };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setGeneratedEventObserver((event) => generated.push(event));
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    engine.ctx.currentTime = 0;
    tick();
    scheduler.stop();
  });

  assert.equal(triggered.length, 0);
  assert.ok(generated.length > 0);
  assert.equal(generated[0].source.id, trigger.id);
});

test('multiple local voices on same GEN do not duplicate GEN-stream MIDI events', () => {
  const trigger = makeTrigger({ id: 'gen-no-dup', seed: 4, density: 1, drop: 0, subdiv: 4, length: 8, mode: 'step' });
  const soundA = makeSound({ id: 'voice-a', triggerSource: trigger.id });
  const soundB = makeSound({ id: 'voice-b', triggerSource: trigger.id, basePitch: 0.75 });
  const patch = makePatch([soundA, soundB, trigger]);
  const generated = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: () => {} };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setGeneratedEventObserver((event) => generated.push(event));
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    engine.ctx.currentTime = 0;
    tick();
    scheduler.stop();
  });

  const keys = generated.map((event) => `${event.source.id}:${event.timeSec.toFixed(6)}:${event.patternEvent.targetLane ?? 'x'}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(generated.length > 0);
  assert.ok(generated.every((event) => event.source.id === trigger.id));
});

test('deleting local voices does not break GEN-stream MIDI output while GEN source exists', () => {
  const trigger = makeTrigger({ id: 'gen-without-voices', seed: 4, density: 1, drop: 0, subdiv: 4, length: 8, mode: 'step' });
  const patch = makePatch([trigger]);
  const generated = [];
  const engine = { ctx: { currentTime: 0 }, triggerVoice: () => { throw new Error('local voice should not be required'); } };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setGeneratedEventObserver((event) => generated.push(event));
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    engine.ctx.currentTime = 0;
    tick();
    scheduler.stop();
  });

  assert.ok(generated.length > 0);
  assert.equal(generated[0].source.id, trigger.id);
});

test('GEN-stream mapping does not imply post-voice mirror semantics', () => {
  const trigger = makeTrigger({ id: 'gen-map-stream' });
  const patternEvent = { voiceId: trigger.id, beatOffset: 0, value: 0.75, targetLane: 2 };
  const melodic = gridiEventFromPatternEventForMidiRoute({ patternEvent, trigger, timeSec: 1, mapMode: 'melodic' });
  const drum = gridiEventFromPatternEventForMidiRoute({ patternEvent, trigger, timeSec: 1, mapMode: 'drum' });

  assert.equal(melodic.kind, 'note');
  assert.equal(drum.kind, 'drum');
  assert.equal(drum.laneIndex, 2);
  assert.equal(midiNoteFromGridiEvent(melodic, 60, 'melodic') !== midiNoteFromGridiEvent(drum, 60, 'drum'), true);
});
