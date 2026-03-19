import type { VisualKind } from "../patch";
import type { GridPosition } from "../workspacePlacement.ts";
import { bindFloatingPanelReposition, pointAnchor, placeFloatingPanel, type FloatingAnchor } from "./floatingPanel";

type Pick = "drum" | "tonal" | "trigger" | "control-lfo" | "control-drift" | "control-stepped" | VisualKind;

type AddSlotParams = {
  position: GridPosition;
  onPick: (what: Pick) => void;
  onDropModule?: (moduleId: string) => void;
};

type MenuItem = { label: string; desc: string; value: Pick; accent?: boolean };

const MENU_ITEMS: MenuItem[] = [
  { label: "Trigger", desc: "Pulse sequencer", value: "trigger", accent: true },
  { label: "Drum", desc: "Percussive voice", value: "drum", accent: true },
  { label: "Synth", desc: "Tonal voice", value: "tonal" },
  { label: "LFO", desc: "Control oscillator", value: "control-lfo" },
  { label: "Drift", desc: "Smooth random control", value: "control-drift" },
  { label: "Stepped", desc: "Sample/step control", value: "control-stepped" },
  { label: "Scope", desc: "Wave monitor", value: "scope" },
  { label: "Spectrum", desc: "Frequency monitor", value: "spectrum" },
];

function createMenuButton(item: MenuItem, onClick: () => void) {
  const btn = document.createElement("button");
  btn.className = `addSlotMenuItem${item.accent ? " accent" : ""}`;
  btn.type = "button";
  btn.setAttribute("role", "menuitem");

  const title = document.createElement("div");
  title.className = "addSlotMenuTitle";
  title.textContent = item.label;

  const desc = document.createElement("div");
  desc.className = "small addSlotMenuDesc";
  desc.textContent = item.desc;

  btn.append(title, desc);
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
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

  const plus = document.createElement("div");
  plus.className = "addModulePlus";
  plus.setAttribute("aria-hidden", "true");
  plus.textContent = "+";

  const label = document.createElement("div");
  label.className = "small addModuleSlotLabel";
  label.textContent = "Add module";

  const menu = document.createElement("div");
  menu.className = "floatingPanel addSlotMenu hidden";
  menu.setAttribute("role", "menu");

  const menuTitle = document.createElement("div");
  menuTitle.className = "small addSlotMenuHint";
  menuTitle.textContent = `Insert at (${params.position.x}, ${params.position.y})`;
  menu.appendChild(menuTitle);

  const buttons: HTMLButtonElement[] = [];
  for (const item of MENU_ITEMS) {
    const btn = createMenuButton(item, () => {
      closeMenu();
      params.onPick(item.value);
    });
    buttons.push(btn);
    menu.appendChild(btn);
  }

  let removeOutsideListener: (() => void) | null = null;
  let reposition: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let anchorState: { point?: { x: number; y: number } } = {};

  const currentAnchor = (): FloatingAnchor => {
    if (anchorState.point) return pointAnchor(anchorState.point.x, anchorState.point.y);
    return slot.getBoundingClientRect();
  };

  const focusButton = (index: number) => buttons[(index + buttons.length) % buttons.length]?.focus();

  const closeMenu = (opts?: { restoreFocus?: boolean }) => {
    menu.classList.add("hidden");
    menu.remove();
    slot.classList.remove("menuOpen");
    slot.setAttribute("aria-expanded", "false");
    if (removeOutsideListener) {
      removeOutsideListener();
      removeOutsideListener = null;
    }
    reposition?.destroy();
    reposition = null;
    anchorState = {};
    if (opts?.restoreFocus) slot.focus();
  };

  const openMenu = (anchor?: { x: number; y: number }, opts?: { focusFirst?: boolean }) => {
    if (!menu.classList.contains("hidden")) {
      closeMenu();
      return;
    }

    anchorState = anchor ? { point: anchor } : {};
    menu.classList.remove("hidden");
    document.body.appendChild(menu);
    slot.classList.add("menuOpen");
    slot.setAttribute("aria-expanded", "true");
    placeFloatingPanel(menu, currentAnchor(), {
      preferredSide: "bottom",
      align: anchor ? "start" : "center",
      offset: 10,
      minWidth: 220,
      maxWidth: 260,
    });
    reposition = bindFloatingPanelReposition(menu, () => (slot.isConnected ? currentAnchor() : null), {
      preferredSide: "bottom",
      align: anchor ? "start" : "center",
      offset: 10,
      minWidth: 220,
      maxWidth: 260,
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
  });
  slot.addEventListener("dragover", (e) => {
    e.preventDefault();
    slot.classList.add("dragReady");
  });
  slot.addEventListener("dragleave", () => slot.classList.remove("dragReady"));
  slot.addEventListener("drop", (e) => {
    e.preventDefault();
    slot.classList.remove("dragReady");
    const droppedModuleId = e.dataTransfer?.getData("text/module-id") ?? "";
    if (droppedModuleId && params.onDropModule) {
      params.onDropModule(droppedModuleId);
      return;
    }
    const dropped = e.dataTransfer?.getData("text/module-kind") as Pick | "";
    if (!dropped) return;
    params.onPick(dropped);
  });

  slot.append(plus, label);
  return slot;
}
