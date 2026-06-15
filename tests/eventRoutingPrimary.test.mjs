import assert from 'node:assert/strict';
import test from 'node:test';

import { migratePatch } from '../src/patch.ts';
import {
  resolveVoiceEventRouting,
  setVoicePrimaryEventSource,
  validatePatchRouting,
} from '../src/routingGraph.ts';
import { createScheduler } from '../src/engine/scheduler.ts';
import { buildEventRoutingInspectorRows } from '../src/ui/routingInspector.ts';
import { makePatch, makeSound, makeTrigger } from './helpers.mjs';

function eventRoute(id, sourceId, targetId, extra = {}) {
  return {
    id,
    domain: 'event',
    source: { kind: 'module', moduleId: sourceId, port: 'trigger-out' },
    target: { kind: 'module', moduleId: targetId, port: 'trigger-in' },
    enabled: true,
    ...extra,
  };
}

function withWindowTimer(fn) {
  const prevWindow = globalThis.window;
  let intervalFn = null;
  globalThis.window = { setInterval: (cb) => (intervalFn = cb, 1), clearInterval: () => {} };
  try { return fn(() => intervalFn && intervalFn()); } finally { globalThis.window = prevWindow; }
}

function observedSchedulerSources(patch) {
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
  return observed;
}

test('primary event resolver reports legacy primary assignment only', () => {
  const trigger = makeTrigger({ id: 'trg-a' });
  const sound = makeSound({ id: 'drm-1', triggerSource: trigger.id });
  const patch = makePatch([trigger, sound]);

  const resolution = resolveVoiceEventRouting(patch, sound.id);

  assert.equal(resolution.state, 'legacy-only');
  assert.equal(resolution.compiledCanonicalSourceId, trigger.id);
  assert.equal(resolution.legacyTriggerSourceId, trigger.id);
  assert.equal(resolution.schedulerEffectiveSourceId, trigger.id);
  assert.deepEqual(resolution.typedEventRouteCandidates, []);
});

test('primary event resolver reports typed primary assignment only', () => {
  const trigger = makeTrigger({ id: 'trg-a' });
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const patch = makePatch([trigger, sound]);
  patch.routes = [eventRoute('evt-a', trigger.id, sound.id)];

  const resolution = resolveVoiceEventRouting(patch, sound.id);

  assert.equal(resolution.state, 'typed-only');
  assert.equal(resolution.compiledCanonicalSourceId, trigger.id);
  assert.equal(resolution.legacyTriggerSourceId, null);
  assert.equal(resolution.schedulerEffectiveSourceId, trigger.id);
  assert.deepEqual(resolution.typedEventRouteCandidates.map((candidate) => candidate.sourceId), [trigger.id]);
});

test('assigning GEN B replaces GEN A as the single primary event assignment', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);
  patch.routes = [eventRoute('evt-a', triggerA.id, sound.id)];

  const resolution = setVoicePrimaryEventSource(patch, sound.id, triggerB.id);

  assert.equal(sound.triggerSource, triggerB.id);
  assert.equal(resolution.state, 'matching-hybrid');
  assert.deepEqual(patch.routes.map((route) => route.source.moduleId), [triggerB.id]);
  assert.equal(resolveVoiceEventRouting(patch, sound.id).schedulerEffectiveSourceId, triggerB.id);
});

test('repeated assignment of the same GEN is idempotent', () => {
  const trigger = makeTrigger({ id: 'trg-a' });
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const patch = makePatch([trigger, sound]);

  setVoicePrimaryEventSource(patch, sound.id, trigger.id);
  const once = structuredClone(patch);
  setVoicePrimaryEventSource(patch, sound.id, trigger.id);

  assert.deepEqual(patch, once);
});

test('reassignment does not create duplicate typed event routes', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);
  patch.routes = [
    eventRoute('evt-a', triggerA.id, sound.id),
    eventRoute('evt-a-copy', triggerA.id, sound.id),
  ];

  setVoicePrimaryEventSource(patch, sound.id, triggerB.id);

  const resolution = resolveVoiceEventRouting(patch, sound.id);
  assert.equal(resolution.state, 'matching-hybrid');
  assert.deepEqual(resolution.typedEventRouteCandidates.map((candidate) => candidate.sourceId), [triggerB.id]);
});

test('reassignment updates legacy compatibility state correctly', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);

  setVoicePrimaryEventSource(patch, sound.id, triggerB.id);

  assert.equal(sound.triggerSource, triggerB.id);
  assert.equal(resolveVoiceEventRouting(patch, sound.id).legacyTriggerSourceId, triggerB.id);
});

test('scheduler uses the newly assigned GEN', () => {
  const triggerA = makeTrigger({ id: 'trg-a', density: 1, drop: 0, length: 8 });
  const triggerB = makeTrigger({ id: 'trg-b', density: 1, drop: 0, length: 8 });
  const sound = makeSound({ id: 'drm-1', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);

  setVoicePrimaryEventSource(patch, sound.id, triggerB.id);
  const observed = observedSchedulerSources(patch);

  assert.ok(observed.length > 0);
  assert.ok(observed.every((event) => event.sourceId === triggerB.id && event.targetId === sound.id));
});

test('inspector shows the newly assigned GEN', () => {
  const triggerA = makeTrigger({ id: 'trg-a', name: 'GEN A' });
  const triggerB = makeTrigger({ id: 'trg-b', name: 'GEN B' });
  const sound = makeSound({ id: 'drm-1', name: 'Kick', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);

  setVoicePrimaryEventSource(patch, sound.id, triggerB.id);

  assert.deepEqual(buildEventRoutingInspectorRows(patch).map((row) => row.text), ['GEN B → Kick']);
});

test('saved and reloaded patch preserves the new assignment without schema change', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);

  setVoicePrimaryEventSource(patch, sound.id, triggerB.id);
  const reloaded = migratePatch(JSON.parse(JSON.stringify(patch)));
  const reloadedSound = reloaded.modules.find((module) => module.id === sound.id);

  assert.equal(reloaded.version, '0.3');
  assert.equal(reloadedSound.triggerSource, triggerB.id);
  assert.equal(resolveVoiceEventRouting(reloaded, sound.id).schedulerEffectiveSourceId, triggerB.id);
});

test('existing ambiguous multi-route patch is detected but not silently modified', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const patch = makePatch([triggerA, triggerB, sound]);
  patch.routes = [
    eventRoute('evt-a', triggerA.id, sound.id),
    eventRoute('evt-b', triggerB.id, sound.id),
  ];
  const before = structuredClone(patch);

  const resolution = resolveVoiceEventRouting(patch, sound.id);
  const validation = validatePatchRouting(patch);

  assert.equal(resolution.state, 'ambiguous');
  assert.equal(validation.issues.some((issue) => issue.code === 'voice-ambiguous-primary-event-source'), true);
  assert.deepEqual(patch, before);
});

test('stale previous typed route is removed when explicitly replacing the assignment', () => {
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: 'missing-trigger' });
  const patch = makePatch([triggerB, sound]);
  patch.routes = [eventRoute('evt-stale', 'missing-trigger', sound.id)];

  const before = resolveVoiceEventRouting(patch, sound.id);
  setVoicePrimaryEventSource(patch, sound.id, triggerB.id);
  const after = resolveVoiceEventRouting(patch, sound.id);

  assert.equal(before.state, 'stale');
  assert.equal(after.state, 'matching-hybrid');
  assert.deepEqual(after.typedEventRouteCandidates.map((candidate) => candidate.sourceId), [triggerB.id]);
});

test('disabled event routes do not block replacement', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);
  patch.routes = [eventRoute('evt-disabled', triggerA.id, sound.id, { enabled: false })];

  setVoicePrimaryEventSource(patch, sound.id, triggerB.id);

  assert.deepEqual(resolveVoiceEventRouting(patch, sound.id).typedEventRouteCandidates.map((candidate) => candidate.sourceId), [triggerB.id]);
  assert.equal(validatePatchRouting(patch).issues.some((issue) => issue.code === 'voice-ambiguous-primary-event-source'), false);
});

test('unrelated event routes to other voices remain unchanged', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const soundA = makeSound({ id: 'drm-a', triggerSource: triggerA.id });
  const soundB = makeSound({ id: 'drm-b', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, soundA, soundB]);
  patch.routes = [
    eventRoute('evt-a', triggerA.id, soundA.id),
    eventRoute('evt-b', triggerA.id, soundB.id),
  ];

  setVoicePrimaryEventSource(patch, soundA.id, triggerB.id);

  const soundBResolution = resolveVoiceEventRouting(patch, soundB.id);
  assert.equal(soundB.triggerSource, triggerA.id);
  assert.equal(soundBResolution.schedulerEffectiveSourceId, triggerA.id);
  assert.ok(patch.routes.some((route) => route.id === 'evt-b' && route.target.moduleId === soundB.id));
});


test('replacement preserves future non-primary event role routes', () => {
  const triggerA = makeTrigger({ id: 'trg-a' });
  const triggerB = makeTrigger({ id: 'trg-b' });
  const sound = makeSound({ id: 'drm-1', triggerSource: triggerA.id });
  const patch = makePatch([triggerA, triggerB, sound]);
  patch.routes = [
    eventRoute('evt-primary', triggerA.id, sound.id),
    eventRoute('evt-fill', triggerA.id, sound.id, { metadata: { role: 'fill' } }),
  ];

  setVoicePrimaryEventSource(patch, sound.id, triggerB.id);

  assert.ok(patch.routes.some((route) => route.id === 'evt-fill'));
  assert.equal(resolveVoiceEventRouting(patch, sound.id).typedEventRouteCandidates.find((candidate) => candidate.routeId === 'evt-fill').inputRole, 'fill');
  assert.deepEqual(
    resolveVoiceEventRouting(patch, sound.id).typedEventRouteCandidates
      .filter((candidate) => candidate.isPrimary)
      .map((candidate) => candidate.sourceId),
    [triggerB.id],
  );
});

test('primary event assignment does not change the patch schema version', () => {
  const trigger = makeTrigger({ id: 'trg-a' });
  const sound = makeSound({ id: 'drm-1', triggerSource: null });
  const patch = makePatch([trigger, sound]);

  setVoicePrimaryEventSource(patch, sound.id, trigger.id);

  assert.equal(patch.version, '0.3');
});
