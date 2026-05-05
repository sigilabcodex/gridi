import type { Engine } from "../../engine/audio";
import { saveSettings } from "../../settings/store";
import type { AppSettings } from "../../settings/types";
import { APP_DISPLAY_NAME } from "../../version";
import { el, makeModal } from "./modal";

type WelcomeModalParams = {
  settings: AppSettings;
  engine: Engine;
  updateAudioBtn: () => void;
  updateStatus: () => void;
};

export function maybeShowWelcomeModal(params: WelcomeModalParams) {
  const { settings, engine, updateAudioBtn, updateStatus } = params;

  if (settings.ui.hideWelcome) return;

  const w = makeModal(`Welcome to ${APP_DISPLAY_NAME}`);
  const body = w.body;

  const p = el("div", "welcomeText");
  p.innerHTML = `
    <p><b>${APP_DISPLAY_NAME}</b> is a modular generative music instrument built around a grid-based workspace.</p>
    <p>Audio starts only after a tap or click in this browser tab.</p>
    <p class="small">Shortcuts: Space = Play/Stop. Ctrl/Cmd+Z = Undo. Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y) = Redo.</p>
    <p class="small">Open <b>⚙ Settings</b> for import/export and custom CSS.</p>
    <p class="small welcomeDedication"><span>Dedicated to Taniel Morales</span><span>1970–2026 · artist, teacher, friend.</span></p>
  `;



  const links = el("p", "small");
  links.innerHTML = `Learn more: <a href="https://github.com/sigilabcodex/gridi" target="_blank" rel="noopener noreferrer">GRIDI on GitHub</a> · <a href="https://github.com/sigilabcodex/gridi/tree/main/docs" target="_blank" rel="noopener noreferrer">Documentation</a>.`;

  const row = el("div", "settingsBtnRow");
  const btnStart = el("button", "primary", "Start Audio Engine");
  const btnLater = el("button", "", "Not now");
  const chkWrap = el("label", "chkRow");
  const chk = document.createElement("input");
  chk.type = "checkbox";
  chk.checked = true;
  chkWrap.append(chk, el("span", "small", "Don’t show again"));

  btnStart.onclick = async () => {
    await engine.start();
    updateAudioBtn();
    updateStatus();
    if (chk.checked) {
      settings.ui.hideWelcome = true;
      saveSettings(settings);
    }

    w.destroy();
  };

  btnLater.onclick = () => {
    if (chk.checked) {
      settings.ui.hideWelcome = true;
      saveSettings(settings);
    }

    w.destroy();
  };

  row.append(btnStart, btnLater);
  body.append(p, links, chkWrap, row);
  w.open();
}
