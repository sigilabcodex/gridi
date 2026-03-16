import type { VisualKind } from "../patch";

type Pick = "drum" | "tonal" | "trigger" | VisualKind;

function createFamilyButton(title: string, desc: string, onClick: () => void, primary = false) {
  const btn = document.createElement("button");
  btn.className = `addFamilyBtn${primary ? " primary" : ""}`;
  const t = document.createElement("div");
  t.className = "addFamilyTitle";
  t.textContent = title;
  const d = document.createElement("div");
  d.className = "small addFamilyDesc";
  d.textContent = desc;
  btn.append(t, d);
  btn.onclick = (e) => { e.preventDefault(); onClick(); };
  return btn;
}

export function renderAddModuleSlot(opts: { onPick: (what: Pick) => void }) {
  const wrap = document.createElement("div");
  wrap.className = "card add-slot-card moduleCard";
  wrap.dataset.type = "add";

  const header = document.createElement("div");
  header.className = "cardHeader";

  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";
  const badge = document.createElement("span");
  badge.className = "familyBadge";
  badge.textContent = "ADD";

  const meta = document.createElement("div");
  meta.className = "moduleTitleWrap";
  const type = document.createElement("div");
  type.className = "small moduleTypeLabel";
  type.textContent = "Module Browser";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = "Add Module";
  meta.append(type, name);

  titleRow.append(badge, meta);
  header.append(titleRow, document.createElement("div"));
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "add-slot-body";
  wrap.appendChild(body);

  let mode: "root" | "visual" = "root";

  const render = () => {
    body.innerHTML = "";
    const hint = document.createElement("div");
    hint.className = "small addModuleHint";
    hint.textContent = mode === "root" ? "Choose a module family" : "Choose a visual module";

    const grid = document.createElement("div");
    grid.className = "addFamilyGrid";

    if (mode === "root") {
      grid.append(
        createFamilyButton("Trigger", "Generative event sources", () => opts.onPick("trigger"), true),
        createFamilyButton("Drum", "Percussive synth voice", () => opts.onPick("drum")),
        createFamilyButton("Tonal", "Melodic or drone synth voice", () => opts.onPick("tonal")),
        createFamilyButton("Visual", "Monitoring and analysis", () => { mode = "visual"; render(); }),
      );

      const future = document.createElement("div");
      future.className = "small addModuleFuture";
      future.textContent = "Future: Algorithm / Livecoding modules";
      body.append(hint, grid, future);
      return;
    }

    grid.append(
      createFamilyButton("Scope", "Waveform monitor", () => opts.onPick("scope"), true),
      createFamilyButton("Spectrum", "Frequency monitor", () => opts.onPick("spectrum")),
      createFamilyButton("Back", "Return to module families", () => { mode = "root"; render(); }),
    );

    body.append(hint, grid);
  };

  render();
  return wrap;
}
