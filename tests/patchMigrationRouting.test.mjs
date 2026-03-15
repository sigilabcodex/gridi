import assert from 'node:assert/strict';
import test from 'node:test';
import { validateConnections } from '../src/engine/routing.ts';
import { migratePatch } from '../src/patch.ts';
import { makeVoice } from './helpers.mjs';

test('legacy voices gain default self pattern source', () => {
  const legacyPatch = {
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [{ ...makeVoice(), patternSource: undefined }],
    buses: [],
    connections: [],
  };

  const migrated = migratePatch(legacyPatch);
  assert.equal(migrated.modules[0].patternSource, 'self');
});

test('migration normalizes buses/effects/connections for malformed legacy input', () => {
  const patch = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [{ ...makeVoice({ id: 'v1' }) }, { id: 'fx1', type: 'effect', name: 'Gain', enabled: true }],
    buses: [{ id: 'b1', gain: 99, mute: 'truthy' }, { invalid: true }],
    connections: [
      { fromModuleId: 'v1', to: { type: 'module', id: 'fx1' }, gain: 99 },
      { id: 'bad-target', fromModuleId: 'v1', to: { type: 'module' } },
    ],
  });

  const fx = patch.modules.find((m) => m.id === 'fx1');
  assert.equal(fx.kind, 'gain');
  assert.equal(fx.bypass, true);
  assert.equal(fx.gain, 1);

  assert.deepEqual(patch.buses, [{ id: 'b1', name: 'BUS', gain: 2, mute: true }]);
  assert.equal(patch.connections.length, 1);
  assert.equal(patch.connections[0].fromPort, 'main');
  assert.equal(patch.connections[0].gain, 2);
  assert.equal(patch.connections[0].enabled, true);
});

test('routing validation keeps enabled valid links and warns on invalid endpoints', () => {
  const patch = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [makeVoice({ id: 'v1' }), { id: 'fx1', type: 'effect', name: 'Gain', enabled: true, kind: 'gain', bypass: true, gain: 1 }],
    buses: [{ id: 'bus-1', name: 'B1', gain: 1, mute: false }],
    connections: [
      { id: 'ok-module', fromModuleId: 'v1', fromPort: 'main', to: { type: 'module', id: 'fx1' }, gain: 1, enabled: true },
      { id: 'ok-bus', fromModuleId: 'v1', fromPort: 'main', to: { type: 'bus', id: 'bus-1' }, gain: 1, enabled: true },
      { id: 'disabled', fromModuleId: 'v1', fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: false },
      { id: 'bad-src', fromModuleId: 'missing', fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
      { id: 'bad-dst', fromModuleId: 'v1', fromPort: 'main', to: { type: 'module', id: 'missing' }, gain: 1, enabled: true },
    ],
  });

  const validation = validateConnections(patch);
  assert.deepEqual(validation.validConnections.map((c) => c.id), ['ok-module', 'ok-bus']);
  assert.equal(validation.warnings.length, 2);
});
