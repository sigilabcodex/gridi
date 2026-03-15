import type { Patch } from "../../patch";

export type UndoRedoHistory = {
  pushHistory: (prev: Patch) => void;
  doUndo: () => void;
  doRedo: () => void;
};

export function createUndoRedoHistory(
  getPatch: () => Patch,
  setPatch: (patch: Patch) => void,
  applyPatch: (patch: Patch) => void,
  limit = 80
): UndoRedoHistory {
  const undoStack: Patch[] = [];
  const redoStack: Patch[] = [];
  let historyLock = false;

  const clonePatch = (patch: Patch): Patch => structuredClone(patch);

  const pushHistory = (prev: Patch) => {
    if (historyLock) return;
    undoStack.push(clonePatch(prev));
    if (undoStack.length > limit) undoStack.shift();
    redoStack.length = 0;
  };

  const doUndo = () => {
    if (!undoStack.length) return;

    const prev = undoStack.pop()!;
    redoStack.push(clonePatch(getPatch()));

    historyLock = true;
    setPatch(prev);
    applyPatch(prev);
    historyLock = false;
  };

  const doRedo = () => {
    if (!redoStack.length) return;

    const next = redoStack.pop()!;
    undoStack.push(clonePatch(getPatch()));

    historyLock = true;
    setPatch(next);
    applyPatch(next);
    historyLock = false;
  };

  return {
    pushHistory,
    doUndo,
    doRedo,
  };
}
