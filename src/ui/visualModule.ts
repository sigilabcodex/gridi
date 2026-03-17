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
  onRemove: () => void,
) {
  const surface = el("section", "moduleSurface visualSurface");
  surface.dataset.type = "visual";

  const header = el("div", "surfaceHeader");
  const identity = el("div", "surfaceIdentity");
  const badge = el("span", "surfaceBadge");
  badge.textContent = "VISUAL";
  const meta = el("div", "surfaceNameWrap");
  meta.innerHTML = `<div class="name">${vm.name}</div><div class="small">Preset: ${vm.presetName ?? "Scope Default"}</div><div class="small moduleId">${vm.id.slice(-6).toUpperCase()}</div>`;
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

  const face = el("div", "surfaceFace");

  const panelMain = el("div", "surfaceTabPanel visualSurfaceBody");
  const canvasWrap = el("div", "visualDisplayWrap");
  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  canvas.width = 800;
  canvas.height = 260;
  const readout = el("div", "visualReadout small");
  canvasWrap.append(canvas);
  panelMain.append(canvasWrap, readout);

  const panelSettings = el("div", "surfaceTabPanel hidden");
  const dock = el("div", "visualControlDock");
  const mode = document.createElement("select");
  ["scope", "spectrum", "pattern"].forEach((kind) => {
    const o = document.createElement("option");
    o.value = kind;
    o.textContent = kind.toUpperCase();
    if (vm.kind === kind) o.selected = true;
    mode.appendChild(o);
  });
  mode.onchange = () => {
    vm.kind = mode.value as VisualModule["kind"];
  };

  const fft = document.createElement("select");
  [512, 1024, 2048, 4096].forEach((size) => {
    const o = document.createElement("option");
    o.value = String(size);
    o.textContent = `FFT ${size}`;
    if ((vm.fftSize ?? 2048) === size) o.selected = true;
    fft.appendChild(o);
  });
  fft.onchange = () => {
    vm.fftSize = Number(fft.value) as VisualModule["fftSize"];
  };
  dock.append(mode, fft);
  panelSettings.append(dock);

  face.append(panelMain, panelSettings);

  const tabs = el("div", "surfaceTabs");
  const btnMain = document.createElement("button");
  btnMain.className = "modTab";
  btnMain.textContent = "Main";
  const btnSettings = document.createElement("button");
  btnSettings.className = "modTab";
  btnSettings.textContent = "Settings";
  const setTab = (tab: "MAIN" | "SETTINGS") => {
    panelMain.classList.toggle("hidden", tab !== "MAIN");
    panelSettings.classList.toggle("hidden", tab !== "SETTINGS");
    btnMain.classList.toggle("active", tab === "MAIN");
    btnSettings.classList.toggle("active", tab === "SETTINGS");
  };
  btnMain.onclick = () => setTab("MAIN");
  btnSettings.onclick = () => setTab("SETTINGS");
  tabs.append(btnMain, btnSettings);

  surface.append(header, face, tabs);
  parent.appendChild(surface);
  updateOn();
  setTab("MAIN");

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
    readout.textContent = `peak ${peak.toFixed(3)} · ${scopeBuf.length} samples`;
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
    readout.textContent = `avg ${avg.toFixed(3)} · ${specBuf.length} bins`;
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
