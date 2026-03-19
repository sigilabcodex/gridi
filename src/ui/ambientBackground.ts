const NODE_COUNT = 16;
const VEIL_COUNT = 3;
const CONNECTION_DISTANCE = 220;
const FRAME_INTERVAL_MS = 1000 / 30;

type DriftNode = {
  anchorX: number;
  anchorY: number;
  radiusX: number;
  radiusY: number;
  hue: number;
  phase: number;
  phase2: number;
  speed: number;
  pulse: number;
  pulseSpeed: number;
  size: number;
};

type Veil = {
  anchorX: number;
  anchorY: number;
  radius: number;
  driftX: number;
  driftY: number;
  phase: number;
  speed: number;
  hue: number;
};

export type AmbientBackgroundController = {
  updateFrame: (timestamp: number) => void;
  destroy: () => void;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createNodes() {
  return Array.from({ length: NODE_COUNT }, () => ({
    anchorX: rand(0.08, 0.92),
    anchorY: rand(0.08, 0.92),
    radiusX: rand(22, 120),
    radiusY: rand(16, 90),
    hue: rand(188, 210),
    phase: rand(0, Math.PI * 2),
    phase2: rand(0, Math.PI * 2),
    speed: rand(0.35, 1.1),
    pulse: rand(0, Math.PI * 2),
    pulseSpeed: rand(0.3, 0.9),
    size: rand(1.2, 2.8),
  } satisfies DriftNode));
}

function createVeils() {
  return Array.from({ length: VEIL_COUNT }, () => ({
    anchorX: rand(0.15, 0.85),
    anchorY: rand(0.12, 0.88),
    radius: rand(220, 420),
    driftX: rand(40, 120),
    driftY: rand(30, 90),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.15, 0.45),
    hue: rand(188, 205),
  } satisfies Veil));
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
  const nodes = createNodes();
  const veils = createVeils();
  const reduceMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let reducedMotion = reduceMotionQuery?.matches ?? false;
  let lastFrameAt = -FRAME_INTERVAL_MS;
  let staticFrameDrawn = false;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    staticFrameDrawn = false;
  };

  const drawVeils = (time: number) => {
    for (const veil of veils) {
      const driftTime = time * 0.00008 * veil.speed;
      const x = width * veil.anchorX + Math.sin(driftTime + veil.phase) * veil.driftX;
      const y = height * veil.anchorY + Math.cos(driftTime * 1.2 + veil.phase) * veil.driftY;
      const gradient = ctx!.createRadialGradient(x, y, 0, x, y, veil.radius);
      gradient.addColorStop(0, `hsla(${veil.hue}, 76%, 62%, 0.082)`);
      gradient.addColorStop(0.45, `hsla(${veil.hue - 8}, 68%, 46%, 0.032)`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx!.fillStyle = gradient;
      ctx!.beginPath();
      ctx!.arc(x, y, veil.radius, 0, Math.PI * 2);
      ctx!.fill();
    }
  };

  const drawField = (time: number) => {
    const positions = nodes.map((node) => {
      const driftTime = time * 0.00012 * node.speed;
      const x = width * node.anchorX
        + Math.sin(driftTime + node.phase) * node.radiusX
        + Math.sin(driftTime * 0.53 + node.phase2) * (node.radiusX * 0.28);
      const y = height * node.anchorY
        + Math.cos(driftTime * 0.87 + node.phase2) * node.radiusY
        + Math.sin(driftTime * 0.34 + node.phase) * (node.radiusY * 0.26);
      const glow = 0.45 + (Math.sin(driftTime * node.pulseSpeed + node.pulse) + 1) * 0.28;
      return { x, y, glow, node };
    });

    ctx!.lineWidth = 0.65;

    for (let i = 0; i < positions.length; i += 1) {
      const a = positions[i];
      for (let j = i + 1; j < positions.length; j += 1) {
        const b = positions[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist > CONNECTION_DISTANCE) continue;
        const strength = (1 - dist / CONNECTION_DISTANCE) ** 2;
        ctx!.strokeStyle = `rgba(118, 202, 255, ${0.012 + strength * 0.085})`;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }
    }

    for (const { x, y, glow, node } of positions) {
      const haloRadius = 24 + glow * 42;
      const halo = ctx!.createRadialGradient(x, y, 0, x, y, haloRadius);
      halo.addColorStop(0, `hsla(${node.hue}, 82%, 74%, ${0.055 + glow * 0.032})`);
      halo.addColorStop(0.5, `hsla(${node.hue - 6}, 88%, 60%, 0.018)`);
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(x, y, haloRadius, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = `rgba(188, 232, 255, ${0.18 + glow * 0.18})`;
      ctx!.beginPath();
      ctx!.arc(x, y, node.size + glow * 0.55, 0, Math.PI * 2);
      ctx!.fill();
    }
  };

  const draw = (time: number) => {
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawVeils(time);
    drawField(time);
  };

  const updateReducedMotion = (event?: MediaQueryListEvent) => {
    reducedMotion = event?.matches ?? reduceMotionQuery?.matches ?? false;
    staticFrameDrawn = false;
  };

  resize();
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
      if (timestamp - lastFrameAt < FRAME_INTERVAL_MS) return;
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
