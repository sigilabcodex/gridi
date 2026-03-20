import { settingsSchema } from "../../settings/schema";
import { saveSettings } from "../../settings/store";
import type { AppSettings } from "../../settings/types";
import { el, makeModal } from "./modal";

type SettingsModalParams = {
  settings: AppSettings;
  applyUserCss: (cssText: string) => void;
  updateStatus: () => void;
  onTooltipsChange?: (enabled: boolean) => void;
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

export function openSettingsModal(params: SettingsModalParams) {
  const { settings, applyUserCss, updateStatus, onTooltipsChange } = params;

  const m = makeModal("Settings");
  const body = m.body;

  const settingsIntro = el("div", "small settingsIntro");
  settingsIntro.textContent =
    "Tip: Audio can only start after a tap/click in this tab. Shortcuts: Space = Play/Stop, Ctrl/Cmd+S = Save preset, Ctrl/Cmd+Z = Undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y = Redo.";
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
          if (def.key === "ux.tooltips") onTooltipsChange?.(input.checked);
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

  m.open();
}
