export type FloatingAnchor = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">;

export type FloatingPanelOptions = {
  offset?: number;
  padding?: number;
  preferredSide?: "top" | "bottom";
  align?: "start" | "center" | "end";
  minWidth?: number;
  maxWidth?: number;
  matchAnchorWidth?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function pointAnchor(x: number, y: number): FloatingAnchor {
  return { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };
}

export function placeFloatingPanel(panel: HTMLElement, anchor: FloatingAnchor, opts: FloatingPanelOptions = {}) {
  const offset = opts.offset ?? 10;
  const padding = opts.padding ?? 10;
  const preferredSide = opts.preferredSide ?? "bottom";
  const align = opts.align ?? "start";

  panel.style.position = "fixed";
  panel.style.left = "0px";
  panel.style.top = "0px";
  panel.style.maxWidth = `min(${opts.maxWidth ?? 280}px, calc(100vw - ${padding * 2}px))`;
  panel.style.minWidth = `${Math.max(opts.minWidth ?? 0, opts.matchAnchorWidth ? anchor.width : 0)}px`;
  panel.style.maxHeight = `calc(100vh - ${padding * 2}px)`;

  const rect = panel.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const roomBelow = vh - anchor.bottom - padding;
  const roomAbove = anchor.top - padding;
  const side = preferredSide === "bottom"
    ? (roomBelow >= rect.height || roomBelow >= roomAbove ? "bottom" : "top")
    : (roomAbove >= rect.height || roomAbove >= roomBelow ? "top" : "bottom");

  let left = anchor.left;
  if (align === "center") left = anchor.left + anchor.width / 2 - rect.width / 2;
  if (align === "end") left = anchor.right - rect.width;
  left = clamp(left, padding, Math.max(padding, vw - rect.width - padding));

  let top = side === "bottom" ? anchor.bottom + offset : anchor.top - rect.height - offset;
  top = clamp(top, padding, Math.max(padding, vh - rect.height - padding));

  panel.dataset.side = side;
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;

  const availableHeight = side === "bottom"
    ? vh - top - padding
    : anchor.top - offset - padding;
  panel.style.maxHeight = `${Math.max(120, Math.floor(availableHeight))}px`;
}

export function bindFloatingPanelReposition(panel: HTMLElement, getAnchor: () => FloatingAnchor | null, opts: FloatingPanelOptions = {}) {
  const update = () => {
    const anchor = getAnchor();
    if (!anchor || !panel.isConnected) return;
    placeFloatingPanel(panel, anchor, opts);
  };

  const onViewportChange = () => update();
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("scroll", onViewportChange, true);

  queueMicrotask(update);

  return {
    update,
    destroy() {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    },
  };
}
