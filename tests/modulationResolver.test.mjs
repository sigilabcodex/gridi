import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getModulationCapability,
  getModulationCapabilityMatrix,
  resolveParameterModulation,
  setParameterModulationSource,
} from '../src/routingGraph.ts';
import { buildModulationRoutingInspectorRows } from '../src/ui/routingInspector.ts';
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

function modulationRoute(id, sourceId, targetId, parameter, extra = {}) {
  return {
    id,
    domain: 'modulation',
    source: { kind: 'module', moduleId: sourceId, port: 'cv-out' },
    target: { kind: 'module', moduleId: targetId, port: 'cv-in' },
    enabled: true,
    metadata: { createdFrom: 'ui', parameter },
    ...extra,
  };
}

test('modulation resolver reports legacy modulation only as runtime-effective when supported', () => {
  const trigger = makeTrigger({ id: 'trg-1' });
  const control = makeControl({ id: 'ctl-1' });
  trigger.modulations = { density: control.id };
  const patch = makePatch([trigger, control]);

  const resolution = resolveParameterModulation(patch, trigger.id, 'density');

  assert.equal(resolution.state, 'legacy-only');
  assert.equal(resolution.legacySourceId, control.id);
  assert.equal(resolution.typedSourceId, null);
  assert.equal(resolution.effectiveRuntimeSourceId, control.id);
  assert.equal(resolution.runtimeOwner, 'scheduler');
});

test('modulation resolver reports typed modulation only as declaration without runtime authority', () => {
  const trigger = makeTrigger({ id: 'trg-1', modulations: {} });
  const control = makeControl({ id: 'ctl-1' });
  const patch = makePatch([trigger, control]);
  patch.routes = [modulationRoute('mod-typed', control.id, trigger.id, 'density')];

  const resolution = resolveParameterModulation(patch, trigger.id, 'density');

  assert.equal(resolution.state, 'typed-only');
  assert.equal(resolution.typedSourceId, control.id);
  assert.equal(resolution.legacySourceId, null);
  assert.equal(resolution.effectiveRuntimeSourceId, null);
  assert.equal(resolution.runtimeSupported, true);
});

test('modulation resolver reports matching typed and legacy sources with fallback in use', () => {
  const sound = makeSound({ id: 'drm-1', modulations: { basePitch: 'ctl-1' } });
  const control = makeControl({ id: 'ctl-1' });
  const patch = makePatch([sound, control]);
  patch.routes = [modulationRoute('mod-match', control.id, sound.id, 'basePitch')];

  const resolution = resolveParameterModulation(patch, sound.id, 'basePitch');

  assert.equal(resolution.state, 'matching-hybrid');
  assert.equal(resolution.typedAndLegacyMatch, true);
  assert.equal(resolution.effectiveRuntimeSourceId, control.id);
  assert.equal(resolution.fallbackUsed, true);
});

test('modulation resolver reports conflicting typed and legacy sources', () => {
  const sound = makeSound({ id: 'drm-1', modulations: { basePitch: 'ctl-a' } });
  const controlA = makeControl({ id: 'ctl-a' });
  const controlB = makeControl({ id: 'ctl-b' });
  const patch = makePatch([sound, controlA, controlB]);
  patch.routes = [modulationRoute('mod-conflict', controlB.id, sound.id, 'basePitch')];

  const resolution = resolveParameterModulation(patch, sound.id, 'basePitch');

  assert.equal(resolution.state, 'conflicting-hybrid');
  assert.equal(resolution.typedSourceId, controlB.id);
  assert.equal(resolution.legacySourceId, controlA.id);
  assert.equal(resolution.effectiveRuntimeSourceId, controlA.id);
  assert.equal(resolution.typedAndLegacyConflict, true);
});

test('modulation resolver reports no modulation', () => {
  const sound = makeSound({ id: 'drm-1', modulations: {} });
  const patch = makePatch([sound]);

  const resolution = resolveParameterModulation(patch, sound.id, 'basePitch');

  assert.equal(resolution.state, 'none');
  assert.equal(resolution.effectiveRuntimeSourceId, null);
});

test('modulation resolver reports stale typed source', () => {
  const sound = makeSound({ id: 'drm-1', modulations: {} });
  const patch = makePatch([sound]);
  patch.routes = [modulationRoute('mod-stale', 'missing-control', sound.id, 'basePitch')];

  const resolution = resolveParameterModulation(patch, sound.id, 'basePitch');

  assert.equal(resolution.state, 'stale-typed');
  assert.equal(resolution.typedCandidates[0].sourceId, 'missing-control');
  assert.equal(resolution.effectiveRuntimeSourceId, null);
});

test('modulation resolver reports stale legacy source', () => {
  const sound = makeSound({ id: 'drm-1', modulations: { basePitch: 'missing-control' } });
  const patch = makePatch([sound]);

  const resolution = resolveParameterModulation(patch, sound.id, 'basePitch');

  assert.equal(resolution.state, 'stale-legacy');
  assert.equal(resolution.legacySourceId, 'missing-control');
  assert.equal(resolution.effectiveRuntimeSourceId, null);
});

test('modulation resolver reports unsupported assigned parameter', () => {
  const sound = makeSound({ id: 'drm-1', modulations: { decay: 'ctl-1' } });
  const control = makeControl({ id: 'ctl-1' });
  const patch = makePatch([sound, control]);

  const resolution = resolveParameterModulation(patch, sound.id, 'decay');

  assert.equal(resolution.state, 'unsupported');
  assert.equal(resolution.runtimeSupported, false);
  assert.equal(resolution.effectiveRuntimeSourceId, null);
});

test('modulation capability matrix identifies scheduler and audio-owned runtime parameters', () => {
  assert.equal(getModulationCapability('trigger', 'density').consumedByRuntime, 'scheduler');
  assert.equal(getModulationCapability('drum', 'basePitch').consumedByRuntime, 'audio');
  assert.equal(getModulationCapability('tonal', 'cutoff').consumedByRuntime, 'audio');
  assert.equal(getModulationCapability('drum', 'decay').consumedByRuntime, null);

  const matrix = getModulationCapabilityMatrix();
  assert.ok(matrix.some((entry) => entry.moduleType === 'trigger' && entry.parameter === 'density' && entry.assignableInUi));
  assert.ok(matrix.some((entry) => entry.moduleType === 'tonal' && entry.parameter === 'cutoff' && entry.visibleInInspector));
});

test('modulation inspector distinguishes typed, legacy, effective runtime, unsupported, and conflict', () => {
  const sound = makeSound({ id: 'drm-1', name: 'Kick', modulations: { basePitch: 'ctl-a', decay: 'ctl-a' } });
  const controlA = makeControl({ id: 'ctl-a', name: 'CTRL A' });
  const controlB = makeControl({ id: 'ctl-b', name: 'CTRL B' });
  const patch = makePatch([sound, controlA, controlB]);
  patch.routes = [
    modulationRoute('mod-conflict', controlB.id, sound.id, 'basePitch'),
    modulationRoute('mod-typed', controlB.id, sound.id, 'tone'),
  ];

  const rows = buildModulationRoutingInspectorRows(patch);
  const pitch = rows.find((row) => row.targetId === sound.id && row.parameter === 'basePitch');
  const tone = rows.find((row) => row.targetId === sound.id && row.parameter === 'tone');
  const decay = rows.find((row) => row.targetId === sound.id && row.parameter === 'decay');

  assert.equal(pitch.status, 'conflict');
  assert.equal(pitch.typedSourceId, controlB.id);
  assert.equal(pitch.legacySourceId, controlA.id);
  assert.equal(pitch.effectiveRuntimeSourceId, controlA.id);
  assert.equal(tone.status, 'unsupported');
  assert.equal(tone.typedSourceId, controlB.id);
  assert.equal(decay.status, 'unsupported');
  assert.equal(decay.legacySourceId, controlA.id);
});

test('repeated modulation assignment is idempotent and keeps schema version', () => {
  const sound = makeSound({ id: 'drm-1', modulations: {} });
  const control = makeControl({ id: 'ctl-1' });
  const patch = makePatch([sound, control]);

  setParameterModulationSource(patch, sound.id, 'basePitch', control.id);
  const once = structuredClone(patch);
  setParameterModulationSource(patch, sound.id, 'basePitch', control.id);

  assert.deepEqual(patch, once);
  assert.equal(patch.version, '0.3');
});

test('assigning a new control replaces previous typed and legacy modulation sources', () => {
  const sound = makeSound({ id: 'drm-1', modulations: { basePitch: 'ctl-a' } });
  const controlA = makeControl({ id: 'ctl-a' });
  const controlB = makeControl({ id: 'ctl-b' });
  const patch = makePatch([sound, controlA, controlB]);
  patch.routes = [modulationRoute('mod-a', controlA.id, sound.id, 'basePitch')];

  const resolution = setParameterModulationSource(patch, sound.id, 'basePitch', controlB.id);

  assert.equal(resolution.state, 'matching-hybrid');
  assert.equal(sound.modulations.basePitch, controlB.id);
  assert.deepEqual(patch.routes.filter((route) => route.domain === 'modulation' && route.target.moduleId === sound.id && route.metadata.parameter === 'basePitch').map((route) => route.source.moduleId), [controlB.id]);
});

test('modulation reassignment leaves unrelated parameters unchanged', () => {
  const sound = makeSound({ id: 'drm-1', modulations: { basePitch: 'ctl-a', decay: 'ctl-a' } });
  const controlA = makeControl({ id: 'ctl-a' });
  const controlB = makeControl({ id: 'ctl-b' });
  const patch = makePatch([sound, controlA, controlB]);
  patch.routes = [
    modulationRoute('mod-pitch', controlA.id, sound.id, 'basePitch'),
    modulationRoute('mod-decay', controlA.id, sound.id, 'decay'),
  ];

  setParameterModulationSource(patch, sound.id, 'basePitch', controlB.id);

  assert.equal(sound.modulations.decay, controlA.id);
  assert.ok(patch.routes.some((route) => route.id === 'mod-decay'));
  assert.equal(resolveParameterModulation(patch, sound.id, 'decay').legacySourceId, controlA.id);
});
