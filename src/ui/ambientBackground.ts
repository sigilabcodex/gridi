const BACKGROUND_CONFIG = {
  frameIntervalMs: 1000 / 30,
  simulationIntervalMs: 150,
  minCellSize: 42,
  maxCellSize: 58,
  maxDpr: 2,
  basePulseSpawnChance: 0.08,
  audioPulseSpawnChance: 0.2,
  pulseMaxCount: 5,
  lineAlpha: 0.06,
  reducedMotionSeedStrength: 0.16,
  neighborhoodRange: 1,
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

export type AmbientAudioActivity = {
  level: number;
  transient: number;
  active: boolean;
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
  drift: Float32Array;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createPulse(cols: number, rows: number, strengthBoost = 0, focus?: { x: number; y: number }): GridPulse {
  return {
    x: clamp(focus?.x ?? rand(1, Math.max(2, cols - 2)), 1, Math.max(1, cols - 2)),
    y: clamp(focus?.y ?? rand(1, Math.max(2, rows - 2)), 1, Math.max(1, rows - 2)),
    radius: rand(0.7, 1.4),
    strength: rand(0.09, 0.18) + strengthBoost,
    growth: rand(0.18, 0.32),
    decay: rand(0.82, 0.9),
    driftX: rand(-0.05, 0.05),
    driftY: rand(-0.04, 0.04),
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
  const drift = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    phase[index] = rand(0, Math.PI * 2);
    bias[index] = rand(-1, 1);
    drift[index] = rand(-1, 1);
    const seed = Math.random();
    if (seed > 0.965) {
      const value = reducedMotion
        ? rand(0.03, BACKGROUND_CONFIG.reducedMotionSeedStrength)
        : rand(0.025, 0.1);
      energy[index] = value;
      memory[index] = value * 0.75;
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
    drift,
  };
}

function indexToCoord(index: number, cols: number) {
  return {
    x: index % cols,
    y: Math.floor(index / cols),
  };
}

export function createAmbientBackgroundLayer(
  root: HTMLElement,
  getAudioActivity?: () => AmbientAudioActivity,
): AmbientBackgroundController {
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
  let audioLevelSmoothed = 0;
  let audioTransientSmoothed = 0;
  let activityMomentum = 0;

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

  const sampleAudioActivity = () => {
    const activity = getAudioActivity?.() ?? { level: 0, transient: 0, active: false };
    const levelTarget = activity.active ? activity.level : activity.level * 0.45;
    audioLevelSmoothed += (levelTarget - audioLevelSmoothed) * 0.14;
    audioTransientSmoothed += (activity.transient - audioTransientSmoothed) * 0.24;
    activityMomentum = clamp(activityMomentum * 0.88 + audioLevelSmoothed * 0.18 + audioTransientSmoothed * 0.32, 0, 1);
    return {
      level: audioLevelSmoothed,
      transient: audioTransientSmoothed,
      active: activity.active,
      momentum: activityMomentum,
    };
  };

  const simulate = (time: number) => {
    const audio = sampleAudioActivity();
    const { cols, rows, energy, memory, phase, bias, drift } = field;
    const next = new Float32Array(energy.length);
    let fieldSum = 0;
    let activeCount = 0;

    let hotspotIndex = 0;
    let hotspotEnergy = 0;
    for (let index = 0; index < energy.length; index += 1) {
      if (energy[index] <= hotspotEnergy) continue;
      hotspotEnergy = energy[index];
      hotspotIndex = index;
    }

    const pulseChance = BACKGROUND_CONFIG.basePulseSpawnChance + audio.level * 0.08 + audio.transient * BACKGROUND_CONFIG.audioPulseSpawnChance;
    if (!reducedMotion && pulses.length < BACKGROUND_CONFIG.pulseMaxCount && Math.random() < pulseChance) {
      const hotspot = indexToCoord(hotspotEnergy > 0.02 ? hotspotIndex : Math.floor(rand(0, energy.length - 1)), cols);
      pulses.push(createPulse(cols, rows, audio.level * 0.04 + audio.transient * 0.08, hotspot));
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
        pulse.strength > 0.012
        && pulse.x > -2
        && pulse.x < cols + 2
        && pulse.y > -2
        && pulse.y < rows + 2
      ));

    let brightestIndex = 0;
    let brightestEnergy = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        let neighborSum = 0;
        let neighborCount = 0;

        for (let y = -BACKGROUND_CONFIG.neighborhoodRange; y <= BACKGROUND_CONFIG.neighborhoodRange; y += 1) {
          const nextRow = row + y;
          if (nextRow < 0 || nextRow >= rows) continue;
          for (let x = -BACKGROUND_CONFIG.neighborhoodRange; x <= BACKGROUND_CONFIG.neighborhoodRange; x += 1) {
            if (x === 0 && y === 0) continue;
            const nextCol = col + x;
            if (nextCol < 0 || nextCol >= cols) continue;
            const distance = Math.abs(x) + Math.abs(y);
            const weight = distance === 1 ? 1 : 0.58;
            neighborSum += energy[nextRow * cols + nextCol] * weight;
            neighborCount += weight;
          }
        }

        const neighborAvg = neighborCount > 0 ? neighborSum / neighborCount : 0;
        let pulseInfluence = 0;

        for (const pulse of pulses) {
          const dx = col - pulse.x;
          const dy = row - pulse.y;
          const distance = Math.hypot(dx, dy);
          const spread = Math.max(1.1, pulse.radius);
          if (distance > spread * 1.65) continue;
          const falloff = Math.max(0, 1 - distance / (spread * 1.65));
          pulseInfluence += falloff * falloff * pulse.strength;
        }

        const shimmer = Math.sin(time * 0.0001 + phase[index]) * 0.003;
        const structuralBias = bias[index] * 0.0024;
        const carried = energy[index] * (0.45 + audio.level * 0.05);
        const retainedMemory = memory[index] * 0.16;
        const propagated = neighborAvg * (0.24 + audio.level * 0.05);
        const birthWindow = Math.max(0, 0.16 - Math.abs(neighborAvg - (0.09 + audio.level * 0.035)));
        const emergence = birthWindow * (0.22 + audio.transient * 0.38);
        const localDrift = Math.sin(time * 0.00018 + drift[index] * Math.PI) * 0.0025;
        const baseCooling = 0.02 + Math.max(0, bias[index]) * 0.005;

        const value = clamp(
          carried
          + retainedMemory
          + propagated
          + emergence
          + pulseInfluence
          + shimmer
          + structuralBias
          + localDrift
          - baseCooling,
          0,
          0.32,
        );

        next[index] = value;
        memory[index] = Math.max(memory[index] * 0.86, value * (0.52 + audio.level * 0.08));
        fieldSum += value;
        if (value > 0.06) activeCount += 1;
        if (value > brightestEnergy) {
          brightestEnergy = value;
          brightestIndex = index;
        }
      }
    }

    const avgEnergy = fieldSum / Math.max(1, next.length);
    const occupancy = activeCount / Math.max(1, next.length);
    const saturation = clamp(avgEnergy * 1.8 + Math.max(0, occupancy - 0.24) * 1.5, 0, 1);

    if (saturation > 0.38) {
      const coolAmount = 0.03 + (saturation - 0.38) * 0.12;
      for (let index = 0; index < next.length; index += 1) {
        const cooled = Math.max(0, next[index] - coolAmount * (0.55 + Math.max(0, bias[index]) * 0.3));
        next[index] = cooled;
        memory[index] *= 0.9 - saturation * 0.16;
      }
    }

    const brightest = indexToCoord(brightestIndex, cols);
    if (!reducedMotion && audio.active && audio.transient > 0.1 && pulses.length < BACKGROUND_CONFIG.pulseMaxCount) {
      pulses.push(createPulse(cols, rows, audio.transient * 0.1, {
        x: brightest.x + rand(-1.5, 1.5),
        y: brightest.y + rand(-1.5, 1.5),
      }));
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
    const innerSize = Math.max(10, cellSize - 14);
    const halfInner = innerSize * 0.5;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const active = energy[index] * 0.82 + memory[index] * 0.42;
        if (active < 0.012) continue;

        const x = offsetX + col * cellSize;
        const y = offsetY + row * cellSize;
        const cellAlpha = Math.min(0.11, active * 0.22);

        ctx!.fillStyle = `rgba(56, 88, 112, ${cellAlpha})`;
        ctx!.fillRect(x - halfInner, y - halfInner, innerSize, innerSize);

        const nodeRadius = 1 + active * 1.6;
        const glow = ctx!.createRadialGradient(x, y, 0, x, y, cellSize * 0.4);
        glow.addColorStop(0, `rgba(120, 182, 220, ${0.04 + active * 0.14})`);
        glow.addColorStop(0.58, `rgba(64, 110, 146, ${0.015 + active * 0.05})`);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(x, y, cellSize * 0.4, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.fillStyle = `rgba(194, 226, 244, ${0.06 + active * 0.18})`;
        ctx!.beginPath();
        ctx!.arc(x, y, nodeRadius, 0, Math.PI * 2);
        ctx!.fill();

        if (col + 1 < cols) {
          const neighbor = energy[index + 1] * 0.62 + memory[index + 1] * 0.3;
          const link = Math.min(active, neighbor);
          if (link > 0.055) {
            ctx!.strokeStyle = `rgba(102, 156, 188, ${link * 0.08})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(x, y);
            ctx!.lineTo(x + cellSize, y);
            ctx!.stroke();
          }
        }

        if (row + 1 < rows) {
          const neighbor = energy[index + cols] * 0.62 + memory[index + cols] * 0.3;
          const link = Math.min(active, neighbor);
          if (link > 0.055) {
            ctx!.strokeStyle = `rgba(102, 156, 188, ${link * 0.07})`;
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
    const activityGlow = 0.045 + activityMomentum * 0.04;
    const glow = ctx!.createRadialGradient(sweepX, sweepY, 0, sweepX, sweepY, Math.max(width, height) * 0.42);
    glow.addColorStop(0, `rgba(34, 84, 122, ${activityGlow})`);
    glow.addColorStop(0.45, `rgba(20, 46, 71, ${0.022 + activityMomentum * 0.022})`);
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
