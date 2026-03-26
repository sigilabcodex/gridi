import type { Module } from "../patch";
import { bindFloatingPanelReposition, placeFloatingPanel } from "./floatingPanel";
import {
  findLinkedModulePreset,
  getModulePresetFamilyLabel,
  getModulePresetSubtype,
  getModulePresetSubtypeLabel,
  listModulePresetsForModule,
  sanitizeModulePresetName,
  type ModulePresetRecord,
} from "./persistence/modulePresetStore";
import type { TooltipBinder } from "./tooltip";

export type ModulePresetControlParams = {
  module: Module;
  records: ModulePresetRecord[];
  onLoadPreset: (presetId: string) => void;
  onSavePreset: (name: string, overwritePresetId?: string | null) => void;
  attachTooltip?: TooltipBinder;
};

export function createModulePresetControl(params: ModulePresetControlParams) {
  const presetButton = document.createElement("button");
  presetButton.type = "button";
  presetButton.className = "modulePresetChip";
  presetButton.setAttribute("aria-haspopup", "dialog");

  const linkedPreset = findLinkedModulePreset(params.records, params.module);
  const availablePresets = listModulePresetsForModule(params.records, params.module)
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const moduleSubtype = getModulePresetSubtype(params.module);

  const syncButton = () => {
    presetButton.textContent = params.module.presetName ?? `${getModulePresetFamilyLabel(params.module)} Preset`;
    presetButton.setAttribute("aria-label", `${params.module.name} preset ${presetButton.textContent}`);
  };
  syncButton();

  params.attachTooltip?.(presetButton, {
    text: `Open ${getModulePresetFamilyLabel(params.module).toLowerCase()} preset actions. Load or save presets for this module only.`,
    ariaLabel: `${params.module.name} preset menu`,
  });

  let panel: HTMLElement | null = null;
  let cleanup: { destroy: () => void } | null = null;

  const closePanel = () => {
    cleanup?.destroy();
    cleanup = null;
    panel?.remove();
    panel = null;
    presetButton.setAttribute("aria-expanded", "false");
    if (presetButton.isConnected) presetButton.focus();
  };

  const openPanel = () => {
    if (panel) {
      closePanel();
      return;
    }

    const floating = document.createElement("div");
    floating.className = "floatingPanel modulePresetPanel";
    floating.setAttribute("role", "dialog");
    floating.setAttribute("aria-label", `${params.module.name} preset panel`);
    presetButton.setAttribute("aria-expanded", "true");

    const heading = document.createElement("div");
    heading.className = "modulePresetPanelHead";

    const titleWrap = document.createElement("div");
    titleWrap.className = "modulePresetPanelTitleWrap";
    const title = document.createElement("div");
    title.className = "modulePresetPanelTitle";
    title.textContent = "Module preset";
    const subtitle = document.createElement("div");
    subtitle.className = "small modulePresetPanelSubtitle";
    subtitle.textContent = `${getModulePresetFamilyLabel(params.module)} · ${moduleSubtype.toUpperCase()} presets only`;
    titleWrap.append(title, subtitle);

    const typeBadge = document.createElement("div");
    typeBadge.className = "modulePresetPanelBadge";
    typeBadge.textContent = getModulePresetFamilyLabel(params.module).toUpperCase();
    heading.append(titleWrap, typeBadge);

    const summary = document.createElement("div");
    summary.className = "modulePresetSummary";
    const instanceNameLabel = document.createElement("div");
    instanceNameLabel.className = "small modulePresetSummaryLabel";
    instanceNameLabel.textContent = "Instance";
    const instanceNameValue = document.createElement("div");
    instanceNameValue.className = "modulePresetSummaryValue";
    instanceNameValue.textContent = params.module.name;
    const presetNameLabel = document.createElement("div");
    presetNameLabel.className = "small modulePresetSummaryLabel";
    presetNameLabel.textContent = "Current preset";
    const presetNameValue = document.createElement("div");
    presetNameValue.className = "modulePresetSummaryValue";
    presetNameValue.textContent = params.module.presetName ?? "Unnamed preset";
    summary.append(instanceNameLabel, instanceNameValue, presetNameLabel, presetNameValue);

    const linkedRow = document.createElement("div");
    linkedRow.className = "small modulePresetLinkedRow";
    linkedRow.textContent = linkedPreset
      ? `Linked: ${linkedPreset.name}`
      : "Linked: none yet";

    const saveBlock = document.createElement("div");
    saveBlock.className = "modulePresetSaveBlock";
    const saveLabel = document.createElement("label");
    saveLabel.className = "small modulePresetInputLabel";
    saveLabel.textContent = "Save current state as";
    const saveInput = document.createElement("input");
    saveInput.type = "text";
    saveInput.value = params.module.presetName ?? linkedPreset?.name ?? `${params.module.name} Preset`;
    saveInput.maxLength = 48;
    saveInput.spellcheck = false;
    saveInput.placeholder = `${getModulePresetFamilyLabel(params.module)} preset name`;

    const actions = document.createElement("div");
    actions.className = "modulePresetActionRow";
    const btnSaveNew = document.createElement("button");
    btnSaveNew.type = "button";
    btnSaveNew.textContent = "Save as new";
    btnSaveNew.className = "primary";
    btnSaveNew.onclick = () => {
      params.onSavePreset(sanitizeModulePresetName(saveInput.value, params.module.presetName ?? `${params.module.name} Preset`), null);
      closePanel();
    };

    const btnOverwrite = document.createElement("button");
    btnOverwrite.type = "button";
    btnOverwrite.textContent = linkedPreset ? "Overwrite linked" : "Save linked";
    btnOverwrite.disabled = !linkedPreset;
    btnOverwrite.onclick = () => {
      if (!linkedPreset) return;
      params.onSavePreset(sanitizeModulePresetName(saveInput.value, linkedPreset.name), linkedPreset.id);
      closePanel();
    };
    actions.append(btnSaveNew, btnOverwrite);
    saveBlock.append(saveLabel, saveInput, actions);

    const listWrap = document.createElement("div");
    listWrap.className = "modulePresetListWrap";
    const listTitle = document.createElement("div");
    listTitle.className = "small modulePresetListTitle";
    listTitle.textContent = availablePresets.length
      ? `Load ${availablePresets.length} compatible preset${availablePresets.length === 1 ? "" : "s"}`
      : `No ${moduleSubtype.toUpperCase()} presets saved yet`;
    listWrap.appendChild(listTitle);

    const list = document.createElement("div");
    list.className = "modulePresetList";

    availablePresets.forEach((record) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `modulePresetListRow${linkedPreset?.id === record.id ? " isCurrent" : ""}`;
      row.onclick = () => {
        params.onLoadPreset(record.id);
        closePanel();
      };

      const meta = document.createElement("div");
      meta.className = "modulePresetListMeta";
      const name = document.createElement("div");
      name.className = "modulePresetListName";
      name.textContent = record.name;
      const info = document.createElement("div");
      info.className = "small modulePresetListInfo";
      info.textContent = `${getModulePresetSubtypeLabel(record)} · saved ${new Date(record.updatedAt).toLocaleDateString()}`;
      meta.append(name, info);

      const loadTag = document.createElement("div");
      loadTag.className = "modulePresetLoadTag";
      loadTag.textContent = linkedPreset?.id === record.id ? "Current" : "Load";
      row.append(meta, loadTag);
      list.appendChild(row);
    });

    listWrap.appendChild(list);
    floating.append(heading, summary, linkedRow, saveBlock, listWrap);
    document.body.appendChild(floating);

    const position = () => (presetButton.isConnected ? presetButton.getBoundingClientRect() : null);
    placeFloatingPanel(floating, presetButton.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: "start",
      offset: 8,
      minWidth: 280,
      maxWidth: 320,
    });
    cleanup = bindFloatingPanelReposition(floating, position, {
      preferredSide: "bottom",
      align: "start",
      offset: 8,
      minWidth: 280,
      maxWidth: 320,
    });

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (floating.contains(target) || presetButton.contains(target)) return;
      closePanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closePanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    const previousDestroy = cleanup?.destroy?.bind(cleanup);
    cleanup = {
      destroy() {
        previousDestroy?.();
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
      },
    };

    panel = floating;
    queueMicrotask(() => saveInput.focus());
  };

  presetButton.addEventListener("click", openPanel);

  return {
    button: presetButton,
    close: closePanel,
    sync: syncButton,
  };
}
