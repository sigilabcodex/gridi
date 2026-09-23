import type { Module } from "../patch.ts";
import { bindFloatingPanelReposition, placeFloatingPanel } from "./floatingPanel.ts";
import { moduleSettingsClipboard } from "./state/moduleSettingsClipboard.ts";
import type { TooltipBinder } from "./tooltip.ts";

type ModuleSettingsActionsParams = {
  module: Module;
  onPasteSettings: () => boolean;
  attachTooltip?: TooltipBinder;
};

/** A runtime-only local-settings menu shared by every module family. */
export function createModuleSettingsActions(params: ModuleSettingsActionsParams) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "surfaceHeaderAction moduleSettingsActionsButton";
  button.textContent = "⋯";
  button.setAttribute("aria-label", `Open settings actions for ${params.module.name}`);
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.dataset.testid = "module-settings-actions-button";
  params.attachTooltip?.(button, {
    text: "Copy or paste this module's local settings.",
    ariaLabel: `Settings actions for ${params.module.name}`,
  });

  let panel: HTMLElement | null = null;
  let reposition: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let removeOutsideListener: (() => void) | null = null;

  const close = (restoreFocus = false) => {
    panel?.remove();
    panel = null;
    button.setAttribute("aria-expanded", "false");
    reposition?.destroy();
    reposition = null;
    removeOutsideListener?.();
    removeOutsideListener = null;
    if (restoreFocus && button.isConnected) button.focus();
  };

  const open = () => {
    if (panel) {
      close(true);
      return;
    }

    const nextPanel = document.createElement("div");
    nextPanel.className = "floatingPanel moduleSettingsActionsPanel";
    nextPanel.setAttribute("role", "menu");
    nextPanel.setAttribute("aria-label", `${params.module.name} settings actions`);
    nextPanel.dataset.testid = "module-settings-actions-panel";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy settings";
    copy.setAttribute("role", "menuitem");
    copy.onclick = () => {
      moduleSettingsClipboard.copySettingsFromModule(params.module);
      close();
    };

    const paste = document.createElement("button");
    paste.type = "button";
    paste.textContent = "Paste settings";
    paste.setAttribute("role", "menuitem");
    paste.disabled = !moduleSettingsClipboard.canPasteSettingsToModule(params.module);
    paste.onclick = () => {
      if (params.onPasteSettings()) close();
    };

    nextPanel.append(copy, paste);
    panel = nextPanel;
    document.body.appendChild(nextPanel);
    button.setAttribute("aria-expanded", "true");
    placeFloatingPanel(nextPanel, button.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: "end",
      minWidth: 164,
      maxWidth: 220,
    });
    reposition = bindFloatingPanelReposition(nextPanel, () => (button.isConnected ? button.getBoundingClientRect() : null), {
      preferredSide: "bottom",
      align: "end",
      minWidth: 164,
      maxWidth: 220,
    });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (nextPanel.contains(target) || button.contains(target))) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    removeOutsideListener = () => document.removeEventListener("pointerdown", onPointerDown, true);
  };

  button.onclick = open;
  button.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close(true);
  });

  return { button, close };
}
