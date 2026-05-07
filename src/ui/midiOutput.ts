import { makeNoteOffMessage, makeNoteOnMessage, normalizeMidiChannel, type MidiOutMessage } from "../engine/midiOut.ts";

export type MidiOutputInfo = {
  id: string;
  name: string;
  manufacturer?: string;
  state?: string;
  connection?: string;
};

export type MidiOutputStatus =
  | { kind: "unsupported" }
  | { kind: "pending" }
  | { kind: "denied"; reason: string }
  | { kind: "idle"; message: string; outputs: MidiOutputInfo[] }
  | { kind: "connected"; outputId: string; name: string; outputCount: number; outputs: MidiOutputInfo[]; warning?: string }
  | { kind: "sending"; outputId: string; name: string; outputCount: number; outputs: MidiOutputInfo[] };

export type MidiOutputManager = {
  init(): Promise<void>;
  dispose(): void;
  getStatus(): MidiOutputStatus;
  setPreferredOutput(outputId: string | null): void;
  sendNote(params: { note: number; velocity: number; channel?: number; gateMs?: number; delayMs?: number }): boolean;
};

function toOutputInfo(output: MIDIOutput): MidiOutputInfo {
  return {
    id: output.id,
    name: output.name || "Unnamed MIDI output",
    manufacturer: output.manufacturer || undefined,
    state: output.state,
    connection: output.connection,
  };
}

function scoreOutput(output: MidiOutputInfo) {
  let score = 0;
  if (output.state === "connected") score += 3;
  if (output.connection === "open") score += 2;
  if (output.name && output.name !== "Unnamed MIDI output") score += 1;
  return score;
}

export function pickPreferredMidiOutput(outputs: MidiOutputInfo[]) {
  if (!outputs.length) return null;
  return [...outputs].sort((a, b) => scoreOutput(b) - scoreOutput(a) || a.name.localeCompare(b.name))[0] ?? null;
}

export function createMidiOutputManager(params: {
  onStatus: (status: MidiOutputStatus) => void;
}): MidiOutputManager {
  let midiAccess: MIDIAccess | null = null;
  let currentOutput: MIDIOutput | null = null;
  let preferredOutputId: string | null = null;
  let hasManualSelection = false;
  let status: MidiOutputStatus = { kind: "pending" };
  let sendStatusTimer: number | null = null;

  const updateStatus = (next: MidiOutputStatus) => {
    status = next;
    params.onStatus(next);
  };

  const clearSendStatusTimer = () => {
    if (sendStatusTimer !== null) window.clearTimeout(sendStatusTimer);
    sendStatusTimer = null;
  };

  const refreshOutputBinding = () => {
    if (!midiAccess) return;
    const rawOutputs = Array.from(midiAccess.outputs.values());
    const outputs = rawOutputs.map(toOutputInfo);

    if (!rawOutputs.length) {
      currentOutput = null;
      updateStatus({ kind: "idle", message: "No MIDI output device detected", outputs: [] });
      return;
    }

    const exactPreferred = preferredOutputId ? rawOutputs.find((output) => output.id === preferredOutputId) ?? null : null;
    const autoPreferredInfo = pickPreferredMidiOutput(outputs);
    const autoPreferred = autoPreferredInfo ? rawOutputs.find((output) => output.id === autoPreferredInfo.id) ?? null : rawOutputs[0] ?? null;
    let warning: string | undefined;

    if (exactPreferred) currentOutput = exactPreferred;
    else if (hasManualSelection && preferredOutputId) {
      currentOutput = autoPreferred;
      warning = "Selected MIDI output unavailable; using best available output.";
    } else currentOutput = autoPreferred;

    if (!currentOutput) {
      updateStatus({ kind: "idle", message: "No usable MIDI output selected", outputs });
      return;
    }

    const selectedInfo = outputs.find((output) => output.id === currentOutput?.id) ?? toOutputInfo(currentOutput);
    if (!hasManualSelection) preferredOutputId = currentOutput.id;
    updateStatus({
      kind: "connected",
      outputId: currentOutput.id,
      name: selectedInfo.name,
      outputCount: rawOutputs.length,
      outputs,
      warning,
    });
  };

  const sendRaw = (message: MidiOutMessage, timestampMs?: number) => {
    if (!currentOutput) return false;
    try {
      currentOutput.send(message, timestampMs);
      return true;
    } catch (error) {
      updateStatus({ kind: "idle", message: error instanceof Error ? error.message : "MIDI output send failed", outputs: midiAccess ? Array.from(midiAccess.outputs.values()).map(toOutputInfo) : [] });
      return false;
    }
  };

  return {
    async init() {
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
      midiAccess.onstatechange = () => refreshOutputBinding();
      refreshOutputBinding();
    },
    dispose() {
      clearSendStatusTimer();
      if (midiAccess) midiAccess.onstatechange = null;
      midiAccess = null;
      currentOutput = null;
      updateStatus({ kind: "idle", message: "MIDI output stopped", outputs: [] });
    },
    getStatus: () => status,
    setPreferredOutput(outputId) {
      preferredOutputId = outputId;
      hasManualSelection = outputId !== null;
      refreshOutputBinding();
    },
    sendNote({ note, velocity, channel = 1, gateMs = 120, delayMs = 0 }) {
      if (!currentOutput) return false;
      const timestamp = typeof performance !== "undefined" ? performance.now() + Math.max(0, delayMs) : undefined;
      const midiChannel = normalizeMidiChannel(channel);
      const sentOn = sendRaw(makeNoteOnMessage(note, velocity, midiChannel), timestamp);
      if (!sentOn) return false;
      sendRaw(makeNoteOffMessage(note, midiChannel), timestamp === undefined ? undefined : timestamp + Math.max(1, gateMs));

      const outputs = midiAccess ? Array.from(midiAccess.outputs.values()).map(toOutputInfo) : [];
      updateStatus({ kind: "sending", outputId: currentOutput.id, name: currentOutput.name || "Unnamed MIDI output", outputCount: outputs.length, outputs });
      clearSendStatusTimer();
      sendStatusTimer = window.setTimeout(() => refreshOutputBinding(), 180);
      return true;
    },
  };
}
