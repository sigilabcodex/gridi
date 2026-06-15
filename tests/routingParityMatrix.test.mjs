import assert from 'node:assert/strict';
import test from 'node:test';

import { validateConnections } from '../src/engine/routing.ts';
import { createScheduler } from '../src/engine/scheduler.ts';
import { compileRoutingGraph, validatePatchRouting } from '../src/routingGraph.ts';
import { buildRoutingSnapshot } from '../src/ui/routingVisibility.ts';
import { makePatch, makeSound, makeTrigger } from './helpers.mjs';

function makeControl(overrides = {}) {
  return {
    id: 'ctl-1',
    type: 'control',
    name: 'CTL',
    enabled: true,
    kind: 'lfo',
    waveform: 'square',
    speed: 0.1,
    amount: 1,
    phase: 0,
    rate: 0.4,
    drift: 0.2,
    randomness: 0.2,
    ...overrides,
  };
}

function makeEffect(overrides = {}) {
  return {
    id: 'fx-1',
    type: 'effect',
    name: 'FX',
    enabled: true,
    effectType: 'filter',
    mix: 0.5,
    drive: 0.2,
    cutoff: 0.6,
    resonance: 0.2,
    ...overrides,
  };
}

function eventRoute(id, sourceId, targetId) {
  return {
    id,
    domain: 'event',
    source: { kind: 'module', moduleId: sourceId, port: 'trigger-out' },
    target: { kind: 'module', moduleId: targetId, port: 'trigger-in' },
    enabled: true,
    metadata: { createdFrom: 'ui' },
  };
}

function modulationRoute(id, sourceId, targetId, parameter) {
  return {
    id,
    domain: 'modulation',
    source: { kind: 'module', moduleId: sourceId, port: 'cv-out' },
    target: { kind: 'module', moduleId: targetId, port: 'cv-in' },
    enabled: true,
    metadata: { createdFrom: 'ui', parameter },
  };
}

function audioRoute(id, sourceId, target) {
  return {
    id,
    domain: 'audio',
    source: { kind: 'module', moduleId: sourceId, port: 'main' },
    target,
    enabled: true,
    gain: 0.75,
    metadata: { createdFrom: 'ui' },
  };
}

function withWindowTimer(fn) {
  const prevWindow = globalThis.window;
  let intervalFn = null;
  globalThis.window = { setInterval: (cb) => (intervalFn = cb, 1), clearInterval: () => {} };
  try { return fn(() => intervalFn && intervalFn()); } finally { globalThis.window = prevWindow; }
}

function runScheduler(patch, times = [0, 0.025, 0.05, 0.075, 0.1]) {
  const triggered = [];
  const engine = {
    ctx: { currentTime: 0, state: 'running' },
    setTransportRunning: () => {},
    triggerVoice: (id, _patch, when) => triggered.push({ id, when }),
  };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of times) {
      engine.ctx.currentTime = t;
      tick();
    }
    scheduler.stop();
  });

  return triggered;
}

test('parity matrix: legacy event routing only is compiled, visible, and scheduled from triggerSource', () => {
  const trigger = makeTrigger({ id: 'trg-legacy', density: 1, drop: 0, length: 8 });
  const sound = makeSound({ id: 'drm-legacy', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);
  const triggered = runScheduler(patch);

  assert.equal(compiled.eventSourceBySoundId.get(sound.id), trigger.id);
  assert.equal(compiled.routes[0].metadata.createdFrom, 'legacy-triggerSource');
  assert.equal(snapshot.voiceIncoming.get(sound.id).trigger.id, trigger.id);
  assert.ok(triggered.some((ev) => ev.id === sound.id));
});

test('parity matrix: typed event routing only is compiled, visible, and scheduled without triggerSource', () => {
  const trigger = makeTrigger({ id: 'trg-typed', density: 1, drop: 0, length: 8 });
  const sound = makeSound({ id: 'drm-typed', triggerSource: null });
  const patch = makePatch([trigger, sound]);
  patch.routes = [eventRoute('evt-typed', trigger.id, sound.id)];

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);
  const triggered = runScheduler(patch);

  assert.equal(compiled.eventSourceBySoundId.get(sound.id), trigger.id);
  assert.equal(compiled.routes[0].id, 'evt-typed');
  assert.equal(snapshot.voiceIncoming.get(sound.id).trigger.id, trigger.id);
  assert.ok(triggered.some((ev) => ev.id === sound.id));
});

test('parity matrix: simultaneous legacy triggerSource and typed event route uses typed event in graph and scheduler', () => {
  const legacyTrigger = makeTrigger({ id: 'trg-legacy', density: 1, drop: 0, length: 8 });
  const typedTrigger = makeTrigger({ id: 'trg-typed', density: 1, drop: 0, length: 8 });
  const sound = makeSound({ id: 'drm-hybrid', triggerSource: legacyTrigger.id });
  const patch = makePatch([legacyTrigger, typedTrigger, sound]);
  patch.routes = [eventRoute('evt-typed', typedTrigger.id, sound.id)];

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);
  const observed = [];
  const engine = {
    ctx: { currentTime: 0, state: 'running' },
    setTransportRunning: () => {},
    triggerVoice: () => {},
  };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setScheduledEventObserver((ev) => observed.push({ sourceId: ev.source.id, targetId: ev.target.id }));
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of [0, 0.025, 0.05, 0.075]) {
      engine.ctx.currentTime = t;
      tick();
    }
    scheduler.stop();
  });

  assert.equal(compiled.eventSourceBySoundId.get(sound.id), typedTrigger.id);
  assert.equal(compiled.triggerTargets.has(legacyTrigger.id), false);
  assert.equal(snapshot.voiceIncoming.get(sound.id).trigger.id, typedTrigger.id);
  assert.ok(observed.some((ev) => ev.sourceId === typedTrigger.id && ev.targetId === sound.id));
  assert.equal(observed.some((ev) => ev.sourceId === legacyTrigger.id), false);
});

test('parity matrix: partial typed adoption is per domain in graph, while scheduler still falls back per sound', () => {
  const triggerA = makeTrigger({ id: 'trg-a', density: 1, drop: 0, length: 8 });
  const triggerB = makeTrigger({ id: 'trg-b', density: 1, drop: 0, length: 8 });
  const control = makeControl({ id: 'ctl-legacy' });
  const routedSound = makeSound({ id: 'drm-routed', triggerSource: triggerA.id, modulations: { basePitch: control.id } });
  const legacyOnlySound = makeSound({ id: 'drm-legacy-only', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, control, routedSound, legacyOnlySound]);
  patch.connections = [
    { id: 'conn-legacy', fromModuleId: legacyOnlySound.id, fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
  ];
  patch.routes = [eventRoute('evt-partial', triggerB.id, routedSound.id)];

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);
  const triggered = runScheduler(patch);

  assert.equal(compiled.eventSourceBySoundId.get(routedSound.id), triggerB.id);
  assert.equal(compiled.eventSourceBySoundId.has(legacyOnlySound.id), false);
  assert.deepEqual(compiled.modulationIncomingByTarget.get(routedSound.id), [{ parameter: 'basePitch', sourceId: control.id }]);
  assert.equal(compiled.audioConnections[0].id, 'audio:conn-legacy');
  assert.equal(snapshot.voiceIncoming.get(legacyOnlySound.id).trigger, null);
  assert.ok(triggered.some((ev) => ev.id === routedSound.id));
  assert.ok(triggered.some((ev) => ev.id === legacyOnlySound.id));
});

test('parity matrix: multiple typed event routes into one sound are visible as many routes but first source wins for runtime', () => {
  const triggerA = makeTrigger({ id: 'trg-a', density: 1, drop: 0, length: 8 });
  const triggerB = makeTrigger({ id: 'trg-b', density: 1, drop: 0, length: 8 });
  const sound = makeSound({ id: 'drm-target', triggerSource: null });
  const patch = makePatch([triggerA, triggerB, sound]);
  patch.routes = [
    eventRoute('evt-a', triggerA.id, sound.id),
    eventRoute('evt-b', triggerB.id, sound.id),
  ];

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);
  const observed = [];
  const engine = {
    ctx: { currentTime: 0, state: 'running' },
    setTransportRunning: () => {},
    triggerVoice: () => {},
  };

  withWindowTimer((tick) => {
    const scheduler = createScheduler(engine);
    scheduler.setScheduledEventObserver((ev) => observed.push(ev.source.id));
    scheduler.setBpm(120);
    scheduler.setPatch(patch);
    scheduler.start();
    for (const t of [0, 0.025, 0.05, 0.075]) {
      engine.ctx.currentTime = t;
      tick();
    }
    scheduler.stop();
  });

  assert.equal(compiled.routes.filter((route) => route.domain === 'event').length, 2);
  assert.equal(compiled.eventSourceBySoundId.get(sound.id), triggerA.id);
  assert.deepEqual(compiled.triggerTargets.get(triggerA.id), [sound.id]);
  assert.deepEqual(compiled.triggerTargets.get(triggerB.id), [sound.id]);
  assert.equal(snapshot.voiceIncoming.get(sound.id).trigger.id, triggerA.id);
  assert.ok(observed.length > 0);
  assert.ok(observed.every((sourceId) => sourceId === triggerA.id));
});

test('parity matrix: multiple sources targeting one modulation parameter keep first compiled owner and warn', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const controlA = makeControl({ id: 'ctl-a' });
  const controlB = makeControl({ id: 'ctl-b' });
  const patch = makePatch([trigger, sound, controlA, controlB]);
  patch.routes = [
    modulationRoute('mod-a', controlA.id, sound.id, 'basePitch'),
    modulationRoute('mod-b', controlB.id, sound.id, 'basePitch'),
  ];

  const compiled = compileRoutingGraph(patch);
  assert.deepEqual(compiled.modulationIncomingByTarget.get(sound.id), [{ parameter: 'basePitch', sourceId: controlA.id }]);
  assert.equal(compiled.warnings.some((warning) => warning.includes('already controlled by ctl-a')), true);
});

test('parity matrix: legacy modulation only is compiled and visible from target-owned modulations', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const control = makeControl({ id: 'ctl-legacy' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id, modulations: { basePitch: control.id } });
  const patch = makePatch([trigger, control, sound]);

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);

  assert.deepEqual(compiled.modulationIncomingByTarget.get(sound.id), [{ parameter: 'basePitch', sourceId: control.id }]);
  assert.equal(compiled.routes.find((route) => route.domain === 'modulation').metadata.createdFrom, 'legacy-modulations');
  assert.equal(snapshot.voiceIncoming.get(sound.id).modulations[0].source.id, control.id);
});

test('parity matrix: typed modulation only is compiled and visible but scheduler density modulation remains legacy-owned', () => {
  const trigger = makeTrigger({ id: 'trg-1', density: 0, drop: 0, length: 8, modulations: {} });
  const control = makeControl({ id: 'ctl-typed', waveform: 'square', amount: 1, phase: 0 });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, control, sound]);
  patch.routes = [modulationRoute('mod-density', control.id, trigger.id, 'density')];

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);
  const triggered = runScheduler(patch);

  assert.deepEqual(compiled.modulationIncomingByTarget.get(trigger.id), [{ parameter: 'density', sourceId: control.id }]);
  assert.equal(snapshot.triggerIncoming.get(trigger.id)[0].source.id, control.id);
  assert.deepEqual(triggered, []);
});

test('parity matrix: simultaneous legacy and typed modulation shows typed route while runtime still reads legacy modulations', () => {
  const trigger = makeTrigger({ id: 'trg-1', density: 0, drop: 0, length: 8, modulations: { density: 'ctl-legacy' } });
  const legacyControl = makeControl({ id: 'ctl-legacy', waveform: 'square', amount: 1, phase: 0 });
  const typedControl = makeControl({ id: 'ctl-typed', waveform: 'sine', amount: 0, phase: 0 });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, legacyControl, typedControl, sound]);
  patch.routes = [modulationRoute('mod-density', typedControl.id, trigger.id, 'density')];

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);
  const triggered = runScheduler(patch);

  assert.deepEqual(compiled.modulationIncomingByTarget.get(trigger.id), [{ parameter: 'density', sourceId: typedControl.id }]);
  assert.equal(snapshot.triggerIncoming.get(trigger.id)[0].source.id, typedControl.id);
  assert.ok(triggered.some((ev) => ev.id === sound.id));
});

test('parity matrix: legacy audio connections only are compiled to legacy audio routes and accepted by runtime validation', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  patch.connections = [
    { id: 'conn-legacy', fromModuleId: sound.id, fromPort: 'main', to: { type: 'master' }, gain: 0.6, enabled: true },
  ];

  const compiled = compileRoutingGraph(patch);
  const validation = validateConnections({ ...patch, connections: compiled.audioConnections });

  assert.equal(compiled.audioConnections[0].id, 'audio:conn-legacy');
  assert.equal(compiled.routes.find((route) => route.domain === 'audio').metadata.createdFrom, 'legacy-connections');
  assert.equal(validation.validConnections.length, 1);
});

test('parity matrix: typed audio routes only compile to runtime connection records', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  patch.routes = [audioRoute('aud-typed', sound.id, { kind: 'master', port: 'in' })];

  const compiled = compileRoutingGraph(patch);
  const snapshot = buildRoutingSnapshot(patch);
  const validation = validateConnections({ ...patch, connections: compiled.audioConnections });

  assert.deepEqual(compiled.audioConnections, [
    { id: 'aud-typed', fromModuleId: sound.id, fromPort: 'main', to: { type: 'master', port: 'in' }, gain: 0.75, enabled: true },
  ]);
  assert.equal(snapshot.overview.audioRoutes[0].id, 'aud-typed');
  assert.equal(validation.validConnections.length, 1);
});

test('parity matrix: simultaneous legacy and typed audio routing uses typed audio for compiled/runtime graph', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const effect = makeEffect({ id: 'fx-1' });
  const patch = makePatch([trigger, sound, effect]);
  patch.connections = [
    { id: 'conn-legacy', fromModuleId: sound.id, fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
  ];
  patch.routes = [audioRoute('aud-typed', sound.id, { kind: 'module', moduleId: effect.id, port: 'in' })];

  const compiled = compileRoutingGraph(patch);
  const validation = validateConnections({ ...patch, connections: compiled.audioConnections });

  assert.deepEqual(compiled.audioConnections.map((conn) => conn.id), ['aud-typed']);
  assert.deepEqual(compiled.audioConnections[0].to, { type: 'module', id: effect.id, port: 'in' });
  assert.equal(validation.validConnections.length, 1);
});

test('parity matrix: bus endpoints can compile when present but remain unsupported by runtime audio validation', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  patch.buses = [{ id: 'bus-1', name: 'Bus 1', enabled: true, gain: 1 }];
  patch.routes = [audioRoute('aud-bus', sound.id, { kind: 'bus', busId: 'bus-1', port: 'in' })];

  const compiled = compileRoutingGraph(patch);
  const validation = validateConnections({ ...patch, connections: compiled.audioConnections });

  assert.deepEqual(compiled.audioConnections[0].to, { type: 'bus', id: 'bus-1', port: 'in' });
  assert.deepEqual(validation.validConnections, []);
  assert.equal(validation.warnings.some((warning) => warning.includes('bus routing is not currently supported')), true);
});

test('parity matrix: missing bus endpoints are rejected before graph/runtime use', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  patch.routes = [audioRoute('aud-missing-bus', sound.id, { kind: 'bus', busId: 'missing-bus', port: 'in' })];

  const compiled = compileRoutingGraph(patch);
  const validation = validatePatchRouting(patch);

  assert.equal(compiled.audioConnections.length, 0);
  assert.equal(compiled.warnings.some((warning) => warning.includes('missing target bus: missing-bus')), true);
  assert.equal(validation.issues.some((issue) => issue.code === 'route-missing-target-bus'), true);
});
