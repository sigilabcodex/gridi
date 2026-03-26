import { bindFloatingPanelReposition, placeFloatingPanel, type FloatingPanelOptions } from "./floatingPanel";

export type TooltipBindOptions = FloatingPanelOptions & {
  text: string;
  ariaLabel?: string;
  hoverDelayMs?: number;
};

export type TooltipBinder = (target: HTMLElement, options: TooltipBindOptions) => void;

type TooltipControllerParams = {
  getEnabled: () => boolean;
};

const DEFAULT_HOVER_DELAY_MS = 720;
let nextTooltipId = 0;

function resolveTooltipPlacement(options: TooltipBindOptions): FloatingPanelOptions {
  const isNarrowPortrait = window.matchMedia("(max-width: 760px) and (orientation: portrait)").matches;
  const baseMaxWidth = options.maxWidth ?? 220;

  if (!isNarrowPortrait) {
    return {
      preferredSide: options.preferredSide ?? "bottom",
      align: options.align ?? "center",
      offset: options.offset ?? 10,
      padding: options.padding ?? 10,
      maxWidth: baseMaxWidth,
    };
  }

  return {
    preferredSide: options.preferredSide ?? "top",
    align: options.align ?? "center",
    offset: options.offset ?? 8,
    padding: options.padding ?? 8,
    maxWidth: Math.min(baseMaxWidth, 196),
  };
}

function mergeDescribedBy(target: HTMLElement, tooltipId: string) {
  const tokens = new Set((target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
  tokens.add(tooltipId);
  target.setAttribute("aria-describedby", [...tokens].join(" "));
}

function removeDescribedBy(target: HTMLElement, tooltipId: string) {
  const tokens = (target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  const next = tokens.filter((token) => token !== tooltipId);
  if (next.length) target.setAttribute("aria-describedby", next.join(" "));
  else target.removeAttribute("aria-describedby");
}

export function createTooltipController(params: TooltipControllerParams) {
  const tooltip = document.createElement("div");
  tooltip.className = "floatingPanel appTooltip hidden";
  tooltip.setAttribute("role", "tooltip");
  tooltip.id = `gridi-tooltip-${++nextTooltipId}`;

  let activeTarget: HTMLElement | null = null;
  let hoverTimer = 0;
  let repositionCleanup: { destroy: () => void } | null = null;
  const onEscapeKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (!activeTarget && !hoverTimer) return;
    hide();
  };

  const clearHoverTimer = () => {
    if (!hoverTimer) return;
    window.clearTimeout(hoverTimer);
    hoverTimer = 0;
  };

  const hide = () => {
    clearHoverTimer();
    if (activeTarget) removeDescribedBy(activeTarget, tooltip.id);
    activeTarget = null;
    repositionCleanup?.destroy();
    repositionCleanup = null;
    document.removeEventListener("keydown", onEscapeKey, true);
    tooltip.classList.add("hidden");
    tooltip.remove();
  };

  const show = (target: HTMLElement, options: TooltipBindOptions) => {
    if (!params.getEnabled() || !options.text.trim()) return;

    clearHoverTimer();
    activeTarget = target;
    tooltip.textContent = options.text;
    tooltip.classList.remove("hidden");
    const placement = resolveTooltipPlacement(options);

    if (!tooltip.isConnected) document.body.appendChild(tooltip);
    placeFloatingPanel(tooltip, target.getBoundingClientRect(), placement);

    repositionCleanup?.destroy();
    repositionCleanup = bindFloatingPanelReposition(
      tooltip,
      () => (target.isConnected ? target.getBoundingClientRect() : null),
      placement,
    );

    mergeDescribedBy(target, tooltip.id);
    document.addEventListener("keydown", onEscapeKey, true);
  };

  const scheduleShow = (target: HTMLElement, options: TooltipBindOptions, immediate: boolean) => {
    if (!params.getEnabled()) return;
    clearHoverTimer();
    const delay = immediate ? 0 : options.hoverDelayMs ?? DEFAULT_HOVER_DELAY_MS;
    hoverTimer = window.setTimeout(() => {
      hoverTimer = 0;
      show(target, options);
    }, delay);
  };

  const attachTooltip: TooltipBinder = (target, options) => {
    if (options.ariaLabel) target.setAttribute("aria-label", options.ariaLabel);

    target.addEventListener("pointerenter", () => {
      if (!params.getEnabled()) return;
      scheduleShow(target, options, false);
    });

    target.addEventListener("pointerleave", () => {
      if (activeTarget === target || hoverTimer) hide();
    });

    target.addEventListener("focus", () => {
      if (!params.getEnabled()) return;
      scheduleShow(target, options, true);
    });

    target.addEventListener("blur", () => {
      if (activeTarget === target || hoverTimer) hide();
    });

    target.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (activeTarget !== target && !hoverTimer) return;
      event.stopPropagation();
      hide();
    });
  };

  return {
    attachTooltip,
    hide,
    refreshEnabled() {
      if (params.getEnabled()) return;
      hide();
    },
  };
}
