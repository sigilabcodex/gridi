import type { ControlKind, VisualKind } from "../patch";
import {
  formatModulePresetDisplayName,
  getModulePresetSubtypeLabel,
  type ModulePresetRecord,
} from "./persistence/modulePresetStore.ts";
import type { GridPosition } from "../workspacePlacement.ts";
import {
  bindFloatingPanelReposition,
  pointAnchor,
  placeFloatingPanel,
  type FloatingAnchor,
} from "./floatingPanel.ts";
import type { TooltipBinder } from "./tooltip.ts";

export type AddModulePick =
  | "drum"
  | "tonal"
  | "trigger"
  | `control-${ControlKind}`
  | VisualKind;
export type AddModuleFamilyId = "gen" | "drum" | "synth" | "ctrl" | "vis";

type AddSlotParams = {
  position: GridPosition;
  onPick: (what: AddModulePick) => void;
  onPresetPick?: (presetId: string) => void;
  modulePresetRecords?: ModulePresetRecord[];
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

export type AddModuleRootKeyboardMetadata = {
  familyId: AddModuleFamilyId;
  defaultPick: AddModulePick;
  opensSubtypes: boolean;
};

type AddModuleButtonDescriptor = AddModuleRootKeyboardMetadata & {
  element: HTMLButtonElement;
};

const CONTROL_SUBTYPES: AddModuleSubtypeItem[] = [
  {
    label: "LFO",
    shortLabel: "LFO",
    desc: "Cyclic control oscillator",
    value: "control-lfo",
  },
  {
    label: "Drift",
    shortLabel: "Drift",
    desc: "Smooth random control",
    value: "control-drift",
  },
  {
    label: "Stepped",
    shortLabel: "Step",
    desc: "Sample/step control",
    value: "control-stepped",
  },
];

const VISUAL_SUBTYPES: AddModuleSubtypeItem[] = [
  { label: "Scope", shortLabel: "Scope", desc: "Wave monitor", value: "scope" },
  {
    label: "Spectrum",
    shortLabel: "Spec",
    desc: "Frequency monitor",
    value: "spectrum",
  },
  {
    label: "Vectorscope",
    shortLabel: "Vector",
    desc: "Stereo phase view",
    value: "vectorscope",
  },
  {
    label: "Spectral Depth",
    shortLabel: "Depth",
    desc: "Layered spectral field",
    value: "spectral-depth",
  },
  {
    label: "Flow",
    shortLabel: "Flow",
    desc: "Motion-reactive field",
    value: "flow",
  },
  {
    label: "Ritual",
    shortLabel: "Ritual",
    desc: "Symbolic visual meter",
    value: "ritual",
  },
  {
    label: "Glitch",
    shortLabel: "Glitch",
    desc: "Digital-reactive display",
    value: "glitch",
  },
  {
    label: "Cymat",
    shortLabel: "Cymat",
    desc: "Cymatic pattern view",
    value: "cymat",
  },
];

export const ADD_MODULE_FAMILIES: AddModuleFamily[] = [
  {
    id: "gen",
    code: "GEN",
    label: "Generator",
    desc: "Pattern source",
    defaultPick: "trigger",
    accent: true,
  },
  {
    id: "drum",
    code: "DRUM",
    label: "Drum",
    desc: "Percussive voice",
    defaultPick: "drum",
    accent: true,
  },
  {
    id: "synth",
    code: "SYNTH",
    label: "Synth",
    desc: "Tonal voice",
    defaultPick: "tonal",
  },
  {
    id: "ctrl",
    code: "CTRL",
    label: "Control",
    desc: "Modulation sources",
    defaultPick: "control-lfo",
    subtypes: CONTROL_SUBTYPES,
  },
  {
    id: "vis",
    code: "VIS",
    label: "Visual",
    desc: "Signal displays",
    defaultPick: "scope",
    subtypes: VISUAL_SUBTYPES,
  },
];

export function getAddModuleFamily(id: AddModuleFamilyId): AddModuleFamily {
  const family = ADD_MODULE_FAMILIES.find((candidate) => candidate.id === id);
  if (!family) throw new Error(`Unknown add-module family: ${id}`);
  return family;
}

export function getAddModuleSubtypeItems(
  id: AddModuleFamilyId,
): AddModuleSubtypeItem[] {
  return getAddModuleFamily(id).subtypes ?? [];
}

export function getAddModuleRootKeyboardMetadata(): AddModuleRootKeyboardMetadata[] {
  return ADD_MODULE_FAMILIES.map((family) => ({
    familyId: family.id,
    defaultPick: family.defaultPick,
    opensSubtypes: Boolean(family.subtypes?.length),
  }));
}

export type AddModuleFamilySearchResult = {
  family: AddModuleFamily;
  familyMatches: boolean;
  matchedSubtypes: AddModuleSubtypeItem[];
  matchedFactoryPresets: ModulePresetRecord[];
};

function normalizeAddModuleSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase();
}

function modulePresetFamilyForAddModuleFamily(id: AddModuleFamilyId): ModulePresetRecord["family"] {
  if (id === "gen") return "trigger";
  if (id === "synth") return "tonal";
  return id === "ctrl" ? "control" : id === "vis" ? "visual" : "drum";
}

export function getAddModuleFamilyForModulePreset(record: Pick<ModulePresetRecord, "family">): AddModuleFamilyId | null {
  if (record.family === "trigger") return "gen";
  if (record.family === "drum") return "drum";
  if (record.family === "tonal") return "synth";
  if (record.family === "control") return "ctrl";
  if (record.family === "visual") return "vis";
  return null;
}

function addModulePresetMatchesSearch(record: ModulePresetRecord, term: string) {
  const haystack = [
    record.id,
    record.code,
    record.name,
    record.family,
    record.subtype,
    getModulePresetSubtypeLabel(record),
    record.source === "factory" ? "factory" : "user",
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return haystack.includes(term);
}

function factoryPresetsForAddModuleFamily(
  records: ModulePresetRecord[],
  familyId: AddModuleFamilyId,
) {
  const presetFamily = modulePresetFamilyForAddModuleFamily(familyId);
  return records.filter(
    (record) => record.source === "factory" && record.family === presetFamily,
  );
}

function addModuleFamilyMatchesSearch(family: AddModuleFamily, term: string) {
  const haystack = [
    family.id,
    family.code,
    family.label,
    family.desc,
    family.defaultPick,
  ]
    .join(" ")
    .toLocaleLowerCase();
  return haystack.includes(term);
}

function addModuleSubtypeMatchesSearch(
  item: AddModuleSubtypeItem,
  term: string,
) {
  const haystack = [item.label, item.shortLabel, item.desc, item.value]
    .join(" ")
    .toLocaleLowerCase();
  return haystack.includes(term);
}

export function getAddModuleSearchResults(
  query: string,
  records: ModulePresetRecord[] = [],
): AddModuleFamilySearchResult[] {
  const term = normalizeAddModuleSearchTerm(query);
  if (!term) {
    return ADD_MODULE_FAMILIES.map((family) => ({
      family,
      familyMatches: true,
      matchedSubtypes: family.subtypes ?? [],
      matchedFactoryPresets: [],
    }));
  }

  return ADD_MODULE_FAMILIES.map((family) => {
    const familyMatches = addModuleFamilyMatchesSearch(family, term);
    const matchedSubtypes = (family.subtypes ?? []).filter((item) =>
      addModuleSubtypeMatchesSearch(item, term),
    );
    const matchedFactoryPresets = factoryPresetsForAddModuleFamily(
      records,
      family.id,
    ).filter((record) => addModulePresetMatchesSearch(record, term));
    return { family, familyMatches, matchedSubtypes, matchedFactoryPresets };
  }).filter(
    (result) =>
      result.familyMatches ||
      result.matchedSubtypes.length > 0 ||
      result.matchedFactoryPresets.length > 0,
  );
}

function createMenuButton(options: {
  className?: string;
  title: string;
  desc?: string;
  meta?: string;
  onClick: () => void;
}) {
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
    desc.textContent = options.meta
      ? `${options.meta} · ${options.desc ?? ""}`
      : (options.desc ?? "");
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
  let rootButtonDescriptors: AddModuleButtonDescriptor[] = [];
  let searchQuery = "";

  const pickAndClose = (what: AddModulePick) => {
    closeMenu();
    params.onPick(what);
  };

  const pickPresetAndClose = (presetId: string) => {
    if (!params.onPresetPick) return;
    closeMenu();
    params.onPresetPick(presetId);
  };

  const appendFactoryPresetButtons = (records: ModulePresetRecord[]) => {
    if (!params.onPresetPick || records.length === 0) return;

    const label = document.createElement("div");
    label.className = "small addSlotMenuSectionLabel";
    label.textContent = "Factory presets";
    menu.appendChild(label);

    const list = document.createElement("div");
    list.className = "addSlotFactoryPresetList";
    for (const record of records) {
      const presetButton = createMenuButton({
        className: "addSlotMenuItem addSlotFactoryPreset",
        title: formatModulePresetDisplayName(record),
        desc: getModulePresetSubtypeLabel(record),
        onClick: () => pickPresetAndClose(record.id),
      });
      presetButton.dataset.presetId = record.id;
      presetButton.dataset.presetCode = record.code ?? "";
      buttons.push(presetButton);
      list.appendChild(presetButton);
    }
    menu.appendChild(list);
  };

  const renderRootMenu = (opts?: { focusSearch?: boolean }) => {
    activeFamily = null;
    buttons = [];
    rootButtonDescriptors = [];
    menu.replaceChildren();

    const menuTitle = document.createElement("div");
    menuTitle.className = "small addSlotMenuHint";
    menuTitle.textContent = `Insert at (${params.position.x}, ${params.position.y})`;
    menu.appendChild(menuTitle);

    const searchWrap = document.createElement("label");
    searchWrap.className = "addSlotSearchWrap";

    const searchLabel = document.createElement("span");
    searchLabel.className = "small addSlotSearchLabel";
    searchLabel.textContent = "Find";
    searchWrap.appendChild(searchLabel);

    const searchInput = document.createElement("input");
    searchInput.className = "addSlotSearchInput";
    searchInput.type = "search";
    searchInput.autocomplete = "off";
    searchInput.spellcheck = false;
    searchInput.placeholder = "GEN, LFO, Scope…";
    searchInput.value = searchQuery;
    searchInput.setAttribute(
      "aria-label",
      "Filter module families and subtypes",
    );
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value;
      renderRootMenu({ focusSearch: true });
    });
    searchWrap.appendChild(searchInput);
    menu.appendChild(searchWrap);

    if (opts?.focusSearch) {
      queueMicrotask(() => {
        searchInput.focus();
        searchInput.setSelectionRange(
          searchInput.value.length,
          searchInput.value.length,
        );
      });
    }

    const browserHint = document.createElement("div");
    browserHint.className = "small addSlotMenuPhaseHint";
    browserHint.textContent = searchQuery.trim()
      ? "Filtered families and subtypes."
      : "Choose a family.";
    menu.appendChild(browserHint);

    const searchResults = getAddModuleSearchResults(searchQuery, params.modulePresetRecords ?? []);
    if (!searchResults.length) {
      const empty = document.createElement("div");
      empty.className = "small addSlotMenuEmpty";
      empty.textContent = "No matching family, subtype, or preset.";
      menu.appendChild(empty);
      return;
    }

    for (const result of searchResults) {
      const family = result.family;
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
      rootButtonDescriptors.push({
        element: familyButton,
        familyId: family.id,
        defaultPick: family.defaultPick,
        opensSubtypes: Boolean(family.subtypes?.length),
      });
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
        rootButtonDescriptors.push({
          element: quickButton,
          familyId: family.id,
          defaultPick: family.defaultPick,
          opensSubtypes: false,
        });
        row.appendChild(quickButton);
      }

      menu.appendChild(row);

      const shouldShowSubtypeMatches =
        searchQuery.trim() && result.matchedSubtypes.length > 0;
      if (shouldShowSubtypeMatches) {
        const subtypeList = document.createElement("div");
        subtypeList.className = "addSlotSearchSubtypeList";
        for (const item of result.matchedSubtypes) {
          const subtypeButton = createMenuButton({
            className: "addSlotMenuItem addSlotSearchSubtype",
            title: item.label,
            desc: `${family.code} · ${item.desc}`,
            onClick: () => pickAndClose(item.value),
          });
          buttons.push(subtypeButton);
          subtypeList.appendChild(subtypeButton);
        }
        menu.appendChild(subtypeList);
      }

      if (searchQuery.trim()) {
        appendFactoryPresetButtons(result.matchedFactoryPresets);
      }
    }
  };

  const renderSubtypeMenu = (familyId: AddModuleFamilyId) => {
    activeFamily = familyId;
    buttons = [];
    rootButtonDescriptors = [];
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

    appendFactoryPresetButtons(
      factoryPresetsForAddModuleFamily(params.modulePresetRecords ?? [], familyId),
    );
  };

  renderRootMenu();

  let removeOutsideListener: (() => void) | null = null;
  let reposition: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let anchorState: { point?: { x: number; y: number } } = {};

  const currentAnchor = (): FloatingAnchor => {
    if (anchorState.point)
      return pointAnchor(anchorState.point.x, anchorState.point.y);
    return slot.getBoundingClientRect();
  };

  const focusButton = (index: number) =>
    buttons[(index + buttons.length) % buttons.length]?.focus();

  function closeMenu(opts?: { restoreFocus?: boolean }) {
    menu.classList.add("hidden");
    menu.remove();
    slot.classList.remove("menuOpen");
    slot.setAttribute("aria-expanded", "false");
    if (activeFamily || searchQuery) {
      searchQuery = "";
      renderRootMenu();
    }
    if (removeOutsideListener) {
      removeOutsideListener();
      removeOutsideListener = null;
    }
    reposition?.destroy();
    reposition = null;
    anchorState = {};
    if (opts?.restoreFocus) slot.focus();
  }

  const openMenu = (
    anchor?: { x: number; y: number },
    opts?: { focusFirst?: boolean },
  ) => {
    if (!menu.classList.contains("hidden")) {
      closeMenu();
      return;
    }

    searchQuery = "";
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
    reposition = bindFloatingPanelReposition(
      menu,
      () => (slot.isConnected ? currentAnchor() : null),
      {
        preferredSide: "bottom",
        align: anchor ? "start" : "center",
        offset: 10,
        minWidth: 260,
        maxWidth: 320,
      },
    );

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
      if (keyEvent.key !== "Escape") return;
      if (searchQuery && menu.contains(keyEvent.target as Node)) {
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
        searchQuery = "";
        renderRootMenu({ focusSearch: true });
        return;
      }
      closeMenu({ restoreFocus: true });
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
    const currentIndex = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const isSearchFocused =
      document.activeElement instanceof HTMLInputElement &&
      document.activeElement.classList.contains("addSlotSearchInput");
    if (e.key === "Escape" && searchQuery) {
      e.preventDefault();
      e.stopPropagation();
      searchQuery = "";
      renderRootMenu({ focusSearch: true });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusButton(currentIndex < 0 || isSearchFocused ? 0 : currentIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusButton(
        currentIndex < 0 || isSearchFocused
          ? buttons.length - 1
          : currentIndex - 1,
      );
    } else if (e.key === "ArrowRight" && !activeFamily && currentIndex >= 0) {
      const descriptor = rootButtonDescriptors.find(
        (candidate) => candidate.element === buttons[currentIndex],
      );
      if (descriptor?.opensSubtypes) {
        e.preventDefault();
        renderSubtypeMenu(descriptor.familyId);
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
    } else if (
      e.key === "Tab" &&
      !e.shiftKey &&
      currentIndex === buttons.length - 1
    ) {
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
    const dropped = e.dataTransfer?.getData("text/module-kind") as
      | AddModulePick
      | "";
    if (!dropped) return;
    params.onPick(dropped);
  });

  slot.append(content);
  return slot;
}
