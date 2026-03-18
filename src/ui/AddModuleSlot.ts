import type { VisualKind } from "../patch";

type Pick = "drum" | "tonal" | "trigger" | "control-lfo" | "control-drift" | "control-stepped" | VisualKind;

type AddSlotParams = {
  insertionIndex: number;
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
  slot.tabIndex = 0;

  const plus = document.createElement("div");
  plus.className = "addModulePlus";
  plus.setAttribute("aria-hidden", "true");
  plus.textContent = "+";

  const label = document.createElement("div");
  label.className = "small addModuleSlotLabel";
  label.textContent = "Add module";

  const menu = document.createElement("div");
  menu.className = "addSlotMenu hidden";

  const menuTitle = document.createElement("div");
  menuTitle.className = "small addSlotMenuHint";
  menuTitle.textContent = "Insert here";
  menu.appendChild(menuTitle);

  for (const item of MENU_ITEMS) {
    menu.appendChild(createMenuButton(item, () => {
      closeMenu();
      params.onPick(item.value);
    }));
  }

  let removeOutsideListener: (() => void) | null = null;

  const closeMenu = (opts?: { restoreFocus?: boolean }) => {
    menu.classList.add("hidden");
    slot.classList.remove("menuOpen");
    if (removeOutsideListener) {
      removeOutsideListener();
      removeOutsideListener = null;
    }
    if (opts?.restoreFocus) slot.focus();
  };

  const openMenu = (anchor?: { x: number; y: number }) => {
    menu.classList.remove("hidden");
    slot.classList.add("menuOpen");
    if (anchor) {
      menu.style.setProperty("--menu-x", `${anchor.x}px`);
      menu.style.setProperty("--menu-y", `${anchor.y}px`);
      menu.classList.add("anchored");
    } else {
      menu.classList.remove("anchored");
      menu.style.removeProperty("--menu-x");
      menu.style.removeProperty("--menu-y");
    }
    const onDocPointerDown = (e: Event) => {
      if (!slot.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    removeOutsideListener = () => document.removeEventListener("pointerdown", onDocPointerDown);
  };

  slot.onclick = (e) => {
    if (!menu.classList.contains("hidden")) {
      closeMenu();
      return;
    }
    const r = slot.getBoundingClientRect();
    openMenu({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  slot.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (menu.classList.contains("hidden")) openMenu();
      else closeMenu();
    }
    if (e.key === "Escape") closeMenu({ restoreFocus: true });
  };

  slot.addEventListener("focusout", (e) => {
    if (!slot.contains(e.relatedTarget as Node)) closeMenu();
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

  slot.dataset.insertionIndex = String(params.insertionIndex);
  slot.append(plus, label, menu);
  return slot;
}
