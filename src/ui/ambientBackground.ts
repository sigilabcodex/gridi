const BACKGROUND_CONFIG = {
  frameIntervalMs: 1000 / 30,
  simulationIntervalMs: 180,
  minCellSize: 42,
  maxCellSize: 58,
  maxDpr: 2,
  pulseSpawnChance: 0.22,
  pulseMaxCount: 4,
  lineAlpha: 0.07,
  reducedMotionSeedStrength: 0.18,
} as const;

type GridPulse = {
  x: number;
  y: number;
  radius: number;
  strength: number;
  growth: number;
  decay: number;
  driftX: number;
  driftY: number;
};

export type AmbientBackgroundController = {
  updateFrame: (timestamp: number) => void;
  destroy: () => void;
};

type GridField = {
  cols: number;
  rows: number;
  cellSize: number;
  offsetX: number;
  offsetY: number;
  energy: Float32Array;
  memory: Float32Array;
  phase: Float32Array;
  bias: Float32Array;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createPulse(cols: number, rows: number): GridPulse {
  return {
    x: rand(1, Math.max(2, cols - 2)),
    y: rand(1, Math.max(2, rows - 2)),
    radius: rand(0.8, 1.6),
    strength: rand(0.12, 0.24),
    growth: rand(0.16, 0.28),
    decay: rand(0.9, 0.95),
    driftX: rand(-0.04, 0.04),
    driftY: rand(-0.03, 0.03),
  };
}

function createField(width: number, height: number, reducedMotion: boolean): GridField {
  const baseCellSize = clamp(Math.round(Math.min(width, height) / 18), BACKGROUND_CONFIG.minCellSize, BACKGROUND_CONFIG.maxCellSize);
  const cols = Math.max(12, Math.ceil(width / baseCellSize) + 2);
  const rows = Math.max(8, Math.ceil(height / baseCellSize) + 2);
  const total = cols * rows;
  const gridWidth = (cols - 1) * baseCellSize;
  const gridHeight = (rows - 1) * baseCellSize;

  const energy = new Float32Array(total);
  const memory = new Float32Array(total);
  const phase = new Float32Array(total);
  const bias = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    phase[index] = rand(0, Math.PI * 2);
    bias[index] = rand(-1, 1);
    const seed = Math.random();
    if (seed > 0.94) {
      const value = reducedMotion
        ? rand(0.05, BACKGROUND_CONFIG.reducedMotionSeedStrength)
        : rand(0.04, 0.14);
      energy[index] = value;
      memory[index] = value;
    }
  }

  return {
    cols,
    rows,
    cellSize: baseCellSize,
    offsetX: (width - gridWidth) * 0.5,
    offsetY: (height - gridHeight) * 0.5,
    energy,
    memory,
    phase,
    bias,
  };
}

export function createAmbientBackgroundLayer(root: HTMLElement): AmbientBackgroundController {
  const layer = document.createElement("div");
  layer.className = "ambientBackground";
  layer.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "ambientBackgroundCanvas";
  layer.appendChild(canvas);
  root.appendChild(layer);

  const ctx = canvas.getContext("2d", { alpha: true });
  const reduceMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let reducedMotion = reduceMotionQuery?.matches ?? false;
  let lastFrameAt = -BACKGROUND_CONFIG.frameIntervalMs;
  let lastSimulationAt = -BACKGROUND_CONFIG.simulationIntervalMs;
  let staticFrameDrawn = false;
  let pulses: GridPulse[] = [];
  let field = createField(window.innerWidth, window.innerHeight, reducedMotion);

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, BACKGROUND_CONFIG.maxDpr);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    field = createField(width, height, reducedMotion);
    pulses = reducedMotion ? [] : [createPulse(field.cols, field.rows)];
    staticFrameDrawn = false;
  };

  const simulate = (time: number) => {
    const { cols, rows, energy, memory, phase, bias } = field;
    const next = new Float32Array(energy.length);

    if (!reducedMotion && pulses.length < BACKGROUND_CONFIG.pulseMaxCount && Math.random() < BACKGROUND_CONFIG.pulseSpawnChance) {
      pulses.push(createPulse(cols, rows));
    }

    pulses = pulses
      .map((pulse) => ({
        ...pulse,
        x: pulse.x + pulse.driftX,
        y: pulse.y + pulse.driftY,
        radius: pulse.radius + pulse.growth,
        strength: pulse.strength * pulse.decay,
      }))
      .filter((pulse) => (
        pulse.strength > 0.018
        && pulse.x > -2
        && pulse.x < cols + 2
        && pulse.y > -2
        && pulse.y < rows + 2
      ));

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        let neighborSum = 0;
        let neighborCount = 0;

        for (let y = -1; y <= 1; y += 1) {
          const nextRow = row + y;
          if (nextRow < 0 || nextRow >= rows) continue;
          for (let x = -1; x <= 1; x += 1) {
            if (x === 0 && y === 0) continue;
            const nextCol = col + x;
            if (nextCol < 0 || nextCol >= cols) continue;
            neighborSum += energy[nextRow * cols + nextCol];
            neighborCount += 1;
          }
        }

        const neighborAvg = neighborCount > 0 ? neighborSum / neighborCount : 0;
        let pulseInfluence = 0;

        for (const pulse of pulses) {
          const dx = col - pulse.x;
          const dy = row - pulse.y;
          const distance = Math.hypot(dx, dy);
          const spread = Math.max(1.2, pulse.radius);
          if (distance > spread * 1.8) continue;
          const falloff = Math.max(0, 1 - distance / (spread * 1.8));
          pulseInfluence += falloff * falloff * pulse.strength;
        }

        const shimmer = Math.sin(time * 0.00012 + phase[index]) * 0.004;
        const structuralBias = bias[index] * 0.003;
        const persistence = energy[index] * 0.74;
        const propagated = neighborAvg * 0.3;
        const emergence = Math.max(0, neighborAvg - 0.05) * 0.18;
        const damping = 0.018 + Math.max(0, bias[index]) * 0.004;
        const value = clamp(
          persistence + propagated + emergence + pulseInfluence + shimmer + structuralBias - damping,
          0,
          0.34,
        );

        next[index] = value;
        memory[index] = Math.max(memory[index] * 0.95, value);
      }
    }

    field.energy = next;
  };

  const drawGrid = () => {
    const { cols, rows, cellSize, offsetX, offsetY } = field;

    ctx!.save();
    ctx!.lineWidth = 1;
    ctx!.strokeStyle = `rgba(82, 118, 144, ${BACKGROUND_CONFIG.lineAlpha})`;

    for (let col = 0; col < cols; col += 1) {
      const x = offsetX + col * cellSize;
      ctx!.beginPath();
      ctx!.moveTo(x, 0);
      ctx!.lineTo(x, height);
      ctx!.stroke();
    }

    for (let row = 0; row < rows; row += 1) {
      const y = offsetY + row * cellSize;
      ctx!.beginPath();
      ctx!.moveTo(0, y);
      ctx!.lineTo(width, y);
      ctx!.stroke();
    }

    ctx!.restore();
  };

  const drawCells = () => {
    const { cols, rows, cellSize, offsetX, offsetY, energy, memory } = field;
    const innerSize = Math.max(10, cellSize - 12);
    const halfInner = innerSize * 0.5;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const active = energy[index] * 0.7 + memory[index] * 0.55;
        if (active < 0.015) continue;

        const x = offsetX + col * cellSize;
        const y = offsetY + row * cellSize;
        const cellAlpha = Math.min(0.14, active * 0.28);

        ctx!.fillStyle = `rgba(58, 94, 122, ${cellAlpha})`;
        ctx!.fillRect(x - halfInner, y - halfInner, innerSize, innerSize);

        const nodeRadius = 1.2 + active * 2.1;
        const glow = ctx!.createRadialGradient(x, y, 0, x, y, cellSize * 0.46);
        glow.addColorStop(0, `rgba(126, 190, 228, ${0.06 + active * 0.18})`);
        glow.addColorStop(0.55, `rgba(74, 126, 164, ${0.02 + active * 0.06})`);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(x, y, cellSize * 0.46, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.fillStyle = `rgba(198, 230, 248, ${0.08 + active * 0.28})`;
        ctx!.beginPath();
        ctx!.arc(x, y, nodeRadius, 0, Math.PI * 2);
        ctx!.fill();

        if (col + 1 < cols) {
          const neighbor = energy[index + 1] * 0.6 + memory[index + 1] * 0.4;
          const link = Math.min(active, neighbor);
          if (link > 0.05) {
            ctx!.strokeStyle = `rgba(110, 170, 206, ${link * 0.12})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(x, y);
            ctx!.lineTo(x + cellSize, y);
            ctx!.stroke();
          }
        }

        if (row + 1 < rows) {
          const neighbor = energy[index + cols] * 0.6 + memory[index + cols] * 0.4;
          const link = Math.min(active, neighbor);
          if (link > 0.05) {
            ctx!.strokeStyle = `rgba(110, 170, 206, ${link * 0.1})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(x, y);
            ctx!.lineTo(x, y + cellSize);
            ctx!.stroke();
          }
        }
      }
    }
  };

  const drawAtmosphere = (time: number) => {
    const sweepX = width * (0.3 + Math.sin(time * 0.00006) * 0.08);
    const sweepY = height * (0.26 + Math.cos(time * 0.00005) * 0.06);
    const glow = ctx!.createRadialGradient(sweepX, sweepY, 0, sweepX, sweepY, Math.max(width, height) * 0.42);
    glow.addColorStop(0, "rgba(34, 84, 122, 0.075)");
    glow.addColorStop(0.45, "rgba(20, 46, 71, 0.04)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx!.fillStyle = glow;
    ctx!.fillRect(0, 0, width, height);
  };

  const draw = (time: number) => {
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawAtmosphere(time);
    drawGrid();
    drawCells();
  };

  const updateReducedMotion = (event?: MediaQueryListEvent) => {
    reducedMotion = event?.matches ?? reduceMotionQuery?.matches ?? false;
    resize();
    staticFrameDrawn = false;
  };

  resize();
  if (!reducedMotion) {
    simulate(0);
  }
  draw(0);
  staticFrameDrawn = true;

  window.addEventListener("resize", resize);
  reduceMotionQuery?.addEventListener?.("change", updateReducedMotion);

  return {
    updateFrame(timestamp) {
      if (reducedMotion) {
        if (!staticFrameDrawn) {
          draw(timestamp);
          staticFrameDrawn = true;
        }
        return;
      }

      if (timestamp - lastSimulationAt >= BACKGROUND_CONFIG.simulationIntervalMs) {
        lastSimulationAt = timestamp;
        simulate(timestamp);
      }

      if (timestamp - lastFrameAt < BACKGROUND_CONFIG.frameIntervalMs) return;
      lastFrameAt = timestamp;
      draw(timestamp);
      staticFrameDrawn = true;
    },
    destroy() {
      window.removeEventListener("resize", resize);
      reduceMotionQuery?.removeEventListener?.("change", updateReducedMotion);
      layer.remove();
    },
  };
}
