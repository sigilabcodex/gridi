import assert from 'node:assert/strict';
import test from 'node:test';
import { compileRoutingGraph } from '../src/routingGraph.ts';
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

test('legacy-only patch resolves event/modulation/audio routes', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id, modulations: { basePitch: 'ctl-1' } });
  const control = makeControl({ id: 'ctl-1' });
  const patch = makePatch([trigger, sound, control]);
  patch.connections = [
    { id: 'conn-1', fromModuleId: sound.id, fromPort: 'main', to: { type: 'master' }, gain: 0.7, enabled: true },
  ];

  const compiled = compileRoutingGraph(patch);
  assert.equal(compiled.eventSourceBySoundId.get(sound.id), trigger.id);
  assert.deepEqual(compiled.modulationIncomingByTarget.get(sound.id), [{ parameter: 'basePitch', sourceId: control.id }]);
  assert.equal(compiled.audioConnections.length, 1);
  assert.equal(compiled.audioConnections[0].id, 'audio:conn-1');
});

test('hybrid patch prefers typed event routes over legacy fields without double-apply', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);
  patch.routes = [
    {
      id: 'typed-event',
      domain: 'event',
      source: { kind: 'module', moduleId: triggerB.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
      metadata: { createdFrom: 'ui' },
    },
  ];

  const compiled = compileRoutingGraph(patch);
  assert.equal(compiled.eventSourceBySoundId.get(sound.id), triggerB.id);
  assert.deepEqual(compiled.triggerTargets.get(triggerB.id), [sound.id]);
  assert.equal(compiled.triggerTargets.get(triggerA.id), undefined);
});

test('typed event route is equivalent to triggerSource behavior', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const patch = makePatch([trigger, sound]);
  patch.routes = [
    {
      id: 'evt-1',
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
      metadata: { createdFrom: 'ui' },
    },
  ];

  const compiled = compileRoutingGraph(patch);
  assert.equal(compiled.eventSourceBySoundId.get(sound.id), trigger.id);
});

test('typed modulation route is equivalent to legacy modulations map', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const control = makeControl({ id: 'ctl-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id, modulations: {} });
  const patch = makePatch([trigger, sound, control]);
  patch.routes = [
    {
      id: 'mod-1',
      domain: 'modulation',
      source: { kind: 'module', moduleId: control.id, port: 'cv-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'cv-in' },
      enabled: true,
      metadata: { createdFrom: 'ui', parameter: 'basePitch' },
    },
  ];

  const compiled = compileRoutingGraph(patch);
  assert.deepEqual(compiled.modulationIncomingByTarget.get(sound.id), [{ parameter: 'basePitch', sourceId: control.id }]);
});

test('typed audio route is equivalent to legacy connections behavior', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);
  patch.routes = [
    {
      id: 'aud-1',
      domain: 'audio',
      source: { kind: 'module', moduleId: sound.id, port: 'main' },
      target: { kind: 'master', port: 'in' },
      enabled: true,
      gain: 0.75,
      metadata: { createdFrom: 'ui' },
    },
  ];

  const compiled = compileRoutingGraph(patch);
  assert.deepEqual(compiled.audioConnections, [
    {
      id: 'aud-1',
      fromModuleId: sound.id,
      fromPort: 'main',
      to: { type: 'master', port: 'in' },
      gain: 0.75,
      enabled: true,
    },
  ]);
});

test('invalid typed route is ignored safely with warning', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const patch = makePatch([trigger, sound]);
  patch.routes = [
    {
      id: 'evt-bad',
      domain: 'event',
      source: { kind: 'module', moduleId: 'missing-trigger', port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
    },
  ];

  const compiled = compileRoutingGraph(patch);
  assert.equal(compiled.eventSourceBySoundId.has(sound.id), false);
  assert.equal(compiled.warnings.length > 0, true);
});

test('typed route fallback id is deterministic when id is omitted', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const patch = makePatch([trigger, sound]);
  patch.routes = [
    {
      domain: 'event',
      source: { kind: 'module', moduleId: trigger.id, port: 'trigger-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'trigger-in' },
      enabled: true,
      metadata: { createdFrom: 'ui' },
    },
  ];

  const compiledA = compileRoutingGraph(patch);
  const compiledB = compileRoutingGraph(structuredClone(patch));
  assert.equal(compiledA.routes.length, 1);
  assert.equal(compiledA.routes[0].id, compiledB.routes[0].id);
});

test('modulation routes enforce single controller per target parameter', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id, modulations: {} });
  const controlA = makeControl({ id: 'ctl-a' });
  const controlB = makeControl({ id: 'ctl-b' });
  const patch = makePatch([trigger, sound, controlA, controlB]);
  patch.routes = [
    {
      id: 'mod-a',
      domain: 'modulation',
      source: { kind: 'module', moduleId: controlA.id, port: 'cv-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'cv-in' },
      enabled: true,
      metadata: { createdFrom: 'ui', parameter: 'basePitch' },
    },
    {
      id: 'mod-b',
      domain: 'modulation',
      source: { kind: 'module', moduleId: controlB.id, port: 'cv-out' },
      target: { kind: 'module', moduleId: sound.id, port: 'cv-in' },
      enabled: true,
      metadata: { createdFrom: 'ui', parameter: 'basePitch' },
    },
  ];

  const compiled = compileRoutingGraph(patch);
  assert.deepEqual(compiled.modulationIncomingByTarget.get(sound.id), [{ parameter: 'basePitch', sourceId: controlA.id }]);
  assert.equal(compiled.warnings.some((warning) => warning.includes('already controlled')), true);
});

test('self-modulation route is rejected', () => {
  const control = makeControl({ id: 'ctl-self' });
  const patch = makePatch([control]);
  patch.routes = [
    {
      id: 'mod-self',
      domain: 'modulation',
      source: { kind: 'module', moduleId: control.id, port: 'cv-out' },
      target: { kind: 'module', moduleId: control.id, port: 'cv-in' },
      enabled: true,
      metadata: { createdFrom: 'ui', parameter: 'amount' },
    },
  ];

  const compiled = compileRoutingGraph(patch);
  assert.equal(compiled.modulationIncomingByTarget.has(control.id), false);
  assert.equal(compiled.warnings.some((warning) => warning.includes('self-modulation')), true);
});
