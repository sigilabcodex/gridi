import test from 'node:test';
import assert from 'node:assert/strict';

import { getControllableFamilies, getTargetParameterGroups } from '../src/ui/controlTargetCatalog.ts';
import { sampleControlValue01WhenActive } from '../src/ui/modulationView.ts';

const makeControl = () => ({
  id: 'ctl-1',
  type: 'control',
  engine: 'control',
  name: 'Control 1',
  enabled: true,
  x: 0,
  y: 0,
  kind: 'lfo',
  waveform: 'sine',
  speed: 0.5,
  amount: 0.7,
  phase: 0,
  rate: 0.4,
  drift: 0.2,
  randomness: 0.1,
});

test('control target catalog exposes grouped families and parameters', () => {
  const families = getControllableFamilies();
  assert.deepEqual(families, ['drum', 'tonal', 'trigger']);

  const triggerGroups = getTargetParameterGroups('trigger');
  assert.equal(triggerGroups.length > 0, true);
  assert.equal(triggerGroups.some((group) => group.parameters.some((param) => param.key === 'density')), true);

  const drumGroups = getTargetParameterGroups('drum');
  assert.equal(drumGroups.some((group) => group.parameters.some((param) => param.key === 'basePitch')), true);

  const synthGroups = getTargetParameterGroups('tonal');
  assert.equal(synthGroups.some((group) => group.parameters.some((param) => param.key === 'cutoff')), true);
});

test('modulation sampling is gated by active transport/audio state flag', () => {
  const patch = {
    modules: [makeControl()],
  };

  const activeSample = sampleControlValue01WhenActive(patch, 'ctl-1', 0.125, true);
  assert.equal(typeof activeSample, 'number');

  const inactiveSample = sampleControlValue01WhenActive(patch, 'ctl-1', 0.125, false);
  assert.equal(inactiveSample, null);
});
