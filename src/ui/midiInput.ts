export type MidiInputInfo = {
  id: string;
  name: string;
  manufacturer?: string;
  state?: string;
  connection?: string;
  likelyVirtual: boolean;
};

export type MidiSelectionMode = "auto" | "manual" | "fallback";

export type MidiInputStatus =
  | { kind: "unsupported" }
  | { kind: "pending" }
  | { kind: "denied"; reason: string }
  | { kind: "idle"; message: string; inputs: MidiInputInfo[] }
  | {
    kind: "connected";
    inputId: string;
    name: string;
    inputCount: number;
    inputs: MidiInputInfo[];
    selection: MidiSelectionMode;
    selectedLikelyVirtual: boolean;
    warning?: string;
  };

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

const LIKELY_VIRTUAL_PATTERNS = [
  /\bmidi through\b/i,
  /\bthrough\b/i,
  /\bloopback\b/i,
  /\bvirtual\b/i,
  /\bdummy\b/i,
  /\bmonitor\b/i,
];

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

export function isLikelyVirtualMidiInputName(name: string, manufacturer?: string) {
  const text = `${name} ${manufacturer ?? ""}`.trim();
  return LIKELY_VIRTUAL_PATTERNS.some((pattern) => pattern.test(text));
}

function toInputInfo(input: MIDIInput): MidiInputInfo {
  return {
    id: input.id,
    name: input.name || "Unnamed MIDI input",
    manufacturer: input.manufacturer || undefined,
    state: input.state,
    connection: input.connection,
    likelyVirtual: isLikelyVirtualMidiInputName(input.name || "", input.manufacturer || undefined),
  };
}

function scoreInput(input: MidiInputInfo) {
  let score = 0;
  if (input.state === "connected") score += 3;
  if (input.connection === "open") score += 2;
  if (input.name && input.name !== "Unnamed MIDI input") score += 1;
  if (input.likelyVirtual) score -= 6;
  return score;
}

export function pickPreferredMidiInput(inputs: MidiInputInfo[]) {
  if (!inputs.length) return null;
  return [...inputs]
    .sort((a, b) => scoreInput(b) - scoreInput(a) || a.name.localeCompare(b.name))[0] ?? null;
}

export function createMidiInputManager(params: {
  onStatus: (status: MidiInputStatus) => void;
  onNote: (message: MidiNoteMessage) => void;
}): MidiInputManager {
  let midiAccess: MIDIAccess | null = null;
  let currentInput: MIDIInput | null = null;
  let status: MidiInputStatus = { kind: "pending" };
  let preferredInputId: string | null = null;
  let hasManualSelection = false;

  const updateStatus = (next: MidiInputStatus) => {
    status = next;
    params.onStatus(next);
  };

  const clearInputListener = () => {
    if (!currentInput) return;
    currentInput.onmidimessage = null;
    currentInput = null;
  };

  const bindInput = (nextInput: MIDIInput) => {
    if (currentInput?.id === nextInput.id) return;
    clearInputListener();
    currentInput = nextInput;
    currentInput.onmidimessage = (event) => {
      if (!event.data) return;
      const parsed = parseMidiMessage(event.data);
      if (!parsed) return;
      params.onNote(parsed);
    };
  };

  const refreshInputBinding = () => {
    if (!midiAccess) return;
    const rawInputs = Array.from(midiAccess.inputs.values());
    const inputs = rawInputs.map(toInputInfo);

    if (!rawInputs.length) {
      clearInputListener();
      updateStatus({ kind: "idle", message: "No MIDI input device detected", inputs: [] });
      return;
    }

    const exactPreferred = preferredInputId ? rawInputs.find((input) => input.id === preferredInputId) ?? null : null;
    const autoPreferredInfo = pickPreferredMidiInput(inputs);
    const autoPreferred = autoPreferredInfo ? rawInputs.find((input) => input.id === autoPreferredInfo.id) ?? null : rawInputs[0] ?? null;

    let nextInput: MIDIInput | null = null;
    let selection: MidiSelectionMode = "auto";
    let warning: string | undefined;

    if (exactPreferred) {
      nextInput = exactPreferred;
      selection = hasManualSelection ? "manual" : "auto";
    } else if (hasManualSelection && preferredInputId) {
      nextInput = autoPreferred;
      selection = "fallback";
      warning = "Selected device unavailable; using best available input.";
    } else {
      nextInput = autoPreferred;
      selection = "auto";
    }

    if (!nextInput) {
      clearInputListener();
      updateStatus({ kind: "idle", message: "No usable MIDI input selected", inputs });
      return;
    }

    bindInput(nextInput);
    const selectedInfo = inputs.find((input) => input.id === nextInput.id) ?? toInputInfo(nextInput);
    if (!hasManualSelection) preferredInputId = nextInput.id;

    updateStatus({
      kind: "connected",
      inputId: nextInput.id,
      name: selectedInfo.name,
      inputCount: rawInputs.length,
      inputs,
      selection,
      selectedLikelyVirtual: selectedInfo.likelyVirtual,
      warning,
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
    updateStatus({ kind: "idle", message: "MIDI input stopped", inputs: [] });
  };

  return {
    init,
    dispose,
    getStatus: () => status,
    setPreferredInput: (inputId) => {
      preferredInputId = inputId;
      hasManualSelection = inputId !== null;
      refreshInputBinding();
    },
  };
}
