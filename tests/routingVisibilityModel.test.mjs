import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultPatch, makeControl, makeSound, makeTrigger } from '../src/patch.ts';
import { buildRoutingSnapshot } from '../src/ui/routingVisibility.ts';

function seedPatch() {
  const patch = defaultPatch();
  patch.modules = [];
  patch.connections = [];
  patch.routes = [];
  return patch;
}

test('routing snapshot overview exposes canonical event/mod/audio routes', () => {
  const patch = seedPatch();
  const trigger = makeTrigger(0);
  const drum = makeSound('drum', 0);
  const synth = makeSound('tonal', 0);
  const control = makeControl('lfo', 0);

  drum.triggerSource = trigger.id;
  drum.modulations = { basePitch: control.id };
  synth.triggerSource = trigger.id;

  patch.modules.push(trigger, drum, synth, control);
  patch.connections.push({
    id: 'conn-1',
    fromModuleId: drum.id,
    fromPort: 'out',
    to: { type: 'master', port: 'in' },
    gain: 1,
    enabled: true,
  });

  const snapshot = buildRoutingSnapshot(patch);

  assert.equal(snapshot.overview.eventRoutes.length, 2);
  assert.equal(snapshot.overview.modulationRoutes.length, 1);
  assert.equal(snapshot.overview.audioRoutes.length, 1);

  assert.equal(snapshot.voiceIncoming.get(drum.id)?.trigger?.id, trigger.id);
  assert.equal(snapshot.controlTargets.get(control.id)?.[0]?.targetId, drum.id);
});

test('typed route domains preserve hybrid precedence in routing snapshot', () => {
  const patch = seedPatch();
  const triggerA = makeTrigger(0);
  const triggerB = makeTrigger(1);
  const drum = makeSound('drum', 0);

  drum.triggerSource = triggerA.id;
  patch.modules.push(triggerA, triggerB, drum);

  patch.routes = [{
    id: 'typed-event',
    domain: 'event',
    source: { kind: 'module', moduleId: triggerB.id, port: 'trigger-out' },
    target: { kind: 'module', moduleId: drum.id, port: 'trigger-in' },
    enabled: true,
    metadata: { createdFrom: 'ui' },
  }];

  const snapshot = buildRoutingSnapshot(patch);
  assert.equal(snapshot.overview.eventRoutes.length, 1);
  assert.equal(snapshot.overview.eventRoutes[0].source?.id, triggerB.id);
  assert.equal(snapshot.voiceIncoming.get(drum.id)?.trigger?.id, triggerB.id);
});

import { resolveTriggerFollowerLabel, resolveTriggerSourceLabelState, resolveVoiceRoutingLabel } from '../src/ui/routingLabels.ts';

test('voice and trigger routing surfaces resolve identical source labels', () => {
  const patch = seedPatch();
  const trigger = makeTrigger(0);
  const drum = makeSound('drum', 0);
  drum.triggerSource = trigger.id;
  patch.modules.push(trigger, drum);

  const voiceLabel = resolveVoiceRoutingLabel(patch.modules, drum);
  const triggerLabel = resolveTriggerFollowerLabel(patch.modules, drum);
  assert.equal(voiceLabel, triggerLabel);
  assert.equal(voiceLabel, trigger.name);
});

test('missing and null triggerSource share fallback labels across surfaces', () => {
  const patch = seedPatch();
  const drum = makeSound('drum', 0);
  drum.triggerSource = 'missing_trigger_1234';
  patch.modules.push(drum);

  assert.equal(resolveVoiceRoutingLabel(patch.modules, drum), resolveTriggerFollowerLabel(patch.modules, drum));
  assert.match(resolveVoiceRoutingLabel(patch.modules, drum), /^Missing /);
  assert.deepEqual(resolveTriggerSourceLabelState(patch.modules, drum.triggerSource), {
    label: 'Missing 1234',
    status: 'missing',
    missingId: 'missing_trigger_1234',
  });

  drum.triggerSource = null;
  assert.equal(resolveVoiceRoutingLabel(patch.modules, drum), 'None');
  assert.equal(resolveTriggerFollowerLabel(patch.modules, drum), 'None');
});

import { factoryExamplePatches } from '../src/ui/persistence/presetStore.ts';
import { buildEventRoutingInspectorRows, buildRoutingHealthSummary } from '../src/ui/routingInspector.ts';

test('routing health summary returns OK for factory examples', () => {
  for (const example of factoryExamplePatches()) {
    const summary = buildRoutingHealthSummary(example.patch);
    assert.equal(summary.label, 'Routing OK', example.name);
    assert.equal(summary.warningCount, 0, example.name);
  }
});

test('routing health summary counts missing trigger source and stale route families', () => {
  const patch = seedPatch();
  const drum = makeSound('drum', 0);
  const control = makeControl('lfo', 0);
  drum.triggerSource = 'missing-trigger';
  drum.modulations = { basePitch: 'missing-control' };
  patch.modules.push(drum, control);
  patch.connections.push({
    id: 'stale-conn',
    fromModuleId: 'missing-audio',
    fromPort: 'out',
    to: { type: 'master', port: 'in' },
    gain: 1,
    enabled: true,
  });
  patch.routes = [{
    id: 'stale-route',
    domain: 'event',
    source: { kind: 'module', moduleId: 'missing-typed-trigger', port: 'trigger-out' },
    target: { kind: 'module', moduleId: drum.id, port: 'trigger-in' },
    enabled: true,
  }];

  const summary = buildRoutingHealthSummary(patch);
  assert.equal(summary.label, '4 routing warnings');
  assert.deepEqual(summary.counts, {
    missingSources: 1,
    invalidRoutes: 1,
    staleConnections: 1,
    staleModulations: 1,
  });
});

test('event routing inspector lists generator to voice relationships with typed precedence', () => {
  const patch = seedPatch();
  const triggerA = makeTrigger(0);
  const triggerB = makeTrigger(1);
  const drum = makeSound('drum', 0);
  triggerA.name = 'Generator 1';
  triggerB.name = 'Generator 2';
  drum.name = 'Deep Kick';
  drum.triggerSource = triggerA.id;
  patch.modules.push(triggerA, triggerB, drum);
  patch.routes = [{
    id: 'typed-event',
    domain: 'event',
    source: { kind: 'module', moduleId: triggerB.id, port: 'trigger-out' },
    target: { kind: 'module', moduleId: drum.id, port: 'trigger-in' },
    enabled: true,
  }];

  assert.deepEqual(buildEventRoutingInspectorRows(patch).map((row) => row.text), [
    'Generator 2 → Deep Kick',
  ]);
});

test('event routing inspector uses compact fallback labels for unassigned and missing sources', () => {
  const patch = seedPatch();
  const unassigned = makeSound('drum', 0);
  const missing = makeSound('tonal', 0);
  unassigned.name = 'Closed Hat';
  missing.name = 'Snare';
  missing.triggerSource = 'missing_trigger_1234';
  patch.modules.push(unassigned, missing);

  const rows = buildEventRoutingInspectorRows(patch);
  assert.deepEqual(rows.map((row) => ({ text: row.text, sourceStatus: row.sourceStatus })), [
    { text: 'Unassigned → Closed Hat', sourceStatus: 'none' },
    { text: 'Missing source → Snare', sourceStatus: 'missing' },
  ]);
});
