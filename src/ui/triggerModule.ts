import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat } from "./ctl";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

function createConnectionPill(label: string, value: string, strong = false) {
  const pill = document.createElement("div");
  pill.className = `connectionPill${strong ? " strong" : ""}`;
  const l = document.createElement("span");
  l.className = "small";
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "connectionPillValue";
  v.textContent = value;
  pill.append(l, v);
  return pill;
}

export function renderTriggerModule(
  root: HTMLElement,
  t: TriggerModule,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  onRemove?: () => void,
) {
  const card = document.createElement("section");
  card.className = "card moduleCard";
  card.dataset.type = "trigger";

  const header = document.createElement("div");
  header.className = "cardHeader";

  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";
  const badge = document.createElement("div");
  badge.className = "familyBadge";
  badge.textContent = "TRIGGER";

  const meta = document.createElement("div");
  meta.className = "moduleTitleWrap";
  const kind = document.createElement("div");
  kind.className = "small moduleTypeLabel";
  kind.textContent = "Trigger Module";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = t.name;
  const idRef = document.createElement("div");
  idRef.className = "small moduleId";
  idRef.textContent = `ID ${t.id.slice(-6).toUpperCase()}`;
  meta.append(kind, name, idRef);
  titleRow.append(badge, meta);

  const right = document.createElement("div");
  right.className = "rightControls";
  const toggle = document.createElement("button");
  const syncToggle = () => {
    toggle.textContent = t.enabled ? "On" : "Off";
    toggle.className = t.enabled ? "primary" : "";
  };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m && m.type === "trigger") m.enabled = !m.enabled;
  }, { regen: false });
  const btnX = document.createElement("button");
  btnX.textContent = "×";
  btnX.className = "danger";
  btnX.onclick = () => onRemove?.();
  right.append(toggle, btnX);
  header.append(titleRow, right);

  const relations = document.createElement("div");
  relations.className = "moduleRelations";
  relations.append(
    createConnectionPill("Role", "Event generator", true),
    createConnectionPill("Mode", t.mode.toUpperCase()),
  );

  const mainPanel = document.createElement("div");
  mainPanel.className = "moduleMainPanel";
  const top = document.createElement("div");
  top.className = "seqTopRow";
  const modeLabel = document.createElement("div");
  modeLabel.className = "small";
  modeLabel.textContent = "Mode";
  const sel = document.createElement("select");
  for (const m of MODES) {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    if (m === t.mode) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m && m.type === "trigger") m.mode = sel.value as Mode;
  }, { regen: true });

  const seed = document.createElement("input");
  seed.type = "number";
  seed.value = String(t.seed);
  seed.className = "seedInput";
  seed.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m && m.type === "trigger") m.seed = seed.valueAsNumber | 0;
  }, { regen: true });

  top.append(modeLabel, sel, seed);

  const params = document.createElement("div");
  params.className = "adv triggerMainGrid";
  const set = (key: keyof TriggerModule, value: number) => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m && m.type === "trigger") (m as any)[key] = value;
  }, { regen: true });

  params.append(
    ctlFloat({ label: "Density", value: t.density, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("density", x) }),
    ctlFloat({ label: "Determinism", value: t.determinism, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("determinism", x) }),
    ctlFloat({ label: "Gravity", value: t.gravity, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("gravity", x) }),
    ctlFloat({ label: "Weirdness", value: t.weird, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("weird", x) }),
    ctlFloat({ label: "Drop", value: t.drop, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("drop", x) }),
    ctlFloat({ label: "Subdivision", value: t.subdiv, min: 1, max: 8, step: 1, integer: true, onChange: (x) => set("subdiv", x) }),
    ctlFloat({ label: "Length", value: t.length, min: 1, max: 128, step: 1, integer: true, onChange: (x) => set("length", x) }),
  );

  const patternPreview = document.createElement("div");
  patternPreview.className = "triggerPatternPreview";
  patternPreview.textContent = getPatternPreview(t, `${t.id}:preview`, 32);
  patternPreview.title = "First 32 pattern steps for current mode";

  mainPanel.append(top, params, patternPreview);

  const tabs = document.createElement("div");
  tabs.className = "modTabs";
  const panelSequence = document.createElement("div");
  panelSequence.className = "modPanel";
  panelSequence.append(patternPreview.cloneNode(true));

  const panelConnections = document.createElement("div");
  panelConnections.className = "modPanel hidden";
  const connTxt = document.createElement("div");
  connTxt.className = "small";
  connTxt.textContent = "This trigger can be selected as source in drum/tonal module connection tabs.";
  panelConnections.append(connTxt);

  const panelSettings = document.createElement("div");
  panelSettings.className = "modPanel hidden";
  const extra = document.createElement("div");
  extra.className = "adv";
  extra.append(
    ctlFloat({ label: "Rotation", value: t.euclidRot, min: -32, max: 32, step: 1, integer: true, onChange: (x) => set("euclidRot", x) }),
    ctlFloat({ label: "CA Rule", value: t.caRule, min: 0, max: 255, step: 1, integer: true, onChange: (x) => set("caRule", x) }),
    ctlFloat({ label: "CA Init", value: t.caInit, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => set("caInit", x) }),
  );
  panelSettings.append(extra);

  const btnSeq = document.createElement("button");
  btnSeq.className = "modTab";
  btnSeq.textContent = "Trigger View";
  const btnCon = document.createElement("button");
  btnCon.className = "modTab";
  btnCon.textContent = "Connections";
  const btnSet = document.createElement("button");
  btnSet.className = "modTab";
  btnSet.textContent = "Settings";

  const setTab = (tab: "MAIN" | "SEQ" | "CON" | "SET") => {
    mainPanel.classList.toggle("hidden", tab !== "MAIN");
    panelSequence.classList.toggle("hidden", tab !== "SEQ");
    panelConnections.classList.toggle("hidden", tab !== "CON");
    panelSettings.classList.toggle("hidden", tab !== "SET");
    btnMain.classList.toggle("active", tab === "MAIN");
    btnSeq.classList.toggle("active", tab === "SEQ");
    btnCon.classList.toggle("active", tab === "CON");
    btnSet.classList.toggle("active", tab === "SET");
  };

  const btnMain = document.createElement("button");
  btnMain.className = "modTab active";
  btnMain.textContent = "Main";
  btnMain.onclick = () => setTab("MAIN");
  btnSeq.onclick = () => setTab("SEQ");
  btnCon.onclick = () => setTab("CON");
  btnSet.onclick = () => setTab("SET");

  tabs.append(btnMain, btnSeq, btnCon, btnSet);
  card.append(header, relations, mainPanel, tabs, panelSequence, panelConnections, panelSettings);
  root.appendChild(card);

  return () => syncToggle();
}
