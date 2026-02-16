// src/ui/voiceModule.ts
import type { Patch, Mode, VoiceModule } from "../patch";
import { ctlFloat } from "./ctl";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

export type VoiceTab = "MAIN" | "SEQ" | "MIDI";

type UiState = {
  tab: VoiceTab;
  setTab: (t: VoiceTab) => void;
};

export function renderVoiceModule(
  root: HTMLElement,
  _patch: Patch,
  v: VoiceModule,
  voiceIndex: number,
  getLedState: (voiceIndex: number) => { active: boolean; hit: boolean },
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  ui: UiState,
  onRemove?: () => void
) {
  const card = document.createElement("section");
  card.className = "card";
  card.dataset.type = "voice";
  card.dataset.kind = v.kind;

  // ---- header
  const header = document.createElement("div");
  header.className = "cardHeader";

  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = v.kind === "drum" ? "DRUM" : "TONAL";

  const ledA = document.createElement("div");
  ledA.className = "led";

  const ledHit = document.createElement("div");
  ledHit.className = "led";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = v.name;

  titleRow.append(badge, ledA, ledHit, name);

  const right = document.createElement("div");
  right.className = "rightControls";

  const toggle = document.createElement("button");
  const syncToggle = () => {
    toggle.textContent = v.enabled ? "On" : "Off";
    toggle.className = v.enabled ? "primary" : "";
  };
  syncToggle();

  toggle.onclick = () => {
    onPatchChange(
      (p) => {
        const m = p.modules.find((x) => x.id === v.id);
        if (m && m.type === "voice") m.enabled = !m.enabled;
      },
      { regen: false }
    );
  };

  const btnX = document.createElement("button");
  btnX.textContent = "×";
  btnX.className = "danger";
  btnX.title = "Remove module";
  btnX.onclick = () => onRemove?.();

  right.append(toggle, btnX);
  header.append(titleRow, right);

  // ---- MAIN panel content
  const mainRow = document.createElement("div");
  mainRow.className = "row compactRow";

  // Amp
  mainRow.append(
    ctlFloat({
      label: "Amp",
      value: v.amp,
      min: 0,
      max: 1,
      step: 0.001,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.amp = x;
          },
          { regen: false }
        ),
    })
  );

  // Timbre
  mainRow.append(
    ctlFloat({
      label: "Timbre",
      value: v.timbre,
      min: 0,
      max: 1,
      step: 0.001,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.timbre = x;
          },
          { regen: false }
        ),
    })
  );

  // --- tabs
  const tabs = document.createElement("div");
  tabs.className = "modTabs";

  const btnMain = document.createElement("button");
  btnMain.className = "modTab";
  btnMain.textContent = "MAIN";

  const btnSeq = document.createElement("button");
  btnSeq.className = "modTab";
  btnSeq.textContent = "SEQ";

  const btnMidi = document.createElement("button");
  btnMidi.className = "modTab";
  btnMidi.textContent = "MIDI";

  tabs.append(btnMain, btnSeq, btnMidi);

  // --- panels
  const panelMain = document.createElement("div");
  panelMain.className = "modPanel";
  panelMain.appendChild(mainRow);

    const panelSeq = document.createElement("div");
  panelSeq.className = "modPanel";

  // --- top row: Mode | Seed | ↻
  const seqTopRow = document.createElement("div");
  seqTopRow.className = "seqTopRow";

  // Mode select
  const sel = document.createElement("select");
  for (const mm of MODES) {
    const o = document.createElement("option");
    o.value = mm;
    o.textContent = mm;
    if (mm === v.mode) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () =>
    onPatchChange(
      (p) => {
        const m = p.modules.find((x) => x.id === v.id);
        if (m && m.type === "voice") m.mode = sel.value as Mode;
      },
      { regen: true }
    );

  // Seed input
  const seed = document.createElement("input");
  seed.type = "number";
  seed.value = String(v.seed);
  seed.min = "0";
  seed.max = "999999";
  seed.className = "seedInput";

  seed.onchange = () =>
    onPatchChange(
      (p) => {
        const m = p.modules.find((x) => x.id === v.id);
        if (m && m.type === "voice") m.seed = seed.valueAsNumber | 0;
      },
      { regen: true }
    );

  // Seed regen button
  const seedBtn = document.createElement("button");
  seedBtn.textContent = "↻";
  seedBtn.className = "seedBtn";
  seedBtn.title = "Generate new random seed";

  seedBtn.onclick = (e) => {
    const newSeed = (Math.random() * 1_000_000) | 0;
    seed.value = String(newSeed); // update UI immediately

    onPatchChange(
      (p) => {
        const m = p.modules.find((x) => x.id === v.id);
        if (m && m.type === "voice") m.seed = newSeed;
      },
      { regen: !e.shiftKey }
    );
  };

  // assemble top row
  seqTopRow.append(sel, seed, seedBtn);

  // ---- SEQ controls
  const adv = document.createElement("div");
  adv.className = "adv";

  adv.append(
    ctlFloat({
      label: "Subdiv",
      value: v.subdiv,
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.subdiv = x as any;
          },
          { regen: false }
        ),
    }),
    ctlFloat({
      label: "Length",
      value: v.length,
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.length = x;
          },
          { regen: true }
        ),
    }),
    ctlFloat({
      label: "Density",
      value: v.density,
      min: 0,
      max: 1,
      step: 0.001,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.density = x;
          },
          { regen: true }
        ),
    }),
    ctlFloat({
      label: "Drop",
      value: v.drop,
      min: 0,
      max: 1,
      step: 0.001,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.drop = x;
          },
          { regen: true }
        ),
    }),
    ctlFloat({
      label: "Det",
      value: v.determinism,
      min: 0,
      max: 1,
      step: 0.001,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.determinism = x;
          },
          { regen: true }
        ),
    }),
    ctlFloat({
      label: "Grav",
      value: v.gravity,
      min: 0,
      max: 1,
      step: 0.001,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.gravity = x;
          },
          { regen: true }
        ),
    }),
    ctlFloat({
      label: "Weird",
      value: v.weird,
      min: 0,
      max: 1,
      step: 0.001,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.weird = x;
          },
          { regen: true }
        ),
    }),
    ctlFloat({
      label: "Pan",
      value: v.pan,
      min: -1,
      max: 1,
      step: 0.001,
      center: 0,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.pan = x;
          },
          { regen: false }
        ),
    }),
    ctlFloat({
      label: "Rot",
      value: v.euclidRot,
      min: -32,
      max: 32,
      step: 1,
      integer: true,
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.euclidRot = x;
          },
          { regen: true }
        ),
    }),
    ctlFloat({
      label: "CA Rule",
      value: v.caRule,
      min: 0,
      max: 255,
      step: 1,
      integer: true,
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.caRule = x;
          },
          { regen: true }
        ),
    }),
    ctlFloat({
      label: "CA Init",
      value: v.caInit,
      min: 0,
      max: 1,
      step: 0.001,
      format: (x) => x.toFixed(3),
      onChange: (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.caInit = x;
          },
          { regen: true }
        ),
    })
  );

  const spacer = document.createElement("div");
  spacer.className = "spacer";
  panelSeq.append(seqTopRow, spacer, adv);


  // --- MIDI placeholder
  const panelMidi = document.createElement("div");
  panelMidi.className = "modPanel";
  panelMidi.textContent = "MIDI (coming soon)";

  // --- tab switching (sin re-render)
  const setActiveTab = (t: VoiceTab) => {
    ui.setTab(t);

    btnMain.classList.toggle("active", t === "MAIN");
    btnSeq.classList.toggle("active", t === "SEQ");
    btnMidi.classList.toggle("active", t === "MIDI");

    panelMain.classList.toggle("hidden", t !== "MAIN");
    panelSeq.classList.toggle("hidden", t !== "SEQ");
    panelMidi.classList.toggle("hidden", t !== "MIDI");
  };

  btnMain.onclick = () => setActiveTab("MAIN");
  btnSeq.onclick = () => setActiveTab("SEQ");
  btnMidi.onclick = () => setActiveTab("MIDI");

  // --- ensamblado final del card
  card.append(header, tabs, panelMain, panelSeq, panelMidi);

  // inicializa el tab guardado
  setActiveTab(ui.tab);

  root.appendChild(card);

  return () => {
    const st = getLedState(voiceIndex);
    ledA.className = "led" + (st.active ? " on" : "");
    ledHit.className = "led" + (st.hit ? " on hit" : "");
    syncToggle();
  };
}

function labelEl(t: string) {
  const l = document.createElement("label");
  l.textContent = t;
  return l;
}

function numBox(value: number, min: number, max: number) {
  const n = document.createElement("input");
  n.type = "number";
  n.value = String(value);
  n.min = String(min);
  n.max = String(max);
  return n;
}
