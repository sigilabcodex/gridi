// src/ui/visualModule.ts
import type { Engine } from "../engine/audio";
import type { Patch, VisualModule } from "../patch";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

export function renderVisualModule(
  parent: HTMLElement,
  engine: Engine,
  _patch: Patch,
  vm: VisualModule,
  onRemove: () => void
) {
  const card = el("section", "card");
  card.dataset.type = "visual";
  card.dataset.kind = vm.kind; // <-- para CSS por tipo si luego quieres

  const header = el("div", "cardHeader");
  const titleRow = el("div", "titleRow");
  const badge = el("span", "badge");
  badge.textContent = "VIS";
  const name = el("div", "name");
  name.textContent = `${vm.kind.toUpperCase()}`;

  titleRow.append(badge, name);

  const right = el("div", "rightControls");

  const btnOn = el("button");
  const updateOn = () => {
    btnOn.textContent = vm.enabled ? "On" : "Off";
    btnOn.className = vm.enabled ? "primary" : "";
  };
  btnOn.onclick = () => {
    vm.enabled = !vm.enabled;
    updateOn();
  };

  const btnX = el("button", "danger");
  btnX.textContent = "×";
  btnX.title = "Remove";
  btnX.onclick = onRemove;

  right.append(btnOn, btnX);

  header.append(titleRow, right);
  card.appendChild(header);

  const body = el("div", "visualBody");

  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  // tamaño inicial razonable (se ajusta luego)
  canvas.width = 800;
  canvas.height = 260;

  body.appendChild(canvas);
  card.appendChild(body);
  parent.appendChild(card);

  updateOn();

  const ctx2d = canvas.getContext("2d")!;
  const scopeBuf = new Float32Array(engine.analyser.fftSize);
  const specBuf = new Float32Array(engine.analyser.frequencyBinCount);

  function resizeIfNeeded() {
    const r = canvas.getBoundingClientRect();

    // GUARD: si está colapsado por layout un frame, NO lo reduzcas a 1×1
    if (r.width < 2 || r.height < 2) return;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = Math.max(2, Math.floor(r.width * dpr));
    const h = Math.max(2, Math.floor(r.height * dpr));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawGrid() {
    const w = canvas.width;
    const h = canvas.height;

    ctx2d.clearRect(0, 0, w, h);

    ctx2d.lineWidth = 1;
    ctx2d.strokeStyle = "rgba(207,214,221,0.12)";

    const cols = 10;
    const rows = 4;

    for (let i = 1; i < cols; i++) {
      const x = (w * i) / cols;
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, h);
      ctx2d.stroke();
    }

    for (let j = 1; j < rows; j++) {
      const y = (h * j) / rows;
      ctx2d.beginPath();
      ctx2d.moveTo(0, y);
      ctx2d.lineTo(w, y);
      ctx2d.stroke();
    }
  }

  function drawScope() {
    engine.getScopeData(scopeBuf);

    const w = canvas.width;
    const h = canvas.height;
    const mid = h * 0.5;

    ctx2d.lineWidth = 2;
    ctx2d.strokeStyle = "rgba(235,240,245,0.95)";
    ctx2d.beginPath();

    const n = scopeBuf.length;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = mid - scopeBuf[i] * (h * 0.42);
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
  }

  function drawSpectrum() {
    engine.getSpectrumData(specBuf);

    const w = canvas.width;
    const h = canvas.height;

    const n = specBuf.length;
    const barW = Math.max(1, Math.floor(w / n));

    ctx2d.fillStyle = "rgba(74,163,255,0.55)";
    for (let i = 0; i < n; i++) {
      const v = specBuf[i]; // 0..1
      const x = i * barW;
      const bh = v * (h * 0.92);
      ctx2d.fillRect(x, h - bh, barW, bh);
    }

    ctx2d.strokeStyle = "rgba(235,240,245,0.35)";
    ctx2d.beginPath();
    ctx2d.moveTo(0, h - 1);
    ctx2d.lineTo(w, h - 1);
    ctx2d.stroke();
  }

  return function update() {
    if (!vm.enabled) return;
    resizeIfNeeded();
    drawGrid();
    if (vm.kind === "scope") drawScope();
    else drawSpectrum();
  };
}
