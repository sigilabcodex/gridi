import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyStaleRoutingCleanup,
  cleanStaleRoutingRefsIfConfirmed,
  planStaleRoutingCleanup,
} from '../src/routingGraph.ts';
import { makePatch, makeSound, makeTrigger } from './helpers.mjs';

function makeControl(overrides = {}) {
  return {
    id: 'ctl-1',
    type: 'control',
    name: 'CTL',
    enabled: true,
    kind: 'lfo',
    waveform: 'sine',
    speed: 0.3,
    amount: 0.5,
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
    kind: 'gain',
    bypass: false,
    gain: 1,
    ...overrides,
  };
}

test('cleanup removes stale legacy triggerSource references', () => {
  const sound = makeSound({ id: 'drm-1', triggerSource: 'missing-trigger' });
  const patch = makePatch([sound]);

  const plan = applyStaleRoutingCleanup(patch);

  assert.equal(plan.legacyTriggerSources.length, 1);
  assert.equal(plan.totalRemovals, 1);
  assert.equal(patch.modules[0].triggerSource, null);
});

test('cleanup removes stale legacy modulation assignments', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id, modulations: { basePitch: 'missing-control', decay: 'ctl-1' } });
  const control = makeControl({ id: 'ctl-1' });
  const patch = makePatch([trigger, sound, control]);

  const plan = applyStaleRoutingCleanup(patch);

  const cleaned = patch.modules.find((module) => module.id === sound.id);
  assert.equal(plan.legacyModulations.length, 1);
  assert.equal(plan.totalRemovals, 1);
  assert.deepEqual(cleaned.modulations, { decay: 'ctl-1' });
});

test('cleanup removes stale legacy audio connections', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  patch.connections = [
    { id: 'valid-master', fromModuleId: sound.id, fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
    { id: 'missing-source', fromModuleId: 'missing-sound', fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
    { id: 'missing-target', fromModuleId: sound.id, fromPort: 'main', to: { type: 'module', id: 'missing-fx' }, gain: 1, enabled: true },
  ];

  const plan = applyStaleRoutingCleanup(patch);

  assert.equal(plan.legacyConnections.length, 2);
  assert.equal(plan.totalRemovals, 2);
  assert.deepEqual(patch.connections.map((connection) => connection.id), ['valid-master']);
});

test('cleanup removes stale typed event routes', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  patch.routes = [
    {
      id: 'event-valid',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
    {
      id: 'event-stale-source',
      domain: 'event',
      source: { kind: 'module', moduleId: 'missing-trigger', port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
  ];

  const plan = applyStaleRoutingCleanup(patch);

  assert.equal(plan.typedRoutes.length, 1);
  assert.deepEqual(patch.routes.map((route) => route.id), ['event-valid']);
});

test('cleanup removes stale typed modulation routes', () => {
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const control = makeControl({ id: 'ctl-1' });
  const patch = makePatch([sound, control]);
  patch.routes = [
    {
      id: 'mod-valid',
      domain: 'modulation',
      source: { kind: 'module', moduleId: control.id, port: 'cv-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'cv-in' },
      enabled: true,
      metadata: { parameter: 'basePitch' },
    },
    {
      id: 'mod-stale-target',
      domain: 'modulation',
      source: { kind: 'module', moduleId: control.id, port: 'cv-out' },
      target: { kind: 'module', moduleId: 'missing-drum', port: 'cv-in' },
      enabled: true,
      metadata: { parameter: 'basePitch' },
    },
  ];

  const plan = applyStaleRoutingCleanup(patch);

  assert.equal(plan.typedRoutes.length, 1);
  assert.deepEqual(patch.routes.map((route) => route.id), ['mod-valid']);
});

test('cleanup removes stale typed audio routes', () => {
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const effect = makeEffect({ id: 'fx-1' });
  const patch = makePatch([sound, effect]);
  patch.routes = [
    {
      id: 'audio-valid',
      domain: 'audio',
      source: { kind: 'module', moduleId: sound.id, port: 'main' },
      target: { kind: 'module', moduleId: effect.id, port: 'in' },
      enabled: true,
    },
    {
      id: 'audio-stale-target',
      domain: 'audio',
      source: { kind: 'module', moduleId: sound.id, port: 'main' },
      target: { kind: 'module', moduleId: 'missing-fx', port: 'in' },
      enabled: true,
    },
  ];

  const plan = applyStaleRoutingCleanup(patch);

  assert.equal(plan.typedRoutes.length, 1);
  assert.deepEqual(patch.routes.map((route) => route.id), ['audio-valid']);
});



test('cleanup removes stale typed routes by position when route ids are duplicated', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  patch.routes = [
    {
      id: 'duplicate-id',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
    {
      id: 'duplicate-id',
      domain: 'event',
      source: { kind: 'module', moduleId: 'missing-trigger', port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
  ];

  const plan = applyStaleRoutingCleanup(patch);

  assert.deepEqual(plan.typedRoutes.map((route) => route.routeIndex), [1]);
  assert.equal(patch.routes.length, 1);
  assert.equal(patch.routes[0].id, 'duplicate-id');
  assert.equal(patch.routes[0].source.moduleId, trigger.id);
});

test('cleanup preserves valid routing references', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id, modulations: { basePitch: 'ctl-1' } });
  const control = makeControl({ id: 'ctl-1' });
  const effect = makeEffect({ id: 'fx-1' });
  const patch = makePatch([trigger, sound, control, effect]);
  patch.connections = [
    { id: 'conn-valid', fromModuleId: sound.id, fromPort: 'main', to: { type: 'module', id: effect.id }, gain: 1, enabled: true },
  ];
  patch.routes = [
    {
      id: 'evt-valid',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
    {
      id: 'mod-valid',
      domain: 'modulation',
      source: { kind: 'module', moduleId: control.id, port: 'cv-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'cv-in' },
      enabled: true,
      metadata: { parameter: 'basePitch' },
    },
    {
      id: 'aud-valid',
      domain: 'audio',
      source: { kind: 'module', moduleId: sound.id, port: 'main' },
      target: { kind: 'master', port: 'in' },
      enabled: true,
    },
  ];
  const before = structuredClone(patch);

  const plan = applyStaleRoutingCleanup(patch);

  assert.equal(plan.totalRemovals, 0);
  assert.deepEqual(patch, before);
});

test('cleanup handles mixed valid and stale references deterministically', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: 'missing-trigger', modulations: { basePitch: 'missing-control', decay: 'ctl-1' } });
  const control = makeControl({ id: 'ctl-1' });
  const patch = makePatch([trigger, sound, control]);
  patch.connections = [
    { id: 'a-valid', fromModuleId: sound.id, fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
    { id: 'b-stale', fromModuleId: 'missing-source', fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
  ];
  patch.routes = [
    {
      id: 'a-valid-route',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
    {
      id: 'b-stale-route',
      domain: 'audio',
      source: { kind: 'module', moduleId: 'missing-sound', port: 'main' },
      target: { kind: 'master', port: 'in' },
      enabled: true,
    },
  ];

  const plan = planStaleRoutingCleanup(patch);
  applyStaleRoutingCleanup(patch);

  assert.deepEqual({
    triggerSources: plan.legacyTriggerSources.map((item) => item.moduleId),
    modulations: plan.legacyModulations.map((item) => `${item.moduleId}:${item.parameter}`),
    connections: plan.legacyConnections.map((item) => item.connectionId),
    routes: plan.typedRoutes.map((item) => item.routeId),
    total: plan.totalRemovals,
  }, {
    triggerSources: ['drm-1'],
    modulations: ['drm-1:basePitch'],
    connections: ['b-stale'],
    routes: ['b-stale-route'],
    total: 4,
  });
  assert.equal(patch.modules.find((module) => module.id === sound.id).triggerSource, null);
  assert.deepEqual(patch.modules.find((module) => module.id === sound.id).modulations, { decay: 'ctl-1' });
  assert.deepEqual(patch.connections.map((connection) => connection.id), ['a-valid']);
  assert.deepEqual(patch.routes.map((route) => route.id), ['a-valid-route']);
});

test('cleanup is idempotent', () => {
  const sound = makeSound({ id: 'drm-1', triggerSource: 'missing-trigger', modulations: { basePitch: 'missing-control' } });
  const patch = makePatch([sound]);
  patch.connections = [
    { id: 'stale-conn', fromModuleId: 'missing-source', fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
  ];
  patch.routes = [
    {
      id: 'stale-route',
      domain: 'event',
      source: { kind: 'module', moduleId: 'missing-trigger', port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
  ];

  const first = applyStaleRoutingCleanup(patch);
  const afterFirst = structuredClone(patch);
  const second = applyStaleRoutingCleanup(patch);

  assert.equal(first.totalRemovals, 4);
  assert.equal(second.totalRemovals, 0);
  assert.deepEqual(patch, afterFirst);
});

test('cleanup cancellation leaves patch unchanged', () => {
  const sound = makeSound({ id: 'drm-1', triggerSource: 'missing-trigger' });
  const patch = makePatch([sound]);
  const before = structuredClone(patch);
  let sawPlan = false;

  const result = cleanStaleRoutingRefsIfConfirmed(patch, (plan) => {
    sawPlan = plan.totalRemovals === 1;
    return false;
  });

  assert.equal(sawPlan, true);
  assert.equal(result.totalRemovals, 0);
  assert.deepEqual(patch, before);
});

test('patches with no stale references remain unchanged', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  const before = structuredClone(patch);

  const planned = planStaleRoutingCleanup(patch);
  const applied = applyStaleRoutingCleanup(patch);

  assert.equal(planned.totalRemovals, 0);
  assert.equal(applied.totalRemovals, 0);
  assert.deepEqual(patch, before);
});
