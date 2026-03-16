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
  const wrap = document.createElement("section");
  wrap.className = "moduleSurface browserSurface";
  wrap.dataset.type = "add";

  const head = document.createElement("div");
  head.className = "surfaceHeader";
  const identity = document.createElement("div");
  identity.className = "surfaceIdentity";
  const badge = document.createElement("span");
  badge.className = "surfaceBadge";
  badge.textContent = "BROWSER";
  const meta = document.createElement("div");
  meta.className = "surfaceNameWrap";
  meta.innerHTML = "<div class='small'>Module router</div><div class='name'>Add Module</div>";
  identity.append(badge, meta);
  head.append(identity, document.createElement("div"));

  const body = document.createElement("div");
  body.className = "browserSurfaceBody";

  wrap.append(head, body);

  let mode: "root" | "visual" = "root";

  const render = () => {
    body.innerHTML = "";
    const hint = document.createElement("div");
    hint.className = "small addModuleHint";
    hint.textContent = mode === "root" ? "Choose family" : "Choose visual surface";

    const grid = document.createElement("div");
    grid.className = "addFamilyGrid";

    if (mode === "root") {
      grid.append(
        createFamilyButton("Trigger", "Sequencing / pulses / probability", () => opts.onPick("trigger"), true),
        createFamilyButton("Drum", "Transient-body-noise sculpting", () => opts.onPick("drum")),
        createFamilyButton("Synth", "Timbre-envelope-filter shaping", () => opts.onPick("tonal")),
        createFamilyButton("Visual", "Scope / spectrum displays", () => { mode = "visual"; render(); }),
      );
      body.append(hint, grid);
      return;
    }

    grid.append(
      createFamilyButton("Scope", "Waveform monitor", () => opts.onPick("scope"), true),
      createFamilyButton("Spectrum", "Frequency monitor", () => opts.onPick("spectrum")),
      createFamilyButton("Back", "Return to families", () => { mode = "root"; render(); }),
    );

    body.append(hint, grid);
  };

  render();
  return wrap;
}
