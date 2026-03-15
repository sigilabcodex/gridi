import type { Patch } from "../../patch";
import { clamp, migratePatch } from "../../patch";
import { settingsSchema } from "../../settings/schema";
import { saveSettings } from "../../settings/store";
import type { AppSettings } from "../../settings/types";
import { BANK_COUNT, ensureBankCount, isPatchLike, safeParseJSON, saveState } from "../persistence/bankState";
import { el, makeModal } from "./modal";

type SettingsModalParams = {
  settings: AppSettings;
  patch: Patch;
  bank: number;
  banks: Patch[];
  clonePatch: (patch: Patch) => Patch;
  pushHistory: (prev: Patch) => void;
  setPatch: (patch: Patch) => void;
  setBank: (bank: number) => void;
  syncEngineFromPatch: (patch: Patch, regen?: boolean) => void;
  applyUserCss: (cssText: string) => void;
  rerender: () => void;
  updateStatus: () => void;
  updateBankLabel: () => void;
  updateMuteBtn: () => void;
  updateMasterGainUI: () => void;
};

function getSettingValue(settings: AppSettings, key: string): any {
  return key.split(".").reduce<any>((acc, part) => acc?.[part], settings);
}

function setSettingValue(settings: AppSettings, key: string, value: any) {
  const parts = key.split(".");
  let ref: any = settings;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!ref[parts[i]]) ref[parts[i]] = {};
    ref = ref[parts[i]];
  }

  ref[parts[parts.length - 1]] = value;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function openSettingsModal(params: SettingsModalParams) {
  const {
    settings,
    banks,
    clonePatch,
    pushHistory,
    setPatch,
    setBank,
    syncEngineFromPatch,
    applyUserCss,
    rerender,
    updateStatus,
    updateBankLabel,
    updateMuteBtn,
    updateMasterGainUI,
  } = params;

  let { patch, bank } = params;

  const m = makeModal("Settings");
  const body = m.body;

  const settingsIntro = el("div", "small settingsIntro");
  settingsIntro.textContent =
    "Tip: Audio can only start after a tap/click in this tab. Shortcuts: Space = Play/Stop, Ctrl/Cmd+Z = Undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y = Redo.";
  body.appendChild(settingsIntro);

  const grouped = new Map<string, typeof settingsSchema>();
  for (const def of settingsSchema) {
    const list = grouped.get(def.section) ?? [];
    list.push(def);
    grouped.set(def.section, list);
  }

  for (const [section, defs] of grouped) {
    const sectionWrap = el("div", "settingsBlock");
    sectionWrap.appendChild(el("div", "small", section));

    for (const def of defs) {
      const row = el("div", "settingsBlock");
      const currentValue = getSettingValue(settings, def.key);

      if (def.type === "boolean") {
        const label = el("label", "chkRow");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(currentValue);
        input.onchange = () => {
          setSettingValue(settings, def.key, input.checked);
          saveSettings(settings);
          if (def.key === "ui.experimental") updateStatus();
          if (def.key === "ui.customCss") applyUserCss(String(getSettingValue(settings, def.key) ?? ""));
        };
        label.append(input, el("span", "small", def.label));
        row.appendChild(label);
      } else if (def.type === "number") {
        const label = el("div", "small", def.label);
        const input = document.createElement("input");
        input.type = "number";
        if (def.min != null) input.min = String(def.min);
        if (def.max != null) input.max = String(def.max);
        if (def.step != null) input.step = String(def.step);
        input.value = String(currentValue ?? def.default);
        input.onchange = () => {
          const parsed = Number.parseFloat(input.value);
          const next = Number.isFinite(parsed) ? parsed : def.default;
          setSettingValue(settings, def.key, next);
          saveSettings(settings);
          input.value = String(next);
        };
        row.append(label, input);
      } else if (def.type === "select") {
        const label = el("div", "small", def.label);
        const input = document.createElement("select");
        for (const opt of def.options ?? []) {
          const option = document.createElement("option");
          option.value = String(opt.value);
          option.textContent = opt.label;
          input.appendChild(option);
        }
        input.value = String(currentValue ?? def.default);
        input.onchange = () => {
          setSettingValue(settings, def.key, input.value);
          saveSettings(settings);
        };
        row.append(label, input);
      } else if (def.type === "textarea") {
        const label = el("div", "small", def.label);
        const input = document.createElement("textarea");
        input.className = def.key === "ui.customCss" ? "cssBox" : "jsonBox";
        input.value = String(currentValue ?? def.default ?? "");

        const btns = el("div", "settingsBtnRow");
        const btnSave = el("button", "primary", "Save");
        const btnClear = el("button", "", "Clear");

        btnSave.onclick = () => {
          setSettingValue(settings, def.key, input.value);
          saveSettings(settings);
          if (def.key === "ui.customCss") applyUserCss(input.value);
        };

        btnClear.onclick = () => {
          input.value = "";
          setSettingValue(settings, def.key, "");
          saveSettings(settings);
          if (def.key === "ui.customCss") applyUserCss("");
        };

        btns.append(btnSave, btnClear);
        row.append(label, input, btns);
      }

      sectionWrap.appendChild(row);
    }

    body.appendChild(sectionWrap);
  }

  const ieWrap = el("div", "settingsBlock");
  const ieLab = el("div", "small", "Import / Export JSON");
  const ieTA = document.createElement("textarea");
  ieTA.className = "jsonBox";
  ieTA.placeholder = "Paste Patch JSON or Banks JSON here…";

  const ieBtns = el("div", "settingsBtnRow");
  const btnCopyPatch = el("button", "", "Copy Patch");
  const btnCopyBanks = el("button", "", "Copy Banks");
  const btnImportPatch = el("button", "primary", "Import Patch");
  const btnImportBanks = el("button", "primary", "Import Banks");

  btnCopyPatch.onclick = async () => {
    const txt = JSON.stringify(patch, null, 2);
    ieTA.value = txt;
    await copyToClipboard(txt);
  };

  btnCopyBanks.onclick = async () => {
    const payload = { version: "0.30", bank, banks };
    const txt = JSON.stringify(payload, null, 2);
    ieTA.value = txt;
    await copyToClipboard(txt);
  };

  btnImportPatch.onclick = () => {
    const parsed = safeParseJSON<any>(ieTA.value.trim());
    if (!isPatchLike(parsed)) {
      alert("Invalid patch JSON (expected version: 0.3).");
      return;
    }

    const prev = clonePatch(patch);
    patch = migratePatch(parsed);
    banks[bank] = patch;

    pushHistory(prev);
    setPatch(patch);
    syncEngineFromPatch(patch, true);
    saveState(bank, banks);
    rerender();
    updateMuteBtn();
    updateMasterGainUI();
    updateStatus();
    m.destroy();
  };

  btnImportBanks.onclick = () => {
    const parsed = safeParseJSON<any>(ieTA.value.trim());
    const banksIn = parsed?.banks;
    const bankIn = parsed?.bank;

    if (!Array.isArray(banksIn)) {
      alert("Invalid banks JSON (expected { banks: Patch[] }).");
      return;
    }

    const filtered = banksIn.filter(isPatchLike);
    if (!filtered.length) {
      alert("No valid patches found in banks JSON (expected version: 0.3).");
      return;
    }

    const prev = clonePatch(patch);

    const nextBanks = ensureBankCount(filtered, BANK_COUNT).map((p) => migratePatch(p));
    const nextBank = typeof bankIn === "number" ? clamp(bankIn, 0, BANK_COUNT - 1) : 0;

    bank = nextBank;
    setBank(bank);
    for (let i = 0; i < BANK_COUNT; i++) banks[i] = nextBanks[i];

    patch = banks[bank];
    pushHistory(prev);
    setPatch(patch);
    syncEngineFromPatch(patch, true);
    saveState(bank, banks);
    rerender();
    updateBankLabel();
    updateMuteBtn();
    updateMasterGainUI();
    updateStatus();
    m.destroy();
  };

  ieBtns.append(btnCopyPatch, btnCopyBanks, btnImportPatch, btnImportBanks);
  ieWrap.append(ieLab, ieTA, ieBtns);
  body.appendChild(ieWrap);

  m.open();
}
