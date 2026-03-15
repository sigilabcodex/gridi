import assert from 'node:assert/strict';
import { migratePatch } from '../src/patch.ts';
import { validateConnections } from '../src/engine/routing.ts';

(function testLegacyPatchGetsRoutingDefaults() {
  const patch = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [],
  });

  assert.deepEqual(patch.buses, []);
  assert.deepEqual(patch.connections, []);
})();

(function testConnectionValidationDropsInvalidEndpoints() {
  const patch = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [
      { id: 'v1', type: 'voice', name: 'V1', enabled: true, kind: 'drum', mode: 'step', patternSource: 'self', seed: 1, determinism: 0.8, gravity: 0.6, density: 0.4, subdiv: 4, length: 16, drop: 0, amp: 0.1, timbre: 0.5, pan: 0, weird: 0.5, euclidRot: 0, caRule: 90, caInit: 0.25 },
      { id: 'fx1', type: 'effect', name: 'Gain', enabled: true, kind: 'gain', bypass: true, gain: 1 },
    ],
    buses: [],
    connections: [
      { id: 'ok', fromModuleId: 'v1', fromPort: 'main', to: { type: 'module', id: 'fx1' }, gain: 1, enabled: true },
      { id: 'bad-src', fromModuleId: 'missing', fromPort: 'main', to: { type: 'master' }, gain: 1, enabled: true },
      { id: 'bad-dst', fromModuleId: 'v1', fromPort: 'main', to: { type: 'module', id: 'missing' }, gain: 1, enabled: true },
    ],
  });

  const validation = validateConnections(patch);
  assert.equal(validation.validConnections.length, 1);
  assert.equal(validation.validConnections[0].id, 'ok');
  assert.equal(validation.warnings.length, 2);
})();

console.log('routing foundations tests passed');
