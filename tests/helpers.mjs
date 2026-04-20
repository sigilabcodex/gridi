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
    accent: 0.5,
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
    accent: 0.5,
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
    pan: 0,
    basePitch: 0.4,
    decay: 0.35,
    transient: 0.6,
    snap: 0.25,
    noise: 0.2,
    bodyTone: 0.5,
    pitchEnvAmt: 0.6,
    pitchEnvDecay: 0.2,
    tone: 0.5,
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
