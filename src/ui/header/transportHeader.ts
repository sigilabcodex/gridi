import type { Patch } from "../../patch";
import { APP_DISPLAY_NAME } from "../../version";
import { el } from "../modals/modal";

type HeaderParams = {
  root: HTMLElement;
  patch: () => Patch;
  bank: () => number;
  bankCount: number;
  settingsExperimental: () => boolean;
  audioState: () => "running" | string;
  isPlaying: () => boolean;
  onOpenSettings: () => void;
  onToggleAudio: () => Promise<void>;
  onTogglePlay: () => Promise<void>;
  onToggleMute: () => void;
  onReset: () => void;
  onReseed: () => void;
  onRandomize: () => void;
  onRegen: () => void;
  onPrevBank: () => void;
  onNextBank: () => void;
  onSetBpm: (v: number) => void;
  onSetMasterGain: (v: number) => void;
};

export function createTransportHeader(params: HeaderParams) {
  const header = document.createElement("header");
  const h1 = document.createElement("h1");
  h1.textContent = APP_DISPLAY_NAME;

  const status = document.createElement("div");
  status.className = "small";

  const btnSettings = el("button", "iconBtn", "⚙");
  btnSettings.title = "Settings";
  btnSettings.onclick = params.onOpenSettings;

  const btnAudio = document.createElement("button");
  btnAudio.className = "primary";
  btnAudio.onclick = params.onToggleAudio;

  const btnPlay = document.createElement("button");
  btnPlay.onclick = params.onTogglePlay;

  const btnMute = document.createElement("button");
  btnMute.onclick = params.onToggleMute;

  const masterWrap = el("div", "bpmWrap");
  const masterLab = el("div", "small", "Master");
  const master = document.createElement("input");
  master.type = "range";
  master.min = "0";
  master.max = "1";
  master.step = "0.001";

  const masterNum = document.createElement("input");
  masterNum.type = "number";
  masterNum.min = "0";
  masterNum.max = "1";
  masterNum.step = "0.001";

  master.oninput = () => params.onSetMasterGain(parseFloat(master.value));
  masterNum.onchange = () => params.onSetMasterGain(parseFloat(masterNum.value));
  masterWrap.append(masterLab, master, masterNum);

  const btnReset = document.createElement("button");
  btnReset.textContent = "Reset";
  btnReset.onclick = params.onReset;

  const btnReseed = document.createElement("button");
  btnReseed.textContent = "Re-seed";
  btnReseed.onclick = params.onReseed;

  const btnRandom = document.createElement("button");
  btnRandom.textContent = "Randomize";
  btnRandom.onclick = params.onRandomize;

  const btnRegen = document.createElement("button");
  btnRegen.textContent = "Regen";
  btnRegen.onclick = params.onRegen;

  const bankWrap = document.createElement("div");
  bankWrap.className = "bankWrap";

  const bankLabel = document.createElement("div");
  bankLabel.className = "small";

  const btnBankPrev = document.createElement("button");
  btnBankPrev.textContent = "◀";
  btnBankPrev.onclick = params.onPrevBank;

  const btnBankNext = document.createElement("button");
  btnBankNext.textContent = "▶";
  btnBankNext.onclick = params.onNextBank;

  bankWrap.append(btnBankPrev, bankLabel, btnBankNext);

  const bpmWrap = document.createElement("div");
  bpmWrap.className = "bpmWrap";

  const bpmLabel = document.createElement("div");
  bpmLabel.className = "small";
  bpmLabel.textContent = "BPM";

  const bpm = document.createElement("input");
  bpm.type = "range";
  bpm.min = "40";
  bpm.max = "240";
  bpm.step = "1";

  const bpmNum = document.createElement("input");
  bpmNum.type = "number";
  bpmNum.min = "40";
  bpmNum.max = "240";

  bpm.oninput = () => params.onSetBpm(parseInt(bpm.value, 10));
  bpmNum.onchange = () => params.onSetBpm(parseInt(bpmNum.value, 10));
  bpmWrap.append(bpmLabel, bpm, bpmNum);

  const spacer = document.createElement("div");
  spacer.className = "spacer";

  header.append(
    h1,
    btnAudio,
    btnPlay,
    btnMute,
    btnReset,
    btnReseed,
    btnRandom,
    btnRegen,
    bankWrap,
    bpmWrap,
    masterWrap,
    spacer,
    status,
    btnSettings
  );

  params.root.appendChild(header);

  const updateStatus = () => {
    status.textContent = `status: ${params.isPlaying() ? "playing" : "stopped"} | audio: ${params.audioState()}${
      params.settingsExperimental() ? " | experimental: ON" : ""
    }`;
  };

  const updateAudioBtn = () => {
    btnAudio.textContent = params.audioState() === "running" ? "Audio ON" : "Audio OFF";
  };

  const updatePlayBtn = () => {
    btnPlay.textContent = params.isPlaying() ? "Stop" : "Play";
  };

  const updateMuteBtn = () => {
    const patch = params.patch();
    btnMute.textContent = patch.masterMute ? "Unmute" : "Mute";
    btnMute.className = patch.masterMute ? "primary" : "";
  };

  const updateMasterGainUI = () => {
    const patch = params.patch();
    master.value = String(patch.masterGain);
    masterNum.value = String(patch.masterGain);
  };

  const updateBankLabel = () => {
    bankLabel.textContent = `Bank ${params.bank() + 1}/${params.bankCount}`;
  };

  const updateBpmUI = () => {
    const patch = params.patch();
    bpm.value = String(patch.bpm);
    bpmNum.value = String(patch.bpm);
  };

  return {
    btnPlay,
    updateStatus,
    updateAudioBtn,
    updatePlayBtn,
    updateMuteBtn,
    updateMasterGainUI,
    updateBankLabel,
    updateBpmUI,
  };
}
