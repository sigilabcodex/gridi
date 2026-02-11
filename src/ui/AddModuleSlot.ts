// src/ui/AddModuleSlot.ts
import type { VisualKind } from "../patch";

type Pick = "drum" | "tonal" | VisualKind;

export function renderAddModuleSlot(opts: { onPick: (what: Pick) => void }) {
  const wrap = document.createElement("div");
  wrap.className = "card add-slot-card";
  wrap.dataset.type = "visual";

  const header = document.createElement("div");
  header.className = "cardHeader";

  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "+";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = "Add module";

  titleRow.append(badge, name);

  const right = document.createElement("div");
  right.className = "rightControls";

  header.append(titleRow, right);
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "add-slot-body";
  wrap.appendChild(body);

  let mode: "root" | "visual" = "root";

  const mkBtn = (label: string, onClick: () => void, primary = false) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (primary) b.className = "primary";
    b.onclick = (e) => {
      e.preventDefault();
      onClick();
    };
    return b;
  };

  function render() {
    body.innerHTML = "";

    const hint = document.createElement("div");
    hint.className = "small";
    hint.textContent = mode === "root" ? "Choose type" : "Choose visual";
    body.appendChild(hint);

    const row = document.createElement("div");
    row.className = "add-slot-row";

    if (mode === "root") {
      row.append(
        mkBtn("Drum", () => opts.onPick("drum"), true),
        mkBtn("Tonal", () => opts.onPick("tonal")),
        mkBtn("Visual", () => {
          mode = "visual";
          render();
        })
      );
    } else {
      row.append(
        mkBtn("Scope", () => opts.onPick("scope"), true),
        mkBtn("Spectrum", () => opts.onPick("spectrum")),
        mkBtn("Back", () => {
          mode = "root";
          render();
        })
      );
    }

    body.appendChild(row);

    const sub = document.createElement("div");
    sub.className = "small add-slot-sub";
    sub.textContent = mode === "root" ? "Drum / Tonal / Visual" : "Scope / Spectrum";
    body.appendChild(sub);
  }

  render();
  return wrap;
}
