import type { ControlKind, VisualKind } from "../patch";
import type { GridPosition } from "../workspacePlacement.ts";
import { bindFloatingPanelReposition, pointAnchor, placeFloatingPanel, type FloatingAnchor } from "./floatingPanel.ts";
import type { TooltipBinder } from "./tooltip.ts";

export type AddModulePick = "drum" | "tonal" | "trigger" | `control-${ControlKind}` | VisualKind;
export type AddModuleFamilyId = "gen" | "drum" | "synth" | "ctrl" | "vis";

type AddSlotParams = {
  position: GridPosition;
  onPick: (what: AddModulePick) => void;
  onDropModule?: (moduleId: string) => void;
  attachTooltip?: TooltipBinder;
};

export type AddModuleSubtypeItem = {
  label: string;
  shortLabel: string;
  desc: string;
  value: AddModulePick;
};

export type AddModuleFamily = {
  id: AddModuleFamilyId;
  code: string;
  label: string;
  desc: string;
  defaultPick: AddModulePick;
  accent?: boolean;
  subtypes?: AddModuleSubtypeItem[];
};

const CONTROL_SUBTYPES: AddModuleSubtypeItem[] = [
  { label: "LFO", shortLabel: "LFO", desc: "Cyclic control oscillator", value: "control-lfo" },
  { label: "Drift", shortLabel: "Drift", desc: "Smooth random control", value: "control-drift" },
  { label: "Stepped", shortLabel: "Step", desc: "Sample/step control", value: "control-stepped" },
];

const VISUAL_SUBTYPES: AddModuleSubtypeItem[] = [
  { label: "Scope", shortLabel: "Scope", desc: "Wave monitor", value: "scope" },
  { label: "Spectrum", shortLabel: "Spec", desc: "Frequency monitor", value: "spectrum" },
  { label: "Vectorscope", shortLabel: "Vector", desc: "Stereo phase view", value: "vectorscope" },
  { label: "Spectral Depth", shortLabel: "Depth", desc: "Layered spectral field", value: "spectral-depth" },
  { label: "Flow", shortLabel: "Flow", desc: "Motion-reactive field", value: "flow" },
  { label: "Ritual", shortLabel: "Ritual", desc: "Symbolic visual meter", value: "ritual" },
  { label: "Glitch", shortLabel: "Glitch", desc: "Digital-reactive display", value: "glitch" },
  { label: "Cymat", shortLabel: "Cymat", desc: "Cymatic pattern view", value: "cymat" },
];

export const ADD_MODULE_FAMILIES: AddModuleFamily[] = [
  { id: "gen", code: "GEN", label: "Generator", desc: "Pattern source", defaultPick: "trigger", accent: true },
  { id: "drum", code: "DRUM", label: "Drum", desc: "Percussive voice", defaultPick: "drum", accent: true },
  { id: "synth", code: "SYNTH", label: "Synth", desc: "Tonal voice", defaultPick: "tonal" },
  { id: "ctrl", code: "CTRL", label: "Control", desc: "Modulation sources", defaultPick: "control-lfo", subtypes: CONTROL_SUBTYPES },
  { id: "vis", code: "VIS", label: "Visual", desc: "Signal displays", defaultPick: "scope", subtypes: VISUAL_SUBTYPES },
];

export function getAddModuleFamily(id: AddModuleFamilyId): AddModuleFamily {
  const family = ADD_MODULE_FAMILIES.find((candidate) => candidate.id === id);
  if (!family) throw new Error(`Unknown add-module family: ${id}`);
  return family;
}

export function getAddModuleSubtypeItems(id: AddModuleFamilyId): AddModuleSubtypeItem[] {
  return getAddModuleFamily(id).subtypes ?? [];
}

function createMenuButton(options: { className?: string; title: string; desc?: string; meta?: string; onClick: () => void }) {
  const btn = document.createElement("button");
  btn.className = options.className ?? "addSlotMenuItem";
  btn.type = "button";
  btn.setAttribute("role", "menuitem");

  const title = document.createElement("div");
  title.className = "addSlotMenuTitle";
  title.textContent = options.title;
  btn.appendChild(title);

  if (options.desc || options.meta) {
    const desc = document.createElement("div");
    desc.className = "small addSlotMenuDesc";
    desc.textContent = options.meta ? `${options.meta} · ${options.desc ?? ""}` : options.desc ?? "";
    btn.appendChild(desc);
  }

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    options.onClick();
  };
  return btn;
}

export function renderAddModuleSlot(params: AddSlotParams) {
  const slot = document.createElement("section");
  slot.className = "moduleSurface addModuleSlot";
  slot.dataset.type = "add";
  slot.dataset.gridX = String(params.position.x);
  slot.dataset.gridY = String(params.position.y);
  slot.tabIndex = 0;
  slot.setAttribute("aria-haspopup", "menu");
  slot.setAttribute("aria-expanded", "false");
  params.attachTooltip?.(slot, {
    text: "Add a module to this empty workspace slot.",
    ariaLabel: `Add module at row ${params.position.y + 1}, column ${params.position.x + 1}`,
  });

  const plus = document.createElement("div");
  plus.className = "addModulePlus";
  plus.setAttribute("aria-hidden", "true");
  plus.textContent = "+";
  plus.style.marginTop = "0";

  const label = document.createElement("div");
  label.className = "small addModuleSlotLabel";
  label.textContent = "Add module";
  label.style.marginTop = "0";

  const content = document.createElement("div");
  content.className = "addModuleSlotContent";
  content.style.display = "grid";
  content.style.justifyItems = "center";
  content.style.alignContent = "center";
  content.style.gap = "6px";
  content.append(plus, label);

  slot.style.display = "flex";
  slot.style.alignItems = "center";
  slot.style.justifyContent = "center";

  const menu = document.createElement("div");
  menu.className = "floatingPanel addSlotMenu hidden";
  menu.setAttribute("role", "menu");

  let activeFamily: AddModuleFamilyId | null = null;
  let buttons: HTMLButtonElement[] = [];

  const pickAndClose = (what: AddModulePick) => {
    closeMenu();
    params.onPick(what);
  };

  const renderRootMenu = () => {
    activeFamily = null;
    buttons = [];
    menu.replaceChildren();

    const menuTitle = document.createElement("div");
    menuTitle.className = "small addSlotMenuHint";
    menuTitle.textContent = `Insert at (${params.position.x}, ${params.position.y})`;
    menu.appendChild(menuTitle);

    const browserHint = document.createElement("div");
    browserHint.className = "small addSlotMenuPhaseHint";
    browserHint.textContent = "Choose a family. Presets/search arrive in phase 2.";
    menu.appendChild(browserHint);

    for (const family of ADD_MODULE_FAMILIES) {
      const row = document.createElement("div");
      row.className = `addSlotFamilyRow${family.accent ? " accent" : ""}`;

      const familyButton = createMenuButton({
        className: "addSlotFamilyMain",
        title: `${family.code} · ${family.label}`,
        desc: family.subtypes ? `${family.desc} · choose subtype` : family.desc,
        onClick: () => {
          if (family.subtypes?.length) {
            renderSubtypeMenu(family.id);
            queueMicrotask(() => focusButton(0));
            return;
          }
          pickAndClose(family.defaultPick);
        },
      });
      buttons.push(familyButton);
      row.appendChild(familyButton);

      if (family.subtypes?.length) {
        const quickButton = document.createElement("button");
        quickButton.type = "button";
        quickButton.className = "addSlotQuickAdd";
        quickButton.setAttribute("role", "menuitem");
        quickButton.textContent = `+ ${family.subtypes[0].shortLabel}`;
        quickButton.title = `Quick add ${family.subtypes[0].label}`;
        quickButton.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          pickAndClose(family.defaultPick);
        };
        buttons.push(quickButton);
        row.appendChild(quickButton);
      }

      menu.appendChild(row);
    }
  };

  const renderSubtypeMenu = (familyId: AddModuleFamilyId) => {
    activeFamily = familyId;
    buttons = [];
    menu.replaceChildren();
    const family = getAddModuleFamily(familyId);

    const back = createMenuButton({
      className: "addSlotBackButton",
      title: "← Families",
      desc: `${family.code} · ${family.label}`,
      onClick: () => {
        renderRootMenu();
        queueMicrotask(() => focusButton(0));
      },
    });
    buttons.push(back);
    menu.appendChild(back);

    const menuTitle = document.createElement("div");
    menuTitle.className = "small addSlotMenuHint";
    menuTitle.textContent = `${family.code} subtype`;
    menu.appendChild(menuTitle);

    const defaultItem = createMenuButton({
      className: "addSlotMenuItem accent",
      title: `Default ${family.label}`,
      desc: "Fast add without browsing presets",
      onClick: () => pickAndClose(family.defaultPick),
    });
    buttons.push(defaultItem);
    menu.appendChild(defaultItem);

    for (const item of family.subtypes ?? []) {
      const btn = createMenuButton({
        title: item.label,
        desc: item.desc,
        onClick: () => pickAndClose(item.value),
      });
      buttons.push(btn);
      menu.appendChild(btn);
    }

    const presetHint = document.createElement("div");
    presetHint.className = "small addSlotMenuPhaseHint";
    presetHint.textContent = "Preset browser deferred to phase 2.";
    menu.appendChild(presetHint);
  };

  renderRootMenu();

  let removeOutsideListener: (() => void) | null = null;
  let reposition: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let anchorState: { point?: { x: number; y: number } } = {};

  const currentAnchor = (): FloatingAnchor => {
    if (anchorState.point) return pointAnchor(anchorState.point.x, anchorState.point.y);
    return slot.getBoundingClientRect();
  };

  const focusButton = (index: number) => buttons[(index + buttons.length) % buttons.length]?.focus();

  function closeMenu(opts?: { restoreFocus?: boolean }) {
    menu.classList.add("hidden");
    menu.remove();
    slot.classList.remove("menuOpen");
    slot.setAttribute("aria-expanded", "false");
    if (activeFamily) renderRootMenu();
    if (removeOutsideListener) {
      removeOutsideListener();
      removeOutsideListener = null;
    }
    reposition?.destroy();
    reposition = null;
    anchorState = {};
    if (opts?.restoreFocus) slot.focus();
  }

  const openMenu = (anchor?: { x: number; y: number }, opts?: { focusFirst?: boolean }) => {
    if (!menu.classList.contains("hidden")) {
      closeMenu();
      return;
    }

    renderRootMenu();
    anchorState = anchor ? { point: anchor } : {};
    menu.classList.remove("hidden");
    document.body.appendChild(menu);
    slot.classList.add("menuOpen");
    slot.setAttribute("aria-expanded", "true");
    placeFloatingPanel(menu, currentAnchor(), {
      preferredSide: "bottom",
      align: anchor ? "start" : "center",
      offset: 10,
      minWidth: 260,
      maxWidth: 320,
    });
    reposition = bindFloatingPanelReposition(menu, () => (slot.isConnected ? currentAnchor() : null), {
      preferredSide: "bottom",
      align: anchor ? "start" : "center",
      offset: 10,
      minWidth: 260,
      maxWidth: 320,
    });

    const onDocPointerDown = (e: Event) => {
      const target = e.target as Node;
      if (!menu.contains(target) && !slot.contains(target)) closeMenu();
    };
    const onDocFocusIn = (e: Event) => {
      const target = e.target as Node;
      if (!menu.contains(target) && !slot.contains(target)) closeMenu();
    };
    const onDocKeyDown = (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === "Escape") closeMenu({ restoreFocus: true });
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("focusin", onDocFocusIn, true);
    document.addEventListener("keydown", onDocKeyDown, true);
    removeOutsideListener = () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("focusin", onDocFocusIn, true);
      document.removeEventListener("keydown", onDocKeyDown, true);
    };

    if (opts?.focusFirst) queueMicrotask(() => focusButton(0));
  };

  slot.onclick = (e) => {
    const point = { x: e.clientX, y: e.clientY };
    openMenu(point);
  };
  slot.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu(undefined, { focusFirst: true });
    }
    if (e.key === "ArrowDown" && menu.classList.contains("hidden")) {
      e.preventDefault();
      openMenu(undefined, { focusFirst: true });
    }
    if (e.key === "Escape") closeMenu({ restoreFocus: true });
  };

  menu.addEventListener("keydown", (e) => {
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusButton(currentIndex < 0 ? 0 : currentIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusButton(currentIndex < 0 ? buttons.length - 1 : currentIndex - 1);
    } else if (e.key === "ArrowRight" && !activeFamily && currentIndex >= 0) {
      const family = ADD_MODULE_FAMILIES.find((candidate) => candidate.subtypes?.length && buttons[currentIndex]?.textContent?.includes(candidate.code));
      if (family) {
        e.preventDefault();
        renderSubtypeMenu(family.id);
        queueMicrotask(() => focusButton(0));
      }
    } else if (e.key === "ArrowLeft" && activeFamily) {
      e.preventDefault();
      renderRootMenu();
      queueMicrotask(() => focusButton(0));
    } else if (e.key === "Home") {
      e.preventDefault();
      focusButton(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusButton(buttons.length - 1);
    } else if (e.key === "Tab" && !e.shiftKey && currentIndex === buttons.length - 1) {
      closeMenu();
    } else if (e.key === "Tab" && e.shiftKey && currentIndex === 0) {
      closeMenu({ restoreFocus: true });
    }
  });

  slot.addEventListener("dragenter", (e) => {
    e.preventDefault();
    slot.classList.add("dragReady");
    slot.classList.add("dragMoveReady");
    slot.closest(".moduleCell")?.classList.add("dragMoveReady");
  });
  slot.addEventListener("dragover", (e) => {
    e.preventDefault();
    slot.classList.add("dragReady");
    slot.classList.add("dragMoveReady");
    slot.closest(".moduleCell")?.classList.add("dragMoveReady");
  });
  slot.addEventListener("dragleave", () => {
    slot.classList.remove("dragReady", "dragMoveReady");
    slot.closest(".moduleCell")?.classList.remove("dragMoveReady");
  });
  slot.addEventListener("drop", (e) => {
    e.preventDefault();
    slot.classList.remove("dragReady", "dragMoveReady");
    slot.closest(".moduleCell")?.classList.remove("dragMoveReady");
    const droppedModuleId = e.dataTransfer?.getData("text/module-id") ?? "";
    if (droppedModuleId && params.onDropModule) {
      params.onDropModule(droppedModuleId);
      return;
    }
    const dropped = e.dataTransfer?.getData("text/module-kind") as AddModulePick | "";
    if (!dropped) return;
    params.onPick(dropped);
  });

  slot.append(content);
  return slot;
}
