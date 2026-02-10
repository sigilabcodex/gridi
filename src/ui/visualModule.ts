// src/ui/visualModule.ts
import type { Engine } from "../engine/audio";
import type { Patch, VisualModule } from "../patch";

function cssVar(root: HTMLElement, name: string, fallback: string) {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  return v || fallback;
}

export function renderVisualModule(
  root: HTMLElement,
  engine: Engine,
  _patch: Patch,
  m: VisualModule,
  onRemove?: () => void
) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.type = "visual";
  card.dataset.kind = m.kind;

  const header = document.createElement("div");
  header.className = "cardHeader";

  const title = document.createElement("div");
  title.className = "titleRow";

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = m.kind === "scope" ? "VIS • SCOPE" : m.kind === "spectrum" ? "VIS • SPEC" : "VIS";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = m.name || "VISUAL";

  title.append(badge, name);

  const right = document.createElement("div");
  right.className = "rightControls";

  const toggle = document.createElement("button");
  const syncToggle = () => {
    toggle.textContent = m.enabled ? "On" : "Off";
    toggle.className = m.enabled ? "primary" : "";
  };
  syncToggle();
  toggle.onclick = () => {
    m.enabled = !m.enabled;
    syncToggle();
  };

  const btnX = document.createElement("button");
  btnX.textContent = "✕";
  btnX.className = "danger";
  btnX.title = "Remove module";
  btnX.onclick = () => onRemove?.();

  right.append(toggle, btnX);

  header.append(title, right);

  const body = document.createElement("div");
  body.className = "visualBody";

  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  canvas.width = 640;
  canvas.height = 180;
  body.appendChild(canvas);

  card.append(header, body);
  root.appendChild(card);

  const g = canvas.getContext("2d")!;

  const timeData = new Uint8Array(engine.analyser.fftSize);
  const freqData = new Uint8Array(engine.analyser.frequencyBinCount);

  // FIX: initial resize glitch -> ResizeObserver + immediate sync
  const ro = new ResizeObserver(() => syncSize());
  ro.observe(body);

  function syncSize() {
    const rect = canvas.getBoundingClientRect();
    const pxW = Math.max(200, Math.floor(rect.width));
    const pxH = Math.max(120, Math.floor(rect.height));
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
  }
  // immediate
  queueMicrotask(syncSize);

  function drawScope() {
    const w = canvas.width;
    const h = canvas.height;

    const bg = cssVar(root, "--scope-bg", "rgba(0,0,0,0)");
    const stroke = cssVar(root, "--scope-stroke", "#cfd6dd");
    const grid = cssVar(root, "--scope-grid", "rgba(207,214,221,0.18)");

    g.clearRect(0, 0, w, h);
    if (bg && bg !== "transparent") {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }

    g.lineWidth = 1;
    g.strokeStyle = grid;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();

    engine.analyser.getByteTimeDomainData(timeData);

    g.lineWidth = 2;
    g.strokeStyle = stroke;
    g.beginPath();

    for (let i = 0; i < timeData.length; i++) {
      const x = (i / (timeData.length - 1)) * w;
      const v = timeData[i] / 255;
      const y = (1 - v) * h;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  function drawSpectrum() {
    const w = canvas.width;
    const h = canvas.height;

    const bg = cssVar(root, "--scope-bg", "rgba(0,0,0,0)");
    const stroke = cssVar(root, "--scope-stroke", "#cfd6dd");
    const grid = cssVar(root, "--scope-grid", "rgba(207,214,221,0.18)");

    g.clearRect(0, 0, w, h);
    if (bg && bg !== "transparent") {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }

    // horizontal grid
    g.lineWidth = 1;
    g.strokeStyle = grid;
    for (let i = 1; i < 4; i++) {
      const y = (h * i) / 4;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }

    engine.analyser.getByteFrequencyData(freqData);

    g.lineWidth = 2;
    g.strokeStyle = stroke;
    g.beginPath();

    for (let i = 0; i < freqData.length; i++) {
      const x = (i / (freqData.length - 1)) * w;
      const v = freqData[i] / 255;
      const y = h - v * h;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  return () => {
    syncSize();
    if (!m.enabled) return;
    if (m.kind === "spectrum") drawSpectrum();
    else drawScope();
  };
}
