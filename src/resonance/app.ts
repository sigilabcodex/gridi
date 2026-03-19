const TAU = Math.PI * 2;
const WORLD_WIDTH = 2600;
const WORLD_HEIGHT = 1800;
const CAMERA_PAN_SPEED = 520;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.35;
const HARMONIC_COUNT = 26;
const MAX_ANOMALIES = 18;
const MAX_BREACHES = 28;

type Vec2 = { x: number; y: number };

type HarmonicNode = {
  id: number;
  x: number;
  y: number;
  baseRadius: number;
  orbitRadius: number;
  driftPhase: number;
  driftSpeed: number;
  hue: number;
  calmBias: number;
  signal: number;
  pulseOffset: number;
};

type Anomaly = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  distortion: number;
  phase: number;
  spin: number;
  seed: number;
  sourceNodeId: number;
};

type BreachEntity = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  size: number;
  heading: number;
  pulseOffset: number;
  reproduction: number;
  targetNodeId: number;
  filamentPhase: number;
};

type PhaseName = "Calm" | "Anomaly" | "Emergence" | "Pressure" | "Breach";

type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

type SimulationState = {
  harmonicNodes: HarmonicNode[];
  anomalies: Anomaly[];
  breaches: BreachEntity[];
  elapsed: number;
  phaseProgress: number;
  instability: number;
  rhythmicPressure: number;
  nextAnomalyAt: number;
  nextBreachAt: number;
  nextEntityId: number;
};

type InputState = {
  keys: Set<string>;
  pointer: {
    active: boolean;
    id: number;
    x: number;
    y: number;
    worldX: number;
    worldY: number;
    lastX: number;
    lastY: number;
    dragging: boolean;
  };
};

type AudioController = {
  unlock: () => void;
  update: (params: { phaseProgress: number; rhythmicPressure: number; slowMotion: boolean; fastForward: boolean }) => void;
  destroy: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function damp(current: number, target: number, smoothing: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fract(value: number) {
  return value - Math.floor(value);
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function randCentered(scale: number) {
  return (Math.random() - 0.5) * scale;
}

function length(vec: Vec2) {
  return Math.hypot(vec.x, vec.y);
}

function normalize(vec: Vec2) {
  const len = length(vec) || 1;
  return { x: vec.x / len, y: vec.y / len };
}

function worldToScreen(camera: CameraState, point: Vec2, width: number, height: number): Vec2 {
  return {
    x: (point.x - camera.x) * camera.zoom + width * 0.5,
    y: (point.y - camera.y) * camera.zoom + height * 0.5,
  };
}

function screenToWorld(camera: CameraState, point: Vec2, width: number, height: number): Vec2 {
  return {
    x: camera.x + (point.x - width * 0.5) / camera.zoom,
    y: camera.y + (point.y - height * 0.5) / camera.zoom,
  };
}

function constrainCamera(camera: CameraState) {
  const halfW = window.innerWidth * 0.5 / camera.zoom;
  const halfH = window.innerHeight * 0.5 / camera.zoom;
  camera.x = clamp(camera.x, halfW, WORLD_WIDTH - halfW);
  camera.y = clamp(camera.y, halfH, WORLD_HEIGHT - halfH);
}

function makeWeights(progress: number) {
  const calm = 1 - smoothstep(0.16, 0.32, progress);
  const anomaly = smoothstep(0.12, 0.28, progress) * (1 - smoothstep(0.42, 0.56, progress));
  const emergence = smoothstep(0.34, 0.5, progress) * (1 - smoothstep(0.64, 0.78, progress));
  const pressure = smoothstep(0.56, 0.72, progress) * (1 - smoothstep(0.82, 0.94, progress));
  const breach = smoothstep(0.78, 0.96, progress);
  return { calm, anomaly, emergence, pressure, breach };
}

function phaseNameFor(progress: number): PhaseName {
  if (progress < 0.22) return "Calm";
  if (progress < 0.42) return "Anomaly";
  if (progress < 0.62) return "Emergence";
  if (progress < 0.82) return "Pressure";
  return "Breach";
}

function createAudioController(): AudioController {
  let ctx: AudioContext | null = null;
  let ambientGain: GainNode | null = null;
  let pulseGain: GainNode | null = null;
  let pulseFilter: BiquadFilterNode | null = null;
  let masterGain: GainNode | null = null;
  let ambientLfo: OscillatorNode | null = null;
  let nextPulseTime = 0;
  let pressureState = 0;

  const ensureContext = () => {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.16;
    masterGain.connect(ctx.destination);

    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.02;
    ambientGain.connect(masterGain);

    pulseGain = ctx.createGain();
    pulseGain.gain.value = 0;
    pulseFilter = ctx.createBiquadFilter();
    pulseFilter.type = "bandpass";
    pulseFilter.frequency.value = 170;
    pulseFilter.Q.value = 2.4;
    pulseGain.connect(pulseFilter);
    pulseFilter.connect(masterGain);

    const ambientA = ctx.createOscillator();
    ambientA.type = "sine";
    ambientA.frequency.value = 118;
    ambientA.connect(ambientGain);
    ambientA.start();

    const ambientB = ctx.createOscillator();
    ambientB.type = "triangle";
    ambientB.frequency.value = 176;
    const ambientBLevel = ctx.createGain();
    ambientBLevel.gain.value = 0.022;
    ambientB.connect(ambientBLevel);
    ambientBLevel.connect(ambientGain);
    ambientB.start();

    const pulseOsc = ctx.createOscillator();
    pulseOsc.type = "triangle";
    pulseOsc.frequency.value = 84;
    pulseOsc.connect(pulseGain);
    pulseOsc.start();

    ambientLfo = ctx.createOscillator();
    ambientLfo.type = "sine";
    ambientLfo.frequency.value = 0.08;
    const ambientLfoDepth = ctx.createGain();
    ambientLfoDepth.gain.value = 0.008;
    ambientLfo.connect(ambientLfoDepth);
    ambientLfoDepth.connect(ambientGain.gain);
    ambientLfo.start();

    return ctx;
  };

  return {
    unlock() {
      const audioContext = ensureContext();
      if (!audioContext) return;
      if (audioContext.state === "suspended") void audioContext.resume();
    },
    update({ phaseProgress, rhythmicPressure, slowMotion, fastForward }) {
      const audioContext = ensureContext();
      if (!audioContext || !ambientGain || !pulseGain || !pulseFilter || !masterGain) return;
      if (audioContext.state === "suspended") return;

      pressureState = damp(pressureState, rhythmicPressure, 2.4, 1 / 60);
      const now = audioContext.currentTime;
      const ambientTarget = 0.016 + phaseProgress * 0.012 + pressureState * 0.018;
      ambientGain.gain.setTargetAtTime(ambientTarget, now, 0.18);
      masterGain.gain.setTargetAtTime(fastForward ? 0.18 : slowMotion ? 0.13 : 0.16, now, 0.2);
      pulseFilter.frequency.setTargetAtTime(140 + pressureState * 180, now, 0.16);

      const pulseInterval = lerp(1.35, 0.42, pressureState);
      while (nextPulseTime < now + 0.12) {
        const accent = 0.012 + pressureState * 0.055;
        pulseGain.gain.cancelScheduledValues(nextPulseTime);
        pulseGain.gain.setValueAtTime(0.0001, nextPulseTime);
        pulseGain.gain.linearRampToValueAtTime(accent, nextPulseTime + 0.03);
        pulseGain.gain.exponentialRampToValueAtTime(0.0001, nextPulseTime + lerp(0.55, 0.24, pressureState));
        nextPulseTime += pulseInterval;
      }
    },
    destroy() {
      if (!ctx) return;
      void ctx.close();
    },
  };
}

function createHarmonicNodes(): HarmonicNode[] {
  return Array.from({ length: HARMONIC_COUNT }, (_, index) => ({
    id: index + 1,
    x: rand(180, WORLD_WIDTH - 180),
    y: rand(180, WORLD_HEIGHT - 180),
    baseRadius: rand(18, 32),
    orbitRadius: rand(12, 38),
    driftPhase: rand(0, TAU),
    driftSpeed: rand(0.02, 0.08),
    hue: rand(188, 218),
    calmBias: rand(0.75, 1.25),
    signal: rand(0, 1),
    pulseOffset: rand(0, TAU),
  }));
}

function createSimulation(): SimulationState {
  return {
    harmonicNodes: createHarmonicNodes(),
    anomalies: [],
    breaches: [],
    elapsed: 0,
    phaseProgress: 0,
    instability: 0,
    rhythmicPressure: 0,
    nextAnomalyAt: rand(8, 14),
    nextBreachAt: rand(42, 58),
    nextEntityId: 1000,
  };
}

function spawnAnomaly(sim: SimulationState, weights: ReturnType<typeof makeWeights>) {
  if (sim.anomalies.length >= MAX_ANOMALIES) return;
  const sourceNode = sim.harmonicNodes[randInt(0, sim.harmonicNodes.length - 1)];
  const orbit = rand(sourceNode.baseRadius * 1.6, sourceNode.baseRadius * 4.2);
  const angle = rand(0, TAU);
  sim.anomalies.push({
    id: sim.nextEntityId++,
    x: sourceNode.x + Math.cos(angle) * orbit,
    y: sourceNode.y + Math.sin(angle) * orbit,
    vx: randCentered(4 + weights.pressure * 8),
    vy: randCentered(4 + weights.pressure * 8),
    age: 0,
    life: rand(22, 42) * (1 - weights.breach * 0.22),
    distortion: rand(0.18, 0.46),
    phase: rand(0, TAU),
    spin: rand(-0.9, 0.9),
    seed: rand(0, 1000),
    sourceNodeId: sourceNode.id,
  });
}

function spawnBreach(sim: SimulationState, fromAnomaly?: Anomaly) {
  if (sim.breaches.length >= MAX_BREACHES) return;
  const anchor = fromAnomaly ?? sim.anomalies[randInt(0, Math.max(0, sim.anomalies.length - 1))];
  const baseX = anchor?.x ?? rand(260, WORLD_WIDTH - 260);
  const baseY = anchor?.y ?? rand(260, WORLD_HEIGHT - 260);
  const targetNode = sim.harmonicNodes[randInt(0, sim.harmonicNodes.length - 1)];
  sim.breaches.push({
    id: sim.nextEntityId++,
    x: baseX,
    y: baseY,
    vx: randCentered(18),
    vy: randCentered(18),
    age: 0,
    size: rand(16, 30),
    heading: rand(0, TAU),
    pulseOffset: rand(0, TAU),
    reproduction: rand(0.8, 1.2),
    targetNodeId: targetNode.id,
    filamentPhase: rand(0, TAU),
  });
}

function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#040611");
  gradient.addColorStop(0.55, "#07101d");
  gradient.addColorStop(1, "#02050d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawWorldBounds(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "rgba(120, 184, 255, 0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.restore();
}

function drawStarField(ctx: CanvasRenderingContext2D, time: number) {
  ctx.save();
  for (let i = 0; i < 90; i += 1) {
    const x = fract(i * 0.61803398875) * WORLD_WIDTH;
    const y = fract(i * 0.41421356237 + 0.17) * WORLD_HEIGHT;
    const alpha = 0.035 + (Math.sin(time * 0.00015 + i * 1.17) + 1) * 0.018;
    const size = 1.1 + fract(i * 0.284) * 1.8;
    ctx.fillStyle = `rgba(172, 214, 255, ${alpha})`;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawLinks(ctx: CanvasRenderingContext2D, nodes: HarmonicNode[], time: number, weights: ReturnType<typeof makeWeights>) {
  ctx.save();
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 280) continue;
      const strength = (1 - distance / 280) ** 1.5;
      const pulse = 0.55 + 0.45 * Math.sin(time * 0.0002 + a.pulseOffset + b.pulseOffset);
      ctx.strokeStyle = `rgba(108, 175, 255, ${0.018 + strength * (0.05 + weights.calm * 0.035) * pulse})`;
      ctx.lineWidth = 1 + strength * 0.6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHarmonicNodes(ctx: CanvasRenderingContext2D, nodes: HarmonicNode[], time: number, weights: ReturnType<typeof makeWeights>) {
  ctx.save();
  for (const node of nodes) {
    const calmPulse = 0.45 + (Math.sin(time * 0.00024 * node.calmBias + node.pulseOffset) + 1) * 0.25;
    const glowRadius = node.baseRadius * (2.4 + calmPulse * 1.6);
    const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
    halo.addColorStop(0, `hsla(${node.hue}, 84%, 72%, ${0.06 + calmPulse * 0.04})`);
    halo.addColorStop(0.55, `hsla(${node.hue}, 84%, 58%, 0.025)`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(node.x, node.y, glowRadius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = `rgba(196, 230, 255, ${0.18 + calmPulse * 0.22})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.baseRadius + weights.calm * 1.5, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = `rgba(214, 240, 255, ${0.35 + weights.calm * 0.25})`;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.baseRadius * 0.22 + calmPulse * 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawAnomalies(ctx: CanvasRenderingContext2D, anomalies: Anomaly[], time: number) {
  ctx.save();
  for (const anomaly of anomalies) {
    const lifeT = clamp(anomaly.age / anomaly.life, 0, 1);
    const intensity = Math.sin((1 - lifeT) * Math.PI) * anomaly.distortion;
    const radius = 18 + intensity * 42;
    ctx.save();
    ctx.translate(anomaly.x, anomaly.y);
    ctx.rotate(anomaly.phase + time * 0.00028 * anomaly.spin);
    ctx.strokeStyle = `rgba(146, 114, 255, ${0.08 + intensity * 0.22})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-radius, -radius * 0.15);
    ctx.quadraticCurveTo(-radius * 0.2, -radius * 0.85, radius * 0.72, -radius * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, radius * 0.38);
    ctx.quadraticCurveTo(radius * 0.08, -radius * 0.28, radius * 0.82, radius * 0.64);
    ctx.stroke();
    ctx.strokeStyle = `rgba(182, 144, 255, ${0.06 + intensity * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.82, radius * 0.36, anomaly.seed, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawBreaches(ctx: CanvasRenderingContext2D, breaches: BreachEntity[], time: number, pressure: number) {
  ctx.save();
  for (const breach of breaches) {
    const pulse = 0.45 + 0.55 * Math.sin(time * 0.0034 + breach.pulseOffset);
    const radius = breach.size * (1 + pulse * 0.14);
    const haloRadius = radius * (2.2 + pressure * 0.9);
    const halo = ctx.createRadialGradient(breach.x, breach.y, 0, breach.x, breach.y, haloRadius);
    halo.addColorStop(0, `rgba(255, 96, 158, ${0.12 + pressure * 0.12})`);
    halo.addColorStop(0.55, `rgba(255, 44, 112, ${0.06 + pulse * 0.05})`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(breach.x, breach.y, haloRadius, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(breach.x, breach.y);
    ctx.rotate(breach.heading + pulse * 0.25);
    ctx.strokeStyle = `rgba(255, 212, 236, ${0.38 + pulse * 0.25})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * TAU;
      const spike = radius * (1.1 + Math.sin(time * 0.0024 + breach.filamentPhase + i) * 0.18);
      const x = Math.cos(angle) * spike;
      const y = Math.sin(angle) * spike;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 74, 128, ${0.28 + pressure * 0.24})`;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.95, 0);
    ctx.lineTo(radius * 0.95, 0);
    ctx.moveTo(0, -radius * 0.95);
    ctx.lineTo(0, radius * 0.95);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 220, 232, ${0.55 + pulse * 0.18})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawHudGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "rgba(110, 170, 255, 0.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD_WIDTH; x += 200) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += 200) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function updateHarmonicNodes(nodes: HarmonicNode[], elapsed: number) {
  for (const node of nodes) {
    const orbitPhase = elapsed * node.driftSpeed + node.driftPhase;
    node.x += Math.cos(orbitPhase) * 0.03;
    node.y += Math.sin(orbitPhase * 0.8) * 0.03;
    node.x = clamp(node.x, 110, WORLD_WIDTH - 110);
    node.y = clamp(node.y, 110, WORLD_HEIGHT - 110);
    node.signal = fract(node.signal + 0.0012 * node.calmBias);
  }
}

function updateAnomalies(sim: SimulationState, dt: number, weights: ReturnType<typeof makeWeights>) {
  const next: Anomaly[] = [];
  for (const anomaly of sim.anomalies) {
    anomaly.age += dt;
    anomaly.phase += anomaly.spin * dt;
    anomaly.vx += randCentered(1.4) * dt;
    anomaly.vy += randCentered(1.4) * dt;
    anomaly.vx *= 0.994;
    anomaly.vy *= 0.994;
    anomaly.x += anomaly.vx * dt * 14;
    anomaly.y += anomaly.vy * dt * 14;
    anomaly.x = clamp(anomaly.x, 50, WORLD_WIDTH - 50);
    anomaly.y = clamp(anomaly.y, 50, WORLD_HEIGHT - 50);

    const lifeT = anomaly.age / anomaly.life;
    const emergenceChance = weights.emergence * 0.0034 + weights.pressure * 0.0058 + weights.breach * 0.0072;
    if (lifeT > 0.48 && Math.random() < emergenceChance * dt * 60) {
      spawnBreach(sim, anomaly);
      continue;
    }
    if (lifeT < 1) next.push(anomaly);
  }
  sim.anomalies = next;
}

function updateBreaches(sim: SimulationState, dt: number, weights: ReturnType<typeof makeWeights>) {
  const next: BreachEntity[] = [];
  for (const breach of sim.breaches) {
    breach.age += dt;
    const targetNode = sim.harmonicNodes.find((node) => node.id === breach.targetNodeId)
      ?? sim.harmonicNodes[randInt(0, sim.harmonicNodes.length - 1)];
    if (Math.random() < 0.0024 * dt * 60) {
      breach.targetNodeId = sim.harmonicNodes[randInt(0, sim.harmonicNodes.length - 1)].id;
    }
    const desired = normalize({ x: targetNode.x - breach.x, y: targetNode.y - breach.y });
    breach.vx = damp(breach.vx, desired.x * (16 + weights.pressure * 8), 1.8, dt);
    breach.vy = damp(breach.vy, desired.y * (16 + weights.pressure * 8), 1.8, dt);
    breach.x += breach.vx * dt * 12;
    breach.y += breach.vy * dt * 12;
    breach.heading = Math.atan2(breach.vy, breach.vx);
    breach.x = clamp(breach.x, 40, WORLD_WIDTH - 40);
    breach.y = clamp(breach.y, 40, WORLD_HEIGHT - 40);
    breach.filamentPhase += dt * (1.2 + weights.breach * 1.5);

    const reproduceChance = (0.0009 + weights.pressure * 0.0016 + weights.breach * 0.0038) * breach.reproduction;
    if (sim.breaches.length + next.length < MAX_BREACHES && Math.random() < reproduceChance * dt * 60) {
      sim.anomalies.push({
        id: sim.nextEntityId++,
        x: breach.x + randCentered(36),
        y: breach.y + randCentered(36),
        vx: randCentered(10),
        vy: randCentered(10),
        age: 0,
        life: rand(18, 30),
        distortion: rand(0.24, 0.52),
        phase: rand(0, TAU),
        spin: rand(-1.2, 1.2),
        seed: rand(0, 1000),
        sourceNodeId: breach.targetNodeId,
      });
    }

    const fadeAfter = 90 + weights.breach * 40;
    if (breach.age < fadeAfter) next.push(breach);
  }
  sim.breaches = next;
}

function updateSimulation(sim: SimulationState, dt: number) {
  sim.elapsed += dt;
  const timeProgress = smoothstep(18, 220, sim.elapsed);
  const systemicPressure = clamp(sim.breaches.length / 11 + sim.anomalies.length / 24, 0, 1);
  const targetProgress = clamp(timeProgress * 0.68 + systemicPressure * 0.42, 0, 1);
  sim.phaseProgress = damp(sim.phaseProgress, targetProgress, 0.22, dt);

  const weights = makeWeights(sim.phaseProgress);
  updateHarmonicNodes(sim.harmonicNodes, sim.elapsed);
  updateAnomalies(sim, dt, weights);
  updateBreaches(sim, dt, weights);

  if (sim.elapsed >= sim.nextAnomalyAt) {
    const baseInterval = lerp(18, 4.8, weights.breach + weights.pressure * 0.5 + weights.anomaly * 0.25);
    spawnAnomaly(sim, weights);
    sim.nextAnomalyAt = sim.elapsed + rand(baseInterval * 0.75, baseInterval * 1.25);
  }

  if ((weights.emergence > 0.2 || sim.breaches.length > 0) && sim.elapsed >= sim.nextBreachAt) {
    spawnBreach(sim);
    const baseInterval = lerp(28, 6.6, weights.pressure * 0.7 + weights.breach);
    sim.nextBreachAt = sim.elapsed + rand(baseInterval * 0.8, baseInterval * 1.2);
  }

  sim.instability = damp(sim.instability, clamp(weights.anomaly * 0.26 + weights.emergence * 0.48 + weights.pressure * 0.72 + weights.breach * 0.94, 0, 1), 0.45, dt);
  sim.rhythmicPressure = damp(sim.rhythmicPressure, clamp(sim.breaches.length / 10 + weights.pressure * 0.55 + weights.breach * 0.4, 0, 1), 0.75, dt);
  if (sim.anomalies.length > MAX_ANOMALIES) sim.anomalies.length = MAX_ANOMALIES;
}

function describePhase(progress: number) {
  const phase = phaseNameFor(progress);
  if (phase === "Calm") return "Slow harmonic drift. Observe the field settling into relation.";
  if (phase === "Anomaly") return "Subtle distortions begin to interrupt the field without fully breaching it.";
  if (phase === "Emergence") return "Distinct breach entities surface from unstable anomalies.";
  if (phase === "Pressure") return "Propagation and rhythm intensify. The system starts pulsing under stress.";
  return "Instability dominates the field while pressure peaks and spread accelerates.";
}

export function mountResonanceBreachApp(root: HTMLElement) {
  const wrap = document.createElement("div");
  wrap.className = "resonanceApp";

  const canvas = document.createElement("canvas");
  canvas.className = "resonanceCanvas";

  const overlay = document.createElement("div");
  overlay.className = "resonanceOverlay";
  overlay.innerHTML = `
    <div class="resonancePanel resonanceTitlePanel">
      <p class="resonanceEyebrow">Prototype · ResonanceBreach</p>
      <h1>Resonance Breach</h1>
      <p class="resonanceSubtitle">A minimal field simulation about harmonic order slipping into rhythmic instability.</p>
    </div>
    <div class="resonancePanel resonanceStatusPanel">
      <div>
        <p class="resonanceLabel">Phase</p>
        <p class="resonancePhase" data-phase-name>Calm</p>
      </div>
      <div>
        <p class="resonanceLabel">Instability</p>
        <div class="resonanceMeter"><span data-instability-bar></span></div>
      </div>
      <p class="resonancePhaseText" data-phase-text></p>
      <div class="resonanceLegend">
        <span><i class="legendDot legendDot-harmonic"></i> Harmonic nodes</span>
        <span><i class="legendDot legendDot-anomaly"></i> Anomalies</span>
        <span><i class="legendDot legendDot-breach"></i> Breach entities</span>
      </div>
    </div>
    <div class="resonancePanel resonanceControlsPanel">
      <p class="resonanceLabel">Controls</p>
      <ul>
        <li><strong>Wheel</strong> zoom</li>
        <li><strong>Drag</strong> pan camera</li>
        <li><strong>WASD</strong> pan camera</li>
        <li><strong>Shift</strong> hold for 0.5× slow motion</li>
        <li><strong>Space</strong> hold for 2× fast forward</li>
      </ul>
    </div>
  `;

  wrap.append(canvas, overlay);
  root.replaceChildren(wrap);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");

  const phaseNameEl = overlay.querySelector<HTMLElement>("[data-phase-name]")!;
  const phaseTextEl = overlay.querySelector<HTMLElement>("[data-phase-text]")!;
  const instabilityBarEl = overlay.querySelector<HTMLElement>("[data-instability-bar]")!;

  const camera: CameraState = { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT * 0.5, zoom: 0.72 };
  const sim = createSimulation();
  const input: InputState = {
    keys: new Set(),
    pointer: {
      active: false,
      id: -1,
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      lastX: 0,
      lastY: 0,
      dragging: false,
    },
  };
  const audio = createAudioController();

  let dpr = 1;
  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let lastTime = performance.now();
  let timeScale = 1;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    constrainCamera(camera);
  };

  const getPointerWorld = (clientX: number, clientY: number) => {
    return screenToWorld(camera, { x: clientX, y: clientY }, width, height);
  };

  const updateOverlay = () => {
    phaseNameEl.textContent = phaseNameFor(sim.phaseProgress);
    phaseTextEl.textContent = describePhase(sim.phaseProgress);
    instabilityBarEl.style.width = `${Math.round(sim.instability * 100)}%`;
  };

  const updateCamera = (dt: number) => {
    const axisX = (input.keys.has("KeyD") ? 1 : 0) - (input.keys.has("KeyA") ? 1 : 0);
    const axisY = (input.keys.has("KeyS") ? 1 : 0) - (input.keys.has("KeyW") ? 1 : 0);
    if (axisX || axisY) {
      camera.x += axisX * CAMERA_PAN_SPEED * dt / camera.zoom;
      camera.y += axisY * CAMERA_PAN_SPEED * dt / camera.zoom;
    }
    constrainCamera(camera);
  };

  const render = (timestamp: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBackdrop(ctx, width, height);

    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    drawStarField(ctx, timestamp);
    drawHudGrid(ctx);
    drawWorldBounds(ctx);
    const weights = makeWeights(sim.phaseProgress);
    drawLinks(ctx, sim.harmonicNodes, timestamp, weights);
    drawHarmonicNodes(ctx, sim.harmonicNodes, timestamp, weights);
    drawAnomalies(ctx, sim.anomalies, timestamp);
    drawBreaches(ctx, sim.breaches, timestamp, sim.rhythmicPressure);
    ctx.restore();

    const centerWorld = screenToWorld(camera, { x: width * 0.5, y: height * 0.5 }, width, height);
    const centerScreen = worldToScreen(camera, centerWorld, width, height);
    ctx.strokeStyle = "rgba(182, 220, 255, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerScreen.x - 8, centerScreen.y);
    ctx.lineTo(centerScreen.x + 8, centerScreen.y);
    ctx.moveTo(centerScreen.x, centerScreen.y - 8);
    ctx.lineTo(centerScreen.x, centerScreen.y + 8);
    ctx.stroke();
  };

  const step = (timestamp: number) => {
    const rawDt = clamp((timestamp - lastTime) / 1000, 0.001, 0.05);
    lastTime = timestamp;
    const slowMotion = input.keys.has("ShiftLeft") || input.keys.has("ShiftRight");
    const fastForward = input.keys.has("Space");
    const targetTimeScale = fastForward ? 2 : slowMotion ? 0.5 : 1;
    timeScale = damp(timeScale, targetTimeScale, 6.5, rawDt);
    const dt = rawDt * timeScale;

    updateCamera(rawDt);
    updateSimulation(sim, dt);
    updateOverlay();
    audio.update({ phaseProgress: sim.phaseProgress, rhythmicPressure: sim.rhythmicPressure, slowMotion, fastForward });
    render(timestamp);
    animationFrame = window.requestAnimationFrame(step);
  };

  const onPointerDown = (event: PointerEvent) => {
    audio.unlock();
    input.pointer.active = true;
    input.pointer.id = event.pointerId;
    input.pointer.x = event.clientX;
    input.pointer.y = event.clientY;
    input.pointer.lastX = event.clientX;
    input.pointer.lastY = event.clientY;
    input.pointer.worldX = getPointerWorld(event.clientX, event.clientY).x;
    input.pointer.worldY = getPointerWorld(event.clientX, event.clientY).y;
    input.pointer.dragging = true;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!input.pointer.active || event.pointerId !== input.pointer.id) return;
    const dx = event.clientX - input.pointer.lastX;
    const dy = event.clientY - input.pointer.lastY;
    input.pointer.lastX = event.clientX;
    input.pointer.lastY = event.clientY;
    if (input.pointer.dragging) {
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      constrainCamera(camera);
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== input.pointer.id) return;
    input.pointer.active = false;
    input.pointer.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    audio.unlock();
    const before = getPointerWorld(event.clientX, event.clientY);
    const zoomFactor = Math.exp(-event.deltaY * 0.0011);
    camera.zoom = clamp(camera.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
    const after = getPointerWorld(event.clientX, event.clientY);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    constrainCamera(camera);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Space") event.preventDefault();
    audio.unlock();
    input.keys.add(event.code);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    input.keys.delete(event.code);
  };

  resize();
  updateOverlay();
  animationFrame = window.requestAnimationFrame(step);

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      audio.destroy();
    },
  };
}
