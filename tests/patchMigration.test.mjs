import assert from 'node:assert/strict';
import { migratePatch } from '../src/patch.ts';

(function testLegacyVoicesDefaultToSelfPatternSource() {
  const legacyPatch = {
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [
      {
        id: 'v1',
        type: 'voice',
        name: 'OLD',
        enabled: true,
        kind: 'drum',
        mode: 'step',
        seed: 1,
        determinism: 0.8,
        gravity: 0.6,
        density: 0.5,
        subdiv: 4,
        length: 16,
        drop: 0,
        amp: 0.12,
        timbre: 0.5,
        pan: 0,
        weird: 0.5,
        euclidRot: 0,
        caRule: 90,
        caInit: 0.25,
      },
    ],
    buses: [],
    connections: [],
  };

  const migrated = migratePatch(legacyPatch);
  assert.equal(migrated.modules[0].patternSource, 'self', 'legacy voice patches should default to self pattern source');
})();

console.log('patch migration tests passed');
