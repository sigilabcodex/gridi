import type { PresetRecord } from "../persistence/presetStore";
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
  onSaveCurrentPreset: () => void;
  onExportCurrentPreset: () => void;
  onExportSession: () => void;
  onImportFile: () => void;
};

export function openPresetManagerModal(params: PresetManagerModalParams) {
  const m = makeModal("Preset Manager");
  const body = m.body;

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

  const renderList = (rawFilter: string) => {
    list.replaceChildren();
    const filter = rawFilter.trim().toLowerCase();
    const visible = params.presets.filter((preset) => !filter || preset.name.toLowerCase().includes(filter));

    visible.forEach((preset) => {
      const row = el("div", "presetRow");
      const meta = el("div", "presetMeta");
      const name = el("div", preset.id === params.selectedPresetId ? "presetName active" : "presetName", preset.name);
      const ts = el("div", "small", `updated ${new Date(preset.updatedAt).toLocaleString()}`);
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

      const btnDelete = el("button", "danger", "Delete");
      btnDelete.onclick = () => {
        params.onDeletePreset(preset.id);
        m.destroy();
      };

      const btns = el("div", "settingsBtnRow");
      btns.append(btnLoad, btnRename, btnDuplicate, btnDelete);
      row.append(meta, btns);
      list.appendChild(row);
    });

    empty.classList.toggle("hidden", visible.length > 0);
  };

  filterInput.addEventListener("input", () => renderList(filterInput.value));
  renderList("");

  body.appendChild(list);
  body.appendChild(empty);
  m.open();
  queueMicrotask(() => filterInput.focus());
}
