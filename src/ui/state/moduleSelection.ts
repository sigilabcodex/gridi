export type SelectionMode = "replace" | "add" | "range";

export type ModuleSelectionState = {
  selectedModuleIds: string[];
  selectionAnchorId: string | null;
  selectionMode: SelectionMode;
};

export const createModuleSelectionState = (): ModuleSelectionState => ({
  selectedModuleIds: [],
  selectionAnchorId: null,
  selectionMode: "replace",
});

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

export function replaceModuleSelection(_state: ModuleSelectionState, moduleId: string): ModuleSelectionState {
  return {
    selectedModuleIds: [moduleId],
    selectionAnchorId: moduleId,
    selectionMode: "replace",
  };
}

export function toggleModuleSelection(state: ModuleSelectionState, moduleId: string): ModuleSelectionState {
  const selected = new Set(state.selectedModuleIds);
  if (selected.has(moduleId)) selected.delete(moduleId);
  else selected.add(moduleId);
  const nextSelected = uniqueIds(Array.from(selected));
  return {
    selectedModuleIds: nextSelected,
    selectionAnchorId: nextSelected.length ? moduleId : null,
    selectionMode: "add",
  };
}

export function clearModuleSelection(): ModuleSelectionState {
  return createModuleSelectionState();
}

export function pruneModuleSelection(state: ModuleSelectionState, existingModuleIds: string[]): ModuleSelectionState {
  const existing = new Set(existingModuleIds);
  const selectedModuleIds = state.selectedModuleIds.filter((id) => existing.has(id));
  return {
    selectedModuleIds,
    selectionAnchorId: state.selectionAnchorId && existing.has(state.selectionAnchorId) ? state.selectionAnchorId : null,
    selectionMode: state.selectionMode,
  };
}
