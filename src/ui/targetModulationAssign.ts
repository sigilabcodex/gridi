import type { ModuleType } from "../patch";
import { getTargetParameterGroups } from "./controlTargetCatalog";

export type ModSourceOption = { id: string; label: string };

export function createTargetModulationAssignPanel(params: {
  moduleType: ModuleType;
  modulations: Record<string, string | undefined> | undefined;
  controlOptions: ModSourceOption[];
  onAssign: (parameter: string, sourceId: string | null) => void;
}) {
  const wrap = document.createElement("div");
  wrap.className = "targetModInPanel";

  const groups = getTargetParameterGroups(params.moduleType);
  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "routingChip routingChip-muted";
    empty.textContent = "No mod inputs";
    wrap.appendChild(empty);
    return wrap;
  }

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "targetModInGroup";

    const title = document.createElement("h4");
    title.className = "targetModInGroupTitle";
    title.textContent = group.label;

    const list = document.createElement("div");
    list.className = "targetModInGroupRows";

    group.parameters.forEach((parameter) => {
      const row = document.createElement("label");
      row.className = "targetModInRow";

      const rowLabel = document.createElement("span");
      rowLabel.className = "targetModInLabel";
      rowLabel.textContent = parameter.label;

      const select = document.createElement("select");
      select.className = "compactSelectInput targetModInSelect";

      const none = document.createElement("option");
      none.value = "";
      none.textContent = "None";
      select.appendChild(none);

      params.controlOptions.forEach((option) => {
        const node = document.createElement("option");
        node.value = option.id;
        node.textContent = option.label;
        select.appendChild(node);
      });

      select.value = params.modulations?.[parameter.key] ?? "";
      select.addEventListener("change", () => params.onAssign(parameter.key, select.value || null));

      row.append(rowLabel, select);
      list.appendChild(row);
    });

    section.append(title, list);
    wrap.appendChild(section);
  });

  return wrap;
}
