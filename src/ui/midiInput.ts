export type MidiInputStatus =
  | { kind: "unsupported" }
  | { kind: "pending" }
  | { kind: "denied"; reason: string }
  | { kind: "idle"; message: string }
  | { kind: "connected"; inputId: string; name: string; inputCount: number };

export type MidiNoteMessage = {
  type: "noteon" | "noteoff";
  note: number;
  velocity: number;
  channel: number;
};

export type MidiInputManager = {
  init(): Promise<void>;
  dispose(): void;
  getStatus(): MidiInputStatus;
  setPreferredInput(inputId: string | null): void;
};

function normalizeNote(value: number) {
  const note = value | 0;
  return Math.max(0, Math.min(127, note));
}

function normalizeVelocity(value: number) {
  const clamped = Math.max(0, Math.min(127, value | 0));
  return clamped / 127;
}

export function parseMidiMessage(data: ArrayLike<number>): MidiNoteMessage | null {
  const status = (data[0] ?? 0) & 0xf0;
  const channel = ((data[0] ?? 0) & 0x0f) + 1;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;

  if (status === 0x90) {
    const note = normalizeNote(d1);
    const velocity = normalizeVelocity(d2);
    if (velocity <= 0) return { type: "noteoff", note, velocity: 0, channel };
    return { type: "noteon", note, velocity, channel };
  }

  if (status === 0x80) {
    return { type: "noteoff", note: normalizeNote(d1), velocity: normalizeVelocity(d2), channel };
  }

  return null;
}

export function createMidiInputManager(params: {
  onStatus: (status: MidiInputStatus) => void;
  onNote: (message: MidiNoteMessage) => void;
}): MidiInputManager {
  let midiAccess: MIDIAccess | null = null;
  let currentInput: MIDIInput | null = null;
  let status: MidiInputStatus = { kind: "pending" };
  let preferredInputId: string | null = null;

  const updateStatus = (next: MidiInputStatus) => {
    status = next;
    params.onStatus(next);
  };

  const clearInputListener = () => {
    if (!currentInput) return;
    currentInput.onmidimessage = null;
    currentInput = null;
  };

  const refreshInputBinding = () => {
    if (!midiAccess) return;
    const inputs = Array.from(midiAccess.inputs.values());
    const nextInput = preferredInputId
      ? inputs.find((input) => input.id === preferredInputId) ?? inputs[0] ?? null
      : inputs[0] ?? null;

    if (!nextInput) {
      clearInputListener();
      updateStatus({ kind: "idle", message: "No MIDI input device detected" });
      return;
    }

    if (currentInput?.id === nextInput.id) {
      updateStatus({
        kind: "connected",
        inputId: nextInput.id,
        name: nextInput.name || "MIDI input",
        inputCount: inputs.length,
      });
      return;
    }

    clearInputListener();
    currentInput = nextInput;
    preferredInputId = nextInput.id;
    currentInput.onmidimessage = (event) => {
      if (!event.data) return;
      const parsed = parseMidiMessage(event.data);
      if (!parsed) return;
      params.onNote(parsed);
    };

    updateStatus({
      kind: "connected",
      inputId: nextInput.id,
      name: nextInput.name || "MIDI input",
      inputCount: inputs.length,
    });
  };

  const init = async () => {
    const nav = navigator as Navigator & { requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<MIDIAccess> };
    if (typeof nav.requestMIDIAccess !== "function") {
      updateStatus({ kind: "unsupported" });
      return;
    }

    updateStatus({ kind: "pending" });
    try {
      midiAccess = await nav.requestMIDIAccess({ sysex: false });
    } catch (error) {
      updateStatus({ kind: "denied", reason: error instanceof Error ? error.message : "MIDI access denied" });
      return;
    }

    midiAccess.onstatechange = () => {
      refreshInputBinding();
    };
    refreshInputBinding();
  };

  const dispose = () => {
    clearInputListener();
    if (midiAccess) midiAccess.onstatechange = null;
    midiAccess = null;
    updateStatus({ kind: "idle", message: "MIDI input stopped" });
  };

  return {
    init,
    dispose,
    getStatus: () => status,
    setPreferredInput: (inputId) => {
      preferredInputId = inputId;
      refreshInputBinding();
    },
  };
}
