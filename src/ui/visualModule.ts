import type { Engine } from "../engine/audio";
import type { Patch } from "../patch";
import type { VisualModule } from "../patch";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateStackPanel } from "./faceplateSections";
import { bindFloatingPanelReposition, placeFloatingPanel } from "./floatingPanel";
import { createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import type { TooltipBinder } from "./tooltip";
import {
  createModuleRefChip,
  createRoutingCard,
  createRoutingChip,
  createRoutingSummary,
  createRoutingSummaryStrip,
  type RoutingSnapshot,
} from "./routingVisibility";
import { runtimeStateLabel } from "./runtimeActivity";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function smoothArray(out: Float32Array, src: Float32Array, alpha = 0.18) {
  const len = Math.min(out.length, src.length);
  for (let i = 0; i < len; i += 1) out[i] += (src[i] - out[i]) * alpha;
}

type VisualFrameState = {
  frame: number;
  phaseTrail: Array<{ x: number; y: number }>;
  ripplePhase: number;
  glitchSeed: number;
  spectralHistory: Float32Array[];
  smoothedSpectrum: Float32Array;
};

type VisualDrawContext = {
  canvas: HTMLCanvasElement;
  ctx2d: CanvasRenderingContext2D;
  engine: Engine;
  scopeBuf: Float32Array;
  specBuf: Float32Array;
  stereoLeftBuf: Float32Array;
  stereoRightBuf: Float32Array;
  readout: HTMLElement;
  frame: VisualFrameState;
};

type VisualModeSpec = {
  label: string;
  draw: (ctx: VisualDrawContext) => void;
};

const VISUAL_MODE_SPECS: Record<VisualModule["kind"], VisualModeSpec> = {
  scope: {
    label: "Scope",
    draw: ({ canvas, ctx2d, engine, scopeBuf, readout }) => {
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
      let peak = 0;
      for (let i = 0; i < scopeBuf.length; i += 1) peak = Math.max(peak, Math.abs(scopeBuf[i]));
      readout.textContent = `Peak ${peak.toFixed(3)} · ${scopeBuf.length} samples`;
    },
  },
  spectrum: {
    label: "Spectrum",
    draw: ({ canvas, ctx2d, engine, specBuf, readout }) => {
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
      readout.textContent = `Avg ${avg.toFixed(3)} · ${specBuf.length} bins`;
    },
  },
  vectorscope: {
    label: "Vectorscope",
    draw: ({ canvas, ctx2d, engine, stereoLeftBuf, stereoRightBuf, readout, frame }) => {
      const { left, right } = engine.getStereoScopeData(stereoLeftBuf, stereoRightBuf);
      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5;
      const cy = h * 0.5;
      const radius = Math.min(w, h) * 0.42;

      ctx2d.strokeStyle = "rgba(255,226,178,0.24)";
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx2d.stroke();
      ctx2d.beginPath();
      ctx2d.moveTo(cx - radius, cy);
      ctx2d.lineTo(cx + radius, cy);
      ctx2d.moveTo(cx, cy - radius);
      ctx2d.lineTo(cx, cy + radius);
      ctx2d.stroke();

      const sampleStep = 2;
      ctx2d.strokeStyle = "rgba(255,234,199,0.88)";
      ctx2d.lineWidth = 1.6;
      ctx2d.beginPath();
      for (let i = 0; i < left.length; i += sampleStep) {
        const lx = left[i] ?? 0;
        const rx = right[i] ?? 0;
        const x = cx + (lx - rx) * radius * 0.72;
        const y = cy - (lx + rx) * radius * 0.46;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
        frame.phaseTrail.push({ x, y });
      }
      while (frame.phaseTrail.length > 180) frame.phaseTrail.shift();
      ctx2d.stroke();

      if (frame.phaseTrail.length > 8) {
        ctx2d.beginPath();
        for (let i = 0; i < frame.phaseTrail.length; i += 1) {
          const p = frame.phaseTrail[i];
          if (i === 0) ctx2d.moveTo(p.x, p.y);
          else ctx2d.lineTo(p.x, p.y);
        }
        ctx2d.strokeStyle = "rgba(121, 193, 255, 0.28)";
        ctx2d.lineWidth = 1;
        ctx2d.stroke();
      }

      let corrNumer = 0;
      let corrDenL = 0;
      let corrDenR = 0;
      for (let i = 0; i < left.length; i += sampleStep) {
        const l = left[i] ?? 0;
        const r = right[i] ?? 0;
        corrNumer += l * r;
        corrDenL += l * l;
        corrDenR += r * r;
      }
      const corr = corrNumer / Math.sqrt(Math.max(1e-9, corrDenL * corrDenR));
      const width = left.reduce((acc, _, i) => acc + Math.abs((left[i] ?? 0) - (right[i] ?? 0)), 0) / Math.max(1, left.length);
      readout.textContent = `Phase ${corr.toFixed(2)} · Width ${clamp01(width).toFixed(2)}`;
    },
  },
  "spectral-depth": {
    label: "Spectral Depth",
    draw: ({ canvas, ctx2d, engine, specBuf, readout, frame }) => {
      engine.getSpectrumData(specBuf);
      smoothArray(frame.smoothedSpectrum, specBuf, 0.18);
      frame.spectralHistory.push(new Float32Array(frame.smoothedSpectrum));
      while (frame.spectralHistory.length > 16) frame.spectralHistory.shift();

      const w = canvas.width;
      const h = canvas.height;
      const depth = frame.spectralHistory.length;
      const bins = frame.smoothedSpectrum.length;

      for (let layer = 0; layer < depth; layer += 1) {
        const t = layer / Math.max(1, depth - 1);
        const hist = frame.spectralHistory[layer];
        const inset = t * (w * 0.25);
        const usableW = Math.max(10, w - inset * 2);
        const yBase = h - t * h * 0.82;
        const barW = Math.max(1, Math.floor(usableW / bins));
        ctx2d.fillStyle = `rgba(255, ${Math.round(196 - t * 70)}, ${Math.round(110 + t * 55)}, ${0.18 + (1 - t) * 0.36})`;
        for (let i = 0; i < bins; i += 2) {
          const x = inset + (i / bins) * usableW;
          const bh = hist[i] * (h * (0.06 + (1 - t) * 0.28));
          ctx2d.fillRect(x, yBase - bh, barW, bh);
        }
      }

      const low = frame.smoothedSpectrum.slice(2, 20).reduce((sum, x) => sum + x, 0) / 18;
      const high = frame.smoothedSpectrum.slice(80, 180).reduce((sum, x) => sum + x, 0) / 100;
      readout.textContent = `Depth ${depth} · Low ${low.toFixed(2)} · High ${high.toFixed(2)}`;
    },
  },
  flow: {
    label: "Flow",
    draw: ({ canvas, ctx2d, engine, specBuf, readout, frame }) => {
      engine.getSpectrumData(specBuf);
      const activity = engine.getMasterActivity();
      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5;
      const cy = h * 0.52;
      const energy = specBuf.slice(3, 42).reduce((sum, x) => sum + x, 0) / 39;
      frame.ripplePhase += 0.016 + energy * 0.055;

      const rings = 6;
      for (let i = 0; i < rings; i += 1) {
        const ringNorm = i / Math.max(1, rings - 1);
        const base = Math.min(w, h) * (0.08 + ringNorm * 0.13);
        const pulse = 1 + Math.sin(frame.ripplePhase * (1.4 + i * 0.2) + i) * (0.08 + activity.transient * 0.25);
        const radius = base * pulse * (1 + energy * 0.45);
        ctx2d.strokeStyle = `rgba(${Math.round(120 + ringNorm * 60)}, ${Math.round(160 + ringNorm * 45)}, 255, ${0.14 + (1 - ringNorm) * 0.18})`;
        ctx2d.lineWidth = 1.3;
        ctx2d.beginPath();
        for (let j = 0; j <= 72; j += 1) {
          const a = (j / 72) * Math.PI * 2;
          const wav = Math.sin(a * (2 + i * 0.5) + frame.ripplePhase * 3) * (6 + energy * 26);
          const x = cx + Math.cos(a) * (radius + wav);
          const y = cy + Math.sin(a) * (radius + wav * 0.7);
          if (j === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
      }

      const flux = specBuf.slice(20, 140).reduce((sum, x) => sum + x, 0) / 120;
      readout.textContent = `Flow ${energy.toFixed(2)} · Flux ${flux.toFixed(2)}`;
    },
  },
  ritual: {
    label: "Ritual",
    draw: ({ canvas, ctx2d, engine, specBuf, readout, frame }) => {
      engine.getSpectrumData(specBuf);
      const activity = engine.getMasterActivity();
      const w = canvas.width;
      const h = canvas.height;
      const ground = h * 0.7;
      const dancers = 5;
      const motion = activity.level * 0.7 + activity.transient * 0.8;

      for (let i = 0; i < dancers; i += 1) {
        const t = i / Math.max(1, dancers - 1);
        const x = w * (0.12 + t * 0.76);
        const laneEnergy = specBuf[10 + i * 12] ?? 0;
        const jump = (0.06 + laneEnergy * 0.22 + motion * 0.14) * h;
        const arm = 14 + laneEnergy * 32;
        const body = 20 + laneEnergy * 28;
        const sway = Math.sin(frame.frame * 0.03 + i * 0.8) * (8 + motion * 16);
        const y = ground - jump;

        ctx2d.strokeStyle = `rgba(255, ${Math.round(210 - t * 52)}, ${Math.round(145 + t * 35)}, ${0.6 + laneEnergy * 0.35})`;
        ctx2d.lineWidth = 2;

        ctx2d.beginPath();
        ctx2d.moveTo(x, y - body * 0.55);
        ctx2d.lineTo(x + sway * 0.25, y + body * 0.45);
        ctx2d.stroke();

        ctx2d.beginPath();
        ctx2d.moveTo(x - arm * 0.65, y - body * 0.15);
        ctx2d.lineTo(x + arm * 0.65, y - body * 0.22 - sway * 0.08);
        ctx2d.stroke();

        ctx2d.beginPath();
        ctx2d.moveTo(x, y + body * 0.45);
        ctx2d.lineTo(x - 8 - sway * 0.08, y + body + 10);
        ctx2d.moveTo(x + sway * 0.25, y + body * 0.45);
        ctx2d.lineTo(x + 8 + sway * 0.08, y + body + 10);
        ctx2d.stroke();

        ctx2d.beginPath();
        ctx2d.arc(x, y - body * 0.8, 5 + laneEnergy * 6, 0, Math.PI * 2);
        ctx2d.stroke();
      }

      const arcRadius = Math.min(w, h) * (0.1 + motion * 0.25);
      ctx2d.strokeStyle = "rgba(255, 228, 177, 0.32)";
      ctx2d.lineWidth = 1.2;
      ctx2d.beginPath();
      ctx2d.arc(w * 0.5, ground + 8, arcRadius, Math.PI, Math.PI * 2);
      ctx2d.stroke();

      readout.textContent = `Gesture ${motion.toFixed(2)} · Figures ${dancers}`;
    },
  },
  glitch: {
    label: "Glitch",
    draw: ({ canvas, ctx2d, engine, specBuf, readout, frame }) => {
      engine.getSpectrumData(specBuf);
      smoothArray(frame.smoothedSpectrum, specBuf, 0.24);
      const w = canvas.width;
      const h = canvas.height;
      const activity = engine.getMasterActivity();
      frame.glitchSeed = (frame.glitchSeed * 1664525 + 1013904223) >>> 0;
      const prng = () => {
        frame.glitchSeed = (frame.glitchSeed * 1664525 + 1013904223) >>> 0;
        return frame.glitchSeed / 0xffffffff;
      };
      const smoothed = frame.smoothedSpectrum;
      const bands = 14;

      for (let i = 0; i < bands; i += 1) {
        const y = (i / bands) * h;
        const height = h / bands - 1;
        const energy = smoothed[4 + i * 8] ?? 0;
        const jitter = (prng() - 0.5) * (3 + energy * 12 + activity.transient * 10);
        const alpha = 0.06 + energy * 0.18;
        ctx2d.fillStyle = `rgba(${Math.round(88 + energy * 90)}, ${Math.round(130 + energy * 70)}, ${Math.round(160 + energy * 70)}, ${alpha})`;
        ctx2d.fillRect(jitter, y, w, height);
      }

      const scanlineStep = Math.max(2, Math.floor(h / 46));
      ctx2d.strokeStyle = "rgba(255, 222, 178, 0.07)";
      ctx2d.lineWidth = 1;
      for (let y = scanlineStep; y < h; y += scanlineStep) {
        ctx2d.beginPath();
        ctx2d.moveTo(0, y + 0.5);
        ctx2d.lineTo(w, y + 0.5);
        ctx2d.stroke();
      }

      const bandCount = 3 + Math.floor(activity.transient * 4);
      for (let i = 0; i < bandCount; i += 1) {
        const base = 0.16 + i * 0.24;
        const height = Math.max(8, h * (0.045 + prng() * 0.06));
        const y = Math.min(h - height, h * base + (prng() - 0.5) * h * 0.06);
        ctx2d.fillStyle = `rgba(${Math.round(122 + prng() * 50)}, ${Math.round(176 + prng() * 52)}, 255, ${0.08 + prng() * 0.08})`;
        ctx2d.fillRect(0, y, w, height);
      }

      ctx2d.strokeStyle = "rgba(255, 233, 189, 0.82)";
      ctx2d.lineWidth = 1.4;
      ctx2d.beginPath();
      let inDropout = false;
      for (let i = 0; i < smoothed.length; i += 2) {
        const xNorm = i / Math.max(1, smoothed.length - 1);
        const x = xNorm * w;
        const dropout = (Math.floor(xNorm * 11 + frame.frame * 0.015) % 7) === 0;
        if (dropout) {
          inDropout = true;
          continue;
        }
        const y =
          h * 0.64
          - smoothed[i] * h * (0.22 + activity.level * 0.2)
          + Math.sin(i * 0.2 + frame.frame * 0.045) * (1.4 + activity.transient * 3.2);
        if (inDropout || i <= 2) {
          ctx2d.moveTo(x, y);
          inDropout = false;
        } else {
          ctx2d.lineTo(x, y);
        }
      }
      ctx2d.stroke();

      const slices = 8 + Math.floor(activity.level * 8);
      for (let i = 0; i < slices; i += 1) {
        const width = Math.max(3, Math.floor(3 + prng() * (w * 0.018)));
        const x = Math.floor(prng() * (w - width));
        const top = Math.floor(prng() * h * 0.82);
        const sliceH = Math.floor(h * (0.18 + prng() * 0.62));
        ctx2d.fillStyle = `rgba(${Math.round(150 + prng() * 60)}, ${Math.round(205 + prng() * 35)}, 255, ${0.12 + prng() * 0.2})`;
        ctx2d.fillRect(x, top, width, sliceH);
      }

      const masks = 2 + Math.floor(activity.transient * 3);
      for (let i = 0; i < masks; i += 1) {
        const maskW = Math.floor(w * (0.08 + prng() * 0.16));
        const maskH = Math.floor(h * (0.1 + prng() * 0.18));
        const x = Math.floor(prng() * Math.max(1, w - maskW));
        const y = Math.floor(prng() * Math.max(1, h - maskH));
        ctx2d.fillStyle = `rgba(3, 6, 10, ${0.34 + prng() * 0.2})`;
        ctx2d.fillRect(x, y, maskW, maskH);
        ctx2d.strokeStyle = "rgba(255, 208, 152, 0.18)";
        ctx2d.lineWidth = 1;
        ctx2d.strokeRect(x + 0.5, y + 0.5, maskW - 1, maskH - 1);
      }

      const corruption = clamp01(activity.transient * 0.7 + activity.level * 0.4);
      readout.textContent = `Glitch ${corruption.toFixed(2)} · Slice/Mask`;
    },
  },
  cymat: {
    label: "Cymat",
    draw: ({ canvas, ctx2d, engine, specBuf, readout, frame }) => {
      engine.getSpectrumData(specBuf);
      smoothArray(frame.smoothedSpectrum, specBuf, 0.2);
      const w = canvas.width;
      const h = canvas.height;
      const plateInsetX = w * 0.08;
      const plateInsetY = h * 0.1;
      const plateW = w - plateInsetX * 2;
      const plateH = h - plateInsetY * 2;
      const cx = plateInsetX + plateW * 0.5;
      const cy = plateInsetY + plateH * 0.5;

      const low = frame.smoothedSpectrum.slice(2, 28).reduce((sum, value) => sum + value, 0) / 26;
      const mid = frame.smoothedSpectrum.slice(30, 96).reduce((sum, value) => sum + value, 0) / 66;
      const high = frame.smoothedSpectrum.slice(96, 210).reduce((sum, value) => sum + value, 0) / 114;
      const nodalMix = clamp01(low * 0.55 + mid * 0.35 + high * 0.1);

      const modeA = 2 + Math.floor(low * 7);
      const modeB = 3 + Math.floor(mid * 8);
      const modeC = 1 + Math.floor(high * 6);
      const phaseA = frame.frame * (0.012 + low * 0.05);
      const phaseB = frame.frame * (0.01 + mid * 0.04);
      const phaseC = frame.frame * (0.018 + high * 0.05);

      ctx2d.strokeStyle = "rgba(255, 219, 168, 0.36)";
      ctx2d.lineWidth = 1.2;
      ctx2d.strokeRect(plateInsetX + 0.5, plateInsetY + 0.5, plateW - 1, plateH - 1);

      const cols = 84;
      const rows = 48;
      const eps = 0.095 - nodalMix * 0.045;
      const grainAlpha = 0.08 + nodalMix * 0.14;

      for (let yi = 0; yi < rows; yi += 1) {
        const yNorm = yi / Math.max(1, rows - 1);
        const y = plateInsetY + yNorm * plateH;
        for (let xi = 0; xi < cols; xi += 1) {
          const xNorm = xi / Math.max(1, cols - 1);
          const x = plateInsetX + xNorm * plateW;
          const px = (x - cx) / (plateW * 0.5);
          const py = (y - cy) / (plateH * 0.5);

          const standingA = Math.sin(modeA * Math.PI * px + phaseA) * Math.sin((modeB - 1) * Math.PI * py - phaseB);
          const standingB = Math.cos((modeB + 1) * Math.PI * px - phaseB) * Math.sin((modeA + modeC) * Math.PI * py + phaseC);
          const radial = Math.sin((Math.sqrt(px * px + py * py) * (6 + modeC) - phaseA * 0.7));
          const field = standingA * 0.58 + standingB * 0.3 + radial * (0.12 + high * 0.16);
          const nodeDistance = Math.abs(field);

          if (nodeDistance < eps) {
            const brightness = 0.46 + (eps - nodeDistance) / eps * 0.48;
            ctx2d.fillStyle = `rgba(255, ${Math.round(194 + brightness * 48)}, ${Math.round(142 + brightness * 64)}, ${grainAlpha + brightness * 0.18})`;
            ctx2d.fillRect(x, y, 1.4, 1.4);
          }
        }
      }

      const contourLevels = [0.09, 0.18, 0.28];
      ctx2d.lineWidth = 1;
      contourLevels.forEach((level, idx) => {
        const band = level + high * 0.06;
        ctx2d.strokeStyle = `rgba(${Math.round(112 + idx * 26)}, ${Math.round(170 + idx * 22)}, 255, ${0.16 + idx * 0.07})`;
        for (let yi = 0; yi < rows - 1; yi += 1) {
          const yNorm = yi / Math.max(1, rows - 1);
          const y = plateInsetY + yNorm * plateH;
          ctx2d.beginPath();
          let started = false;
          for (let xi = 0; xi < cols; xi += 1) {
            const xNorm = xi / Math.max(1, cols - 1);
            const x = plateInsetX + xNorm * plateW;
            const px = (x - cx) / (plateW * 0.5);
            const py = (y - cy) / (plateH * 0.5);
            const standingA = Math.sin(modeA * Math.PI * px + phaseA) * Math.sin((modeB - 1) * Math.PI * py - phaseB);
            const standingB = Math.cos((modeB + 1) * Math.PI * px - phaseB) * Math.sin((modeA + modeC) * Math.PI * py + phaseC);
            const radial = Math.sin((Math.sqrt(px * px + py * py) * (6 + modeC) - phaseA * 0.7));
            const field = standingA * 0.58 + standingB * 0.3 + radial * (0.12 + high * 0.16);
            if (Math.abs(field) < band) {
              if (!started) {
                ctx2d.moveTo(x, y);
                started = true;
              } else {
                ctx2d.lineTo(x, y);
              }
            } else if (started) {
              ctx2d.stroke();
              ctx2d.beginPath();
              started = false;
            }
          }
          if (started) ctx2d.stroke();
        }
      });

      readout.textContent = `Cymat ${nodalMix.toFixed(2)} · M${modeA}/${modeB}`;
    },
  },
};

export function renderVisualSurface(
  parent: HTMLElement,
  engine: Engine,
  vm: VisualModule,
  routing: RoutingSnapshot,
  isTransportPlaying: () => boolean,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  onRemove: () => void,
  modulePresetRecords: ModulePresetRecord[] = [],
  onLoadModulePreset?: (moduleId: string, presetId: string) => void,
  onSaveModulePreset?: (moduleId: string, name: string, overwritePresetId?: string | null) => void,
  attachTooltip?: TooltipBinder,
) {
  const surface = el("section", "moduleSurface moduleSurface--withStatus visualSurface");
  surface.dataset.type = "visual";

  const header = el("div", "surfaceHeader");
  const presetControl = createModulePresetControl({
    module: vm,
    records: modulePresetRecords,
    onLoadPreset: (presetId) => onLoadModulePreset?.(vm.id, presetId),
    onSavePreset: (name, overwritePresetId) => onSaveModulePreset?.(vm.id, name, overwritePresetId),
    attachTooltip,
  });

  const identity = el("div", "surfaceIdentity surfaceIdentity--canonical drumIdentity");
  const badge = el("div", "surfaceBadge surfaceBadge--visualFamily");
  badge.textContent = "VIS";
  identity.append(badge, presetControl.button);

  const right = el("div", "rightControls");
  const btnOn = el("button");
  btnOn.className = "surfaceHeaderAction";
  const updateOn = () => {
    btnOn.textContent = vm.enabled ? "On" : "Off";
    btnOn.classList.toggle("primary", vm.enabled);
  };
  btnOn.onclick = () => {
    onPatchChange((patch) => {
      const module = patch.modules.find((item) => item.id === vm.id);
      if (module?.type === "visual") module.enabled = !module.enabled;
    }, { regen: false });
    updateOn();
    syncFooter();
  };

  const btnX = el("button", "danger surfaceHeaderAction");
  btnX.textContent = "×";
  wireSafeDeleteButton(btnX, onRemove);
  right.append(btnOn, btnX);
  header.append(identity, right);

  const visualSource = routing.visualSources.get(vm.id);

  const panelMain = createFaceplateMainPanel();
  panelMain.classList.add("visualSurfaceBody", "visualMainLayout");

  const chipRow = createFaceplateSection("io", "visualMetaRow visualChipRow");
  const modeChip = document.createElement("button");
  modeChip.type = "button";
  modeChip.className = "routingChip routingChip-muted visualChipButton";
  modeChip.setAttribute("aria-label", "Visual mode");
  modeChip.setAttribute("aria-haspopup", "dialog");

  const sourceChip = document.createElement("button");
  sourceChip.type = "button";
  sourceChip.className = `routingChip visualChipButton ${visualSource ? "routingChip-connected" : "routingChip-muted"}`;
  sourceChip.setAttribute("aria-label", "Visual source");
  sourceChip.setAttribute("aria-haspopup", "dialog");

  const fftChip = document.createElement("button");
  fftChip.type = "button";
  fftChip.className = "routingChip routingChip-muted visualChipButton";
  fftChip.setAttribute("aria-label", "FFT size");
  fftChip.setAttribute("aria-haspopup", "dialog");
  chipRow.append(modeChip, sourceChip, fftChip);

  const visualModes: VisualModule["kind"][] = ["scope", "spectrum", "vectorscope", "spectral-depth", "flow", "ritual", "glitch", "cymat"];
  const fftSizes: Array<NonNullable<VisualModule["fftSize"]>> = [512, 1024, 2048, 4096];
  const sourceOptions = [{ value: "master", label: visualSource?.sourceLabel ?? "Master mix" }];

  let openPanelCleanup: { destroy: () => void } | null = null;
  let openPanel: HTMLElement | null = null;
  let openTrigger: HTMLElement | null = null;
  const closeChipPanel = () => {
    if (openPanelCleanup) {
      openPanelCleanup.destroy();
      openPanelCleanup = null;
    }
    openPanel?.remove();
    openPanel = null;
    if (openTrigger) {
      openTrigger.classList.remove("isOpen");
      openTrigger.setAttribute("aria-expanded", "false");
      openTrigger = null;
    }
  };

  const openChipPanel = <T extends string | number>(params: {
    trigger: HTMLButtonElement;
    label: string;
    align: "start" | "end";
    minWidth: number;
    maxWidth: number;
    options: Array<{ value: T; label: string }>;
    selected: () => T;
    onSelect: (value: T) => void;
  }) => {
    if (openPanel && openTrigger === params.trigger) {
      closeChipPanel();
      return;
    }
    closeChipPanel();

    const panel = document.createElement("div");
    panel.className = "floatingPanel visualChipSelectorPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", params.label);

    const list = document.createElement("div");
    list.className = "visualChipSelectorList";
    const selected = params.selected();
    params.options.forEach((option) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `visualChipSelectorRow${option.value === selected ? " isSelected" : ""}`;

      const mark = document.createElement("span");
      mark.className = "visualChipSelectorMark";
      mark.textContent = option.value === selected ? "✓" : "";
      const value = document.createElement("span");
      value.className = "visualChipSelectorValue";
      value.textContent = option.label;
      row.append(mark, value);
      row.onclick = () => {
        closeChipPanel();
        params.onSelect(option.value);
      };
      list.appendChild(row);
    });

    panel.appendChild(list);
    document.body.appendChild(panel);

    placeFloatingPanel(panel, params.trigger.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: params.align,
      offset: 8,
      minWidth: params.minWidth,
      maxWidth: params.maxWidth,
    });
    const reposition = bindFloatingPanelReposition(
      panel,
      () => (params.trigger.isConnected ? params.trigger.getBoundingClientRect() : null),
      {
        preferredSide: "bottom",
        align: params.align,
        offset: 8,
        minWidth: params.minWidth,
        maxWidth: params.maxWidth,
      },
    );

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel.contains(target) || params.trigger.contains(target)) return;
      closeChipPanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeChipPanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    openPanelCleanup = {
      destroy() {
        reposition.destroy();
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
      },
    };

    openPanel = panel;
    openTrigger = params.trigger;
    params.trigger.classList.add("isOpen");
    params.trigger.setAttribute("aria-expanded", "true");
  };

  modeChip.onclick = () => {
    openChipPanel<VisualModule["kind"]>({
      trigger: modeChip,
      label: `${vm.name} visual mode`,
      align: "start",
      minWidth: 170,
      maxWidth: 220,
      options: visualModes.map((kind) => ({ value: kind, label: VISUAL_MODE_SPECS[kind].label })),
      selected: () => vm.kind,
      onSelect: (value) => onPatchChange((patch) => {
        const module = patch.modules.find((item) => item.id === vm.id);
        if (module?.type === "visual") module.kind = value;
      }, { regen: false }),
    });
  };

  sourceChip.onclick = () => {
    openChipPanel({
      trigger: sourceChip,
      label: `${vm.name} visual source`,
      align: "start",
      minWidth: 150,
      maxWidth: 220,
      options: sourceOptions,
      selected: () => "master",
      onSelect: () => {},
    });
  };

  fftChip.onclick = () => {
    openChipPanel<NonNullable<VisualModule["fftSize"]>>({
      trigger: fftChip,
      label: `${vm.name} fft size`,
      align: "end",
      minWidth: 140,
      maxWidth: 180,
      options: fftSizes.map((size) => ({ value: size, label: `${size}` })),
      selected: () => vm.fftSize ?? 2048,
      onSelect: (value) => onPatchChange((patch) => {
        const module = patch.modules.find((item) => item.id === vm.id);
        if (module?.type === "visual") module.fftSize = value;
      }, { regen: false }),
    });
  };

  const canvasWrap = createFaceplateSection("feature", "visualDisplayWrap");
  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  canvas.width = 800;
  canvas.height = 260;
  const readout = el("div", "visualReadout small");
  readout.setAttribute("aria-live", "polite");
  canvasWrap.append(canvas, readout);
  panelMain.append(chipRow, canvasWrap);

  const panelRouting = createFaceplateStackPanel("utilityPanel utilityPanel--visualRouting");
  const sourceCard = createRoutingCard("Input", visualSource?.sourceLabel ?? "Master mix");
  sourceCard.appendChild(createRoutingSummaryStrip([
    createRoutingSummary("In", visualSource ? [createModuleRefChip({ id: vm.id, name: visualSource.sourceLabel, family: "visual", shortId: "MIX", label: visualSource.sourceLabel })] : [], "Master"),
    createRoutingSummary("Mix", (visualSource?.contributors ?? []).slice(0, 4).map((ref) => createModuleRefChip(ref)), "No voices"),
  ]));
  const contributors = el("div", "routingChipList");
  const visibleContributors = (visualSource?.contributors ?? []).slice(0, 8);
  visibleContributors.forEach((ref) => contributors.appendChild(createModuleRefChip(ref)));
  if ((visualSource?.contributors?.length ?? 0) > visibleContributors.length) {
    contributors.appendChild(createRoutingChip(`+${(visualSource?.contributors?.length ?? 0) - visibleContributors.length} more`, "muted"));
  }
  sourceCard.appendChild(contributors);
  panelRouting.appendChild(sourceCard);

  const shell = createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: panelMain },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
    ],
    activeTab: "MAIN",
  });

  const infoBar = createFaceplateSection("bottom", "drumInfoBar visualInfoBar");
  const idToken = el("span", "drumInfoToken");
  idToken.textContent = vm.id.slice(-6).toUpperCase();
  const stateToken = el("span", "drumInfoToken");
  const modeToken = el("span", "drumInfoToken");
  const metaToken = el("span", "drumInfoToken drumInfoToken--meta");
  infoBar.append(idToken, stateToken, modeToken, metaToken);

  const syncFooter = () => {
    const modeSpec = VISUAL_MODE_SPECS[vm.kind] ?? VISUAL_MODE_SPECS.scope;
    const hasSignal = engine.getMasterActivity().active;
    stateToken.textContent = runtimeStateLabel(isTransportPlaying() || hasSignal, vm.enabled);
    modeToken.textContent = `MODE ${modeSpec.label.toUpperCase()}`;
    metaToken.textContent = `FFT ${vm.fftSize ?? 2048}`;
    modeChip.textContent = `MODE ${modeSpec.label.toUpperCase()}`;
    sourceChip.textContent = `SRC ${visualSource?.sourceLabel ?? "MASTER"}`;
    fftChip.textContent = `FFT ${vm.fftSize ?? 2048}`;
  };

  surface.append(header, shell.face, shell.tabs, infoBar);
  parent.appendChild(surface);
  updateOn();
  syncFooter();

  const ctx2d = canvas.getContext("2d")!;
  const scopeBuf = new Float32Array(engine.analyser.fftSize);
  const specBuf = new Float32Array(engine.analyser.frequencyBinCount);
  const stereoLeftBuf = new Float32Array(256);
  const stereoRightBuf = new Float32Array(256);
  const frameState: VisualFrameState = {
    frame: 0,
    phaseTrail: [],
    ripplePhase: 0,
    glitchSeed: 0x12345678,
    spectralHistory: [],
    smoothedSpectrum: new Float32Array(specBuf.length),
  };

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

  return function update() {
    syncFooter();
    if (!vm.enabled) return;
    const hasSignal = engine.getMasterActivity().active;
    if (!isTransportPlaying() && !hasSignal) return;
    resizeIfNeeded();
    drawGrid();
    frameState.frame += 1;
    const modeSpec = VISUAL_MODE_SPECS[vm.kind] ?? VISUAL_MODE_SPECS.scope;
    modeSpec.draw({
      canvas,
      ctx2d,
      engine,
      scopeBuf,
      specBuf,
      stereoLeftBuf,
      stereoRightBuf,
      readout,
      frame: frameState,
    });
  };
}

export const renderVisualModule = renderVisualSurface;
