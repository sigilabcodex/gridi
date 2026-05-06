import { isFactoryPreset, type PresetRecord } from "../persistence/presetStore";
import { el, makeModal } from "./modal";

type PresetManagerModalParams = {
  presets: PresetRecord[];
  selectedPresetId: string;
  dirty: boolean;
  onSelectPreset: (presetId: string) => void;
  onCreatePreset: () => void;
  onRenamePreset: (presetId: string, name: string) => void;
  onDuplicatePreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onDeleteSelectedPresets: (presetIds: string[]) => void;
  onRestoreFactoryExamples: () => void;
  onResetToFactoryExamples: () => void;
  onSaveCurrentPreset: () => void;
  onExportCurrentPreset: () => void;
  onExportSession: () => void;
  onExportSelectedPresets: (presetIds: string[]) => void;
  onImportFile: () => void;
};

export function openPresetManagerModal(params: PresetManagerModalParams) {
  const m = makeModal("Preset Manager");
  const body = m.body;
  const selectedPresetIds = new Set<string>();

  const getSelectedLocalPresetIds = () =>
    params.presets.filter((preset) => selectedPresetIds.has(preset.id) && !isFactoryPreset(preset)).map((preset) => preset.id);

  const intro = el("div", "small settingsIntro");
  intro.textContent = "Sessions are local. Load intentionally, save when ready, and export often if a state matters.";
  body.appendChild(intro);

  const actions = el("div", "settingsBtnRow");
  const btnNew = el("button", "", "New Preset");
  const btnSave = el("button", "primary", params.dirty ? "Save Current*" : "Save Current");
  const btnImport = el("button", "", "Import File");
  const btnExportPreset = el("button", "", "Export Current");
  const btnExportSession = el("button", "", "Export Session");

  btnNew.onclick = () => {
    params.onCreatePreset();
    m.destroy();
  };

  btnSave.onclick = () => {
    params.onSaveCurrentPreset();
    m.destroy();
  };

  btnImport.onclick = () => {
    params.onImportFile();
    m.destroy();
  };

  btnExportPreset.onclick = params.onExportCurrentPreset;
  btnExportSession.onclick = params.onExportSession;

  actions.append(btnNew, btnSave, btnImport, btnExportPreset, btnExportSession);
  body.appendChild(actions);

  const cleanupNote = el("div", "small settingsIntro");
  cleanupNote.textContent = "Factory examples can be restored without touching local sessions. Full reset removes local saved sessions only after confirmation.";
  const cleanupActions = el("div", "settingsBtnRow");
  const btnRestoreFactory = el("button", "", "Restore missing factory examples");
  const btnResetFactory = el("button", "danger", "Reset to factory examples");

  btnRestoreFactory.onclick = () => {
    params.onRestoreFactoryExamples();
    m.destroy();
  };

  btnResetFactory.onclick = () => {
    if (!confirm("This will remove local saved sessions and restore the factory examples. Export anything you want to keep first.")) return;
    params.onResetToFactoryExamples();
    m.destroy();
  };

  cleanupActions.append(btnRestoreFactory, btnResetFactory);
  body.append(cleanupNote, cleanupActions);

  const batchNote = el("div", "small settingsIntro presetManagerBatchNote");
  batchNote.textContent = "Batch actions apply only to selected local sessions. Factory examples can be restored separately.";
  const batchActions = el("div", "settingsBtnRow presetManagerBatchActions");
  const selectionSummary = el("span", "small presetManagerSelectionSummary", "0 local selected");
  const btnExportSelected = el("button", "", "Export selected");
  const btnDeleteSelected = el("button", "danger", "Delete selected");
  const btnClearSelection = el("button", "", "Clear selection");

  const updateBatchActions = () => {
    const localCount = getSelectedLocalPresetIds().length;
    const protectedCount = params.presets.filter((preset) => selectedPresetIds.has(preset.id) && isFactoryPreset(preset)).length;
    selectionSummary.textContent = `${localCount} local selected${protectedCount ? ` · ${protectedCount} factory protected` : ""}`;
    btnExportSelected.disabled = localCount === 0;
    btnDeleteSelected.disabled = localCount === 0;
    btnClearSelection.disabled = selectedPresetIds.size === 0;
  };

  btnExportSelected.onclick = () => {
    const ids = getSelectedLocalPresetIds();
    if (!ids.length) {
      alert("Select one or more local sessions to export.");
      return;
    }
    params.onExportSelectedPresets(ids);
  };

  btnDeleteSelected.onclick = () => {
    const ids = getSelectedLocalPresetIds();
    if (!ids.length) {
      alert("Select one or more local sessions to delete. Factory examples are protected from batch delete.");
      return;
    }
    if (!confirm(`Delete ${ids.length} selected local session${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    params.onDeleteSelectedPresets(ids);
    m.destroy();
  };

  btnClearSelection.onclick = () => {
    selectedPresetIds.clear();
    renderList(filterInput.value);
  };

  batchActions.append(selectionSummary, btnExportSelected, btnDeleteSelected, btnClearSelection);
  body.append(batchNote, batchActions);

  const filterWrap = el("div", "presetManagerFilterWrap");
  const filterLabel = el("label", "small presetManagerFilterLabel", "Find session");
  const filterInput = el("input", "presetManagerFilterInput") as HTMLInputElement;
  filterInput.type = "search";
  filterInput.maxLength = 72;
  filterInput.spellcheck = false;
  filterInput.placeholder = "Search by session name";
  filterWrap.append(filterLabel, filterInput);
  body.appendChild(filterWrap);

  const list = el("div", "presetList");
  list.classList.add("presetListScrollable");
  const empty = el("div", "small presetManagerEmpty hidden", "No sessions match this filter.");

  function renderList(rawFilter: string) {
    list.replaceChildren();
    const filter = rawFilter.trim().toLowerCase();
    const visible = params.presets.filter((preset) => !filter || preset.name.toLowerCase().includes(filter));

    visible.forEach((preset) => {
      const isFactory = isFactoryPreset(preset);
      const isSelected = selectedPresetIds.has(preset.id);
      const row = el("div", `presetRow${isSelected ? " selected" : ""}`);
      const selectLabel = el("label", "presetSelectToggle");
      const checkbox = el("input", "") as HTMLInputElement;
      checkbox.type = "checkbox";
      checkbox.checked = isSelected;
      checkbox.disabled = isFactory;
      checkbox.setAttribute("aria-label", isFactory ? `${preset.name} is a protected factory example` : `Select ${preset.name}`);
      const selectText = el("span", "small", isFactory ? "Protected" : "Select");
      selectLabel.append(checkbox, selectText);
      checkbox.onchange = () => {
        if (checkbox.checked) selectedPresetIds.add(preset.id);
        else selectedPresetIds.delete(preset.id);
        renderList(filterInput.value);
      };

      const meta = el("div", "presetMeta");
      const name = el("div", preset.id === params.selectedPresetId ? "presetName active" : "presetName", preset.name);
      const source = isFactory ? "factory example · protected" : "local session";
      const ts = el("div", "small", `${source} · updated ${new Date(preset.updatedAt).toLocaleString()}`);
      meta.append(name, ts);

      const btnLoad = el("button", "", "Load");
      btnLoad.onclick = () => {
        params.onSelectPreset(preset.id);
        m.destroy();
      };

      const btnRename = el("button", "", "Rename");
      btnRename.onclick = () => {
        const next = prompt("Rename preset", preset.name);
        if (!next) return;
        params.onRenamePreset(preset.id, next);
        m.destroy();
      };

      const btnDuplicate = el("button", "", "Duplicate");
      btnDuplicate.onclick = () => {
        params.onDuplicatePreset(preset.id);
        m.destroy();
      };

      const btnDelete = el("button", "danger", isFactory ? "Protected" : "Delete");
      btnDelete.disabled = isFactory;
      btnDelete.onclick = () => {
        params.onDeletePreset(preset.id);
        m.destroy();
      };

      const btns = el("div", "settingsBtnRow");
      btns.append(btnLoad, btnRename, btnDuplicate, btnDelete);
      row.append(selectLabel, meta, btns);
      list.appendChild(row);
    });

    empty.classList.toggle("hidden", visible.length > 0);
    updateBatchActions();
  }

  filterInput.addEventListener("input", () => renderList(filterInput.value));
  renderList("");

  body.appendChild(list);
  body.appendChild(empty);
  m.open();
  queueMicrotask(() => filterInput.focus());
}
