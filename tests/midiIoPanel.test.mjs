import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMidiIoChipLabel, midiOutputCompactStatusText } from '../src/ui/header/midiIoPanel.ts';

const connectedInput = {
  kind: 'connected',
  inputId: 'in-1',
  name: 'Keystep 37',
  inputCount: 1,
  inputs: [],
  selection: 'manual',
  selectedLikelyVirtual: false,
};

const connectedOutput = {
  kind: 'connected',
  outputId: 'out-1',
  name: 'Volca Bass',
  outputCount: 1,
  outputs: [],
};

test('MIDI I/O chip label includes input target and output when both routes are active', () => {
  assert.equal(formatMidiIoChipLabel({
    inputStatus: connectedInput,
    outputStatus: connectedOutput,
    inputTargetLabel: 'Lead Voice',
    outputSourceLabel: 'GEN 1',
  }), 'MIDI: In Keystep 37 → Lead Voice · Out Volca Bass');
});

test('MIDI I/O chip label keeps output off visible when no MIDI Out source is selected', () => {
  assert.equal(formatMidiIoChipLabel({
    inputStatus: connectedInput,
    outputStatus: { kind: 'pending' },
    inputTargetLabel: null,
    outputSourceLabel: null,
  }), 'MIDI: In Keystep 37 · Out off');
});

test('MIDI I/O chip label summarizes permission and fallback states compactly', () => {
  assert.equal(formatMidiIoChipLabel({
    inputStatus: { kind: 'denied', reason: 'blocked' },
    outputStatus: { kind: 'pending' },
    inputTargetLabel: null,
    outputSourceLabel: 'GEN 1',
  }), 'MIDI: In denied · Out pending');
});

test('MIDI output compact status reports selected source and last sent diagnostics', () => {
  assert.equal(midiOutputCompactStatusText({
    kind: 'sending',
    outputId: 'out-1',
    name: 'Volca Bass',
    outputCount: 1,
    outputs: [],
    lastSent: { note: 64, velocity: 96, channel: 3, outputName: 'Volca Bass' },
  }, 'GEN 1'), 'Last Ch 3 Note 64 Vel 96 → Volca Bass · Source GEN 1');
});

test('MIDI output compact status remains compatible with drum-map note diagnostics', () => {
  assert.equal(midiOutputCompactStatusText({
    kind: 'sending',
    outputId: 'out-1',
    name: 'Hydrogen',
    outputCount: 1,
    outputs: [],
    lastSent: { note: 36, velocity: 100, channel: 10, outputName: 'Hydrogen' },
  }, 'Drum GEN'), 'Last Ch 10 Note 36 Vel 100 → Hydrogen · Source Drum GEN');
});
