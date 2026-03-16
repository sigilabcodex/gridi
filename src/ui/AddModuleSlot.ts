import type { VisualKind } from "../patch";

type Pick = "drum" | "tonal" | "trigger" | VisualKind;

type AddSlotParams = {
  family: "trigger" | "drum" | "tonal" | "visual";
  onPick: (what: Pick) => void;
};

type MenuItem = { label: string; desc: string; value: Pick; accent?: boolean };

const FAMILY_ITEMS: Record<AddSlotParams["family"], MenuItem[]> = {
  trigger: [{ label: "Trigger", desc: "Pulse + probability sequencer", value: "trigger", accent: true }],
  drum: [{ label: "Drum", desc: "Transient/body/noise voice", value: "drum", accent: true }],
  tonal: [{ label: "Synth", desc: "Tonal voice architecture", value: "tonal", accent: true }],
  visual: [
    { label: "Scope", desc: "Waveform monitor", value: "scope", accent: true },
    { label: "Spectrum", desc: "Frequency monitor", value: "spectrum" },
  ],
};

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
  slot.dataset.family = params.family;
  slot.tabIndex = 0;

  const plus = document.createElement("div");
  plus.className = "addModulePlus";
  plus.setAttribute("aria-hidden", "true");
  plus.textContent = "+";

  const label = document.createElement("div");
  label.className = "small addModuleSlotLabel";
  label.textContent = `Add ${params.family === "tonal" ? "synth" : params.family} module`;

  const menu = document.createElement("div");
  menu.className = "addSlotMenu hidden";

  const menuTitle = document.createElement("div");
  menuTitle.className = "small addSlotMenuHint";
  menuTitle.textContent = "Insert here";
  menu.appendChild(menuTitle);

  for (const item of FAMILY_ITEMS[params.family]) {
    menu.appendChild(createMenuButton(item, () => {
      closeMenu();
      params.onPick(item.value);
    }));
  }

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
  };

  const closeMenu = () => {
    menu.classList.add("hidden");
    slot.classList.remove("menuOpen");
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
    if (e.key === "Escape") closeMenu();
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
    const dropped = e.dataTransfer?.getData("text/module-kind") as Pick | "";
    if (!dropped) return;
    if (params.family === "visual" && (dropped === "scope" || dropped === "spectrum")) params.onPick(dropped);
    if (params.family === "trigger" && dropped === "trigger") params.onPick(dropped);
    if (params.family === "drum" && dropped === "drum") params.onPick(dropped);
    if (params.family === "tonal" && dropped === "tonal") params.onPick(dropped);
  });

  slot.append(plus, label, menu);
  return slot;
}
