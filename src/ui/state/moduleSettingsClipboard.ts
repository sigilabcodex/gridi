import type { Module } from "../../patch.ts";
import {
  canPasteModuleSettings,
  copyModuleSettings,
  pasteModuleSettings,
  type ModuleSettingsPayload,
} from "../persistence/modulePresetStore.ts";

export type ModuleSettingsClipboard = {
  copySettingsFromModule: (module: Module) => boolean;
  canPasteSettingsToModule: (module: Module) => boolean;
  pasteSettingsToModule: (module: Module) => boolean;
  clear: () => void;
  getPayload: () => ModuleSettingsPayload | null;
};

export function createModuleSettingsClipboard(): ModuleSettingsClipboard {
  let payload: ModuleSettingsPayload | null = null;

  return {
    copySettingsFromModule(module) {
      payload = copyModuleSettings(module);
      return payload !== null;
    },
    canPasteSettingsToModule(module) {
      return canPasteModuleSettings(payload, module);
    },
    pasteSettingsToModule(module) {
      return pasteModuleSettings(module, payload);
    },
    clear() {
      payload = null;
    },
    getPayload() {
      return payload ? structuredClone(payload) : null;
    },
  };
}

export const moduleSettingsClipboard = createModuleSettingsClipboard();
