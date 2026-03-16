import type { Engine } from "../engine/audio";
import type { Patch, VisualModule } from "../patch";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

export function renderVisualSurface(
  parent: HTMLElement,
  engine: Engine,
  _patch: Patch,
  vm: VisualModule,
  onRemove: () => void
) {
  const surface = el("section", "moduleSurface visualSurface");
  surface.dataset.type = "visual";

  const header = el("div", "surfaceHeader");
  const identity = el("div", "surfaceIdentity");
  const badge = el("span", "surfaceBadge");
  badge.textContent = "VISUAL";
  const meta = el("div", "surfaceNameWrap");
  meta.innerHTML = `<div class="small">Reactive display</div><div class="name">${vm.kind.toUpperCase()}</div><div class="small moduleId">ID ${vm.id.slice(-6).toUpperCase()}</div>`;
  identity.append(badge, meta);

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
  btnX.onclick = onRemove;
  right.append(btnOn, btnX);
  header.append(identity, right);

  const body = el("div", "visualSurfaceBody");
  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  canvas.width = 800;
  canvas.height = 260;

  const readout = el("div", "visualReadout small");
  body.append(canvas, readout);
  surface.append(header, body);
  parent.appendChild(surface);
  updateOn();

  const ctx2d = canvas.getContext("2d")!;
  const scopeBuf = new Float32Array(engine.analyser.fftSize);
  const specBuf = new Float32Array(engine.analyser.frequencyBinCount);

  function resizeIfNeeded() {
    const r = canvas.getBoundingClientRect();
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
    ctx2d.strokeStyle = "rgba(207,214,221,0.10)";
    for (let i = 1; i < 8; i++) {
      const x = (w * i) / 8;
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, h);
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
    for (let i = 0; i < scopeBuf.length; i++) {
      const x = (i / (scopeBuf.length - 1)) * w;
      const y = mid - scopeBuf[i] * (h * 0.42);
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();

    const peak = Math.max(...scopeBuf.map((x) => Math.abs(x)));
    readout.textContent = `wave peak ${peak.toFixed(3)} · window ${scopeBuf.length} samples`;
  }

  function drawSpectrum() {
    engine.getSpectrumData(specBuf);
    const w = canvas.width;
    const h = canvas.height;
    const barW = Math.max(1, Math.floor(w / specBuf.length));
    ctx2d.fillStyle = "rgba(74,163,255,0.55)";
    for (let i = 0; i < specBuf.length; i++) {
      const x = i * barW;
      const bh = specBuf[i] * (h * 0.92);
      ctx2d.fillRect(x, h - bh, barW, bh);
    }
    const avg = specBuf.reduce((a, b) => a + b, 0) / Math.max(1, specBuf.length);
    readout.textContent = `spectrum avg ${avg.toFixed(3)} · bins ${specBuf.length}`;
  }

  return function update() {
    if (!vm.enabled) return;
    resizeIfNeeded();
    drawGrid();
    if (vm.kind === "scope") drawScope();
    else drawSpectrum();
  };
}

export const renderVisualModule = renderVisualSurface;
