export type ModuleTabSpec<T extends string> = {
  id: T;
  label: string;
  panel: HTMLElement;
};

let nextTabShellId = 0;

export function createModuleTabShell<T extends string>(params: {
  specs: ModuleTabSpec<T>[];
  activeTab: T;
  onTabChange?: (tab: T) => void;
}) {
  const shellId = ++nextTabShellId;
  const face = document.createElement("div");
  face.className = "surfaceFace";

  const tabs = document.createElement("div");
  tabs.className = "surfaceTabs";
  tabs.setAttribute("role", "tablist");

  const buttons = new Map<T, HTMLButtonElement>();
  const tabOrder = params.specs.map((spec) => spec.id);

  const focusTab = (tab: T) => buttons.get(tab)?.focus();

  for (const spec of params.specs) {
    spec.panel.classList.add("surfaceTabPanel");
    spec.panel.setAttribute("role", "tabpanel");
    spec.panel.id = `module-tabpanel-${shellId}-${String(spec.id).toLowerCase()}`;
    face.appendChild(spec.panel);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "modTab";
    btn.textContent = spec.label;
    btn.title = spec.label;
    btn.id = `module-tab-${shellId}-${String(spec.id).toLowerCase()}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", spec.panel.id);
    spec.panel.setAttribute("aria-labelledby", btn.id);
    btn.onclick = () => setTab(spec.id);
    btn.addEventListener("keydown", (e) => {
      const current = tabOrder.indexOf(spec.id);
      if (current < 0) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = tabOrder[(current + 1) % tabOrder.length];
        setTab(next);
        focusTab(next);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = tabOrder[(current - 1 + tabOrder.length) % tabOrder.length];
        setTab(prev);
        focusTab(prev);
      } else if (e.key === "Home") {
        e.preventDefault();
        const first = tabOrder[0];
        setTab(first);
        focusTab(first);
      } else if (e.key === "End") {
        e.preventDefault();
        const last = tabOrder[tabOrder.length - 1];
        setTab(last);
        focusTab(last);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setTab(spec.id);
      }
    });
    tabs.appendChild(btn);
    buttons.set(spec.id, btn);
  }

  const setTab = (tab: T) => {
    params.onTabChange?.(tab);
    for (const spec of params.specs) {
      const active = spec.id === tab;
      spec.panel.classList.toggle("hidden", !active);
      spec.panel.setAttribute("aria-hidden", String(!active));

      const btn = buttons.get(spec.id);
      btn?.classList.toggle("active", active);
      btn?.setAttribute("aria-selected", String(active));
      if (btn) btn.tabIndex = active ? 0 : -1;
    }
  };

  setTab(params.activeTab);
  return { face, tabs, setTab };
}


export function createModuleIdentityMeta(params: {
  badgeText: string;
  instanceName: string;
  instanceId: string;
  presetButton: HTMLElement;
}) {
  const identity = document.createElement("div");
  identity.className = "surfaceIdentity";

  const badge = document.createElement("div");
  badge.className = "surfaceBadge";
  badge.textContent = params.badgeText;

  const meta = document.createElement("div");
  meta.className = "surfaceNameWrap";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = params.instanceName;

  const presetRow = document.createElement("div");
  presetRow.className = "surfacePresetRow";
  const presetLabel = document.createElement("div");
  presetLabel.className = "small surfaceMetaLabel";
  presetLabel.textContent = "Preset";
  presetRow.append(presetLabel, params.presetButton);

  const moduleId = document.createElement("div");
  moduleId.className = "small moduleId";
  moduleId.textContent = params.instanceId;

  meta.append(name, presetRow, moduleId);
  identity.append(badge, meta);
  return identity;
}
