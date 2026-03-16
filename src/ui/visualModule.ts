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
  const card = el("section", "card moduleCard");
  card.dataset.type = "visual";

  const header = el("div", "cardHeader");
  const titleRow = el("div", "titleRow");
  const badge = el("span", "familyBadge");
  badge.textContent = "VISUAL";

  const meta = el("div", "moduleTitleWrap");
  const moduleType = el("div", "small moduleTypeLabel");
  moduleType.textContent = "Visual Module";
  const name = el("div", "name");
  name.textContent = vm.kind.toUpperCase();
  const idRef = el("div", "small moduleId");
  idRef.textContent = `ID ${vm.id.slice(-6).toUpperCase()}`;
  meta.append(moduleType, name, idRef);

  titleRow.append(badge, meta);

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

  const relationRow = el("div", "moduleRelations");
  const role = el("div", "connectionPill strong");
  role.innerHTML = `<span class="small">Role</span><span class="connectionPillValue">Output monitor</span>`;
  relationRow.append(role);

  const body = el("div", "visualBody");
  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  canvas.width = 800;
  canvas.height = 260;

  body.appendChild(canvas);
  card.append(header, relationRow, body);
  parent.appendChild(card);

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
    ctx2d.strokeStyle = "rgba(207,214,221,0.12)";

    for (let i = 1; i < 10; i++) {
      const x = (w * i) / 10;
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, h);
      ctx2d.stroke();
    }

    for (let j = 1; j < 4; j++) {
      const y = (h * j) / 4;
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

    for (let i = 0; i < scopeBuf.length; i++) {
      const x = (i / (scopeBuf.length - 1)) * w;
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
    const barW = Math.max(1, Math.floor(w / specBuf.length));

    ctx2d.fillStyle = "rgba(74,163,255,0.55)";
    for (let i = 0; i < specBuf.length; i++) {
      const x = i * barW;
      const bh = specBuf[i] * (h * 0.92);
      ctx2d.fillRect(x, h - bh, barW, bh);
    }
  }

  return function update() {
    if (!vm.enabled) return;
    resizeIfNeeded();
    drawGrid();
    if (vm.kind === "scope") drawScope();
    else drawSpectrum();
  };
}
