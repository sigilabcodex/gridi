import type { Mode, Patch, TriggerModule } from "../patch";
import { ctlFloat } from "./ctl";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

export function renderTriggerModule(
  root: HTMLElement,
  t: TriggerModule,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  onRemove?: () => void,
) {
  const card = document.createElement("section");
  card.className = "card";
  card.dataset.type = "trigger";

  const header = document.createElement("div");
  header.className = "cardHeader";
  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";
  const badge = document.createElement("div"); badge.className = "badge"; badge.textContent = "TRIGGER";
  const name = document.createElement("div"); name.className = "name"; name.textContent = t.name;
  titleRow.append(badge, name);
  const right = document.createElement("div"); right.className = "rightControls";
  const toggle = document.createElement("button");
  const syncToggle = () => { toggle.textContent = t.enabled ? "On" : "Off"; toggle.className = t.enabled ? "primary" : ""; };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => { const m = p.modules.find((x) => x.id === t.id); if (m && m.type === "trigger") m.enabled = !m.enabled; }, { regen: false });
  const btnX = document.createElement("button"); btnX.textContent = "×"; btnX.className = "danger"; btnX.onclick = () => onRemove?.();
  right.append(toggle, btnX);
  header.append(titleRow, right);

  const body = document.createElement("div");
  body.className = "modPanel";
  const top = document.createElement("div"); top.className = "seqTopRow";
  const sel = document.createElement("select");
  for (const m of MODES) { const o = document.createElement("option"); o.value = m; o.textContent = m; if (m === t.mode) o.selected = true; sel.appendChild(o); }
  sel.onchange = () => onPatchChange((p) => { const m = p.modules.find((x) => x.id === t.id); if (m && m.type === "trigger") m.mode = sel.value as Mode; }, { regen: true });
  const seed = document.createElement("input"); seed.type = "number"; seed.value = String(t.seed); seed.className = "seedInput";
  seed.onchange = () => onPatchChange((p) => { const m = p.modules.find((x) => x.id === t.id); if (m && m.type === "trigger") m.seed = seed.valueAsNumber | 0; }, { regen: true });
  top.append(sel, seed);

  const adv = document.createElement("div"); adv.className = "adv";
  const set = (key: keyof TriggerModule, value: number) => onPatchChange((p) => { const m = p.modules.find((x) => x.id === t.id); if (m && m.type === "trigger") (m as any)[key] = value; }, { regen: true });
  adv.append(
    ctlFloat({ label: "Subdiv", value: t.subdiv, min: 1, max: 8, step: 1, integer: true, onChange: (x) => set("subdiv", x) }),
    ctlFloat({ label: "Length", value: t.length, min: 1, max: 128, step: 1, integer: true, onChange: (x) => set("length", x) }),
    ctlFloat({ label: "Density", value: t.density, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("density", x) }),
    ctlFloat({ label: "Drop", value: t.drop, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("drop", x) }),
    ctlFloat({ label: "Det", value: t.determinism, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("determinism", x) }),
    ctlFloat({ label: "Grav", value: t.gravity, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("gravity", x) }),
    ctlFloat({ label: "Weird", value: t.weird, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("weird", x) }),
    ctlFloat({ label: "Rot", value: t.euclidRot, min: -32, max: 32, step: 1, integer: true, onChange: (x) => set("euclidRot", x) }),
    ctlFloat({ label: "CA Rule", value: t.caRule, min: 0, max: 255, step: 1, integer: true, onChange: (x) => set("caRule", x) }),
    ctlFloat({ label: "CA Init", value: t.caInit, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("caInit", x) }),
  );

  body.append(top, adv);
  card.append(header, body);
  root.appendChild(card);

  return () => syncToggle();
}
