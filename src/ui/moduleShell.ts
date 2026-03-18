export type ModuleTabSpec<T extends string> = {
  id: T;
  label: string;
  panel: HTMLElement;
};

export function createModuleTabShell<T extends string>(params: {
  specs: ModuleTabSpec<T>[];
  activeTab: T;
  onTabChange?: (tab: T) => void;
}) {
  const face = document.createElement("div");
  face.className = "surfaceFace";

  const tabs = document.createElement("div");
  tabs.className = "surfaceTabs";
  tabs.setAttribute("role", "tablist");

  const buttons = new Map<T, HTMLButtonElement>();

  const setTab = (tab: T) => {
    params.onTabChange?.(tab);
    for (const spec of params.specs) {
      const active = spec.id === tab;
      spec.panel.classList.toggle("hidden", !active);
      buttons.get(spec.id)?.classList.toggle("active", active);
    }
  };

  for (const spec of params.specs) {
    spec.panel.classList.add("surfaceTabPanel");
    face.appendChild(spec.panel);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "modTab";
    btn.textContent = spec.label;
    btn.title = spec.label;
    btn.onclick = () => setTab(spec.id);
    tabs.appendChild(btn);
    buttons.set(spec.id, btn);
  }

  setTab(params.activeTab);
  return { face, tabs, setTab };
}
