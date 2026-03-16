export function makeLegacyVoice(overrides = {}) {
  return {
    id: 'voice-1',
    type: 'voice',
    name: 'TEST',
    enabled: true,
    kind: 'drum',
    mode: 'step',
    patternSource: 'self',
    seed: 12345,
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
    ...overrides,
  };
}

export function makeTrigger(overrides = {}) {
  return {
    id: 'trg-1',
    type: 'trigger',
    name: 'TRG',
    enabled: true,
    mode: 'step',
    seed: 12345,
    determinism: 0.8,
    gravity: 0.6,
    density: 0.5,
    subdiv: 4,
    length: 16,
    drop: 0,
    weird: 0.5,
    euclidRot: 0,
    caRule: 90,
    caInit: 0.25,
    ...overrides,
  };
}

export function makeSound(overrides = {}) {
  return {
    id: 'drm-1',
    type: 'drum',
    name: 'DRM',
    enabled: true,
    triggerSource: 'trg-1',
    amp: 0.12,
    timbre: 0.5,
    pan: 0,
    ...overrides,
  };
}

export function makePatch(modules) {
  return {
    version: '0.3',
    bpm: 120,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules,
    buses: [],
    connections: [],
  };
}

export function absoluteBeats(window) {
  return window.events.map((ev) => window.startBeat + ev.beatOffset);
}
