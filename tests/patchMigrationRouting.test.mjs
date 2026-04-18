import assert from 'node:assert/strict';
import test from 'node:test';
import { validateConnections } from '../src/engine/routing.ts';
import { migratePatch } from '../src/patch.ts';
import { makeLegacyVoice } from './helpers.mjs';

test('legacy voice migrates to sound module + trigger module', () => {
  const migrated = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [{ ...makeLegacyVoice({ id: 'voice-a' }), patternSource: undefined }],
    buses: [],
    connections: [],
  });

  const sound = migrated.modules.find((m) => m.id === 'voice-a');
  const trigger = migrated.modules.find((m) => m.type === 'trigger');
  assert.equal(sound.type, 'drum');
  assert.equal(sound.triggerSource, trigger.id);
  assert.ok(trigger);
});

test('legacy follower maps to source trigger id; missing source becomes null', () => {
  const migrated = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [
      makeLegacyVoice({ id: 'lead', patternSource: 'self' }),
      makeLegacyVoice({ id: 'follow', patternSource: 'lead' }),
      makeLegacyVoice({ id: 'missing', patternSource: 'nope' }),
    ],
    buses: [],
    connections: [],
  });

  const lead = migrated.modules.find((m) => m.id === 'lead');
  const follow = migrated.modules.find((m) => m.id === 'follow');
  const missing = migrated.modules.find((m) => m.id === 'missing');
  assert.equal(typeof lead.triggerSource, 'string');
  assert.equal(follow.triggerSource, lead.triggerSource);
  assert.equal(missing.triggerSource, null);
});

test('migration backfills triggerSource from canonical event routes when needed', () => {
  const migrated = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [
      { id: 'trg-1', type: 'trigger', name: 'TRG', enabled: true, mode: 'step', seed: 1, determinism: 0.8, gravity: 0.6, density: 0.5, subdiv: 4, length: 16, drop: 0, weird: 0.5, euclidRot: 0, caRule: 90, caInit: 0.25 },
      { id: 'drm-1', type: 'drum', name: 'DRM', enabled: true, triggerSource: null, amp: 0.2, pan: 0 },
    ],
    buses: [],
    connections: [],
    routes: [
      {
        id: 'evt-1',
        domain: 'event',
        source: { kind: 'module', moduleId: 'trg-1', port: 'trigger-out' },
        target: { kind: 'module', moduleId: 'drm-1', port: 'trigger-in' },
        enabled: true,
      },
    ],
  });

  const sound = migrated.modules.find((m) => m.id === 'drm-1');
  assert.equal(sound.triggerSource, 'trg-1');
});

test('migration normalizes buses/effects/connections for malformed legacy input', () => {
  const patch = migratePatch({
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules: [{ ...makeLegacyVoice({ id: 'v1' }) }, { id: 'fx1', type: 'effect', name: 'Gain', enabled: true }],
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
    modules: [makeLegacyVoice({ id: 'v1' }), { id: 'fx1', type: 'effect', name: 'Gain', enabled: true, kind: 'gain', bypass: true, gain: 1 }],
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
  assert.deepEqual(validation.validConnections.map((c) => c.id), ['ok-module']);
  assert.equal(validation.warnings.length, 3);
});
