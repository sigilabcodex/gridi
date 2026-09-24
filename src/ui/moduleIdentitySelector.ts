import { bindFloatingPanelReposition, placeFloatingPanel } from "./floatingPanel";
import type { TooltipBinder } from "./tooltip";

export type ModuleIdentityOption<T extends string> = { value: T; label: string };

export function createModuleIdentitySelector<T extends string>(params: {
  label: "Mode" | "Type";
  value: T;
  options: ModuleIdentityOption<T>[];
  onChange: (value: T) => void;
  accent: "visual" | "gen" | "control";
  ariaLabel: string;
  tooltip?: string;
  attachTooltip?: TooltipBinder;
  minWidth?: number;
  maxWidth?: number;
  onOpen?: () => void;
  align?: "start" | "end";
  preferredSide?: "bottom" | "top";
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `moduleIdentitySelector moduleIdentitySlot moduleIdentitySlot--${params.accent} moduleIdentitySelector--${params.accent}`;
  button.setAttribute("aria-label", params.ariaLabel);
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "moduleIdentitySelectorLabel moduleIdentitySlotLabel";
  label.textContent = params.label.toUpperCase();
  const value = document.createElement("span");
  value.className = "moduleIdentitySelectorValue moduleIdentitySlotValue";
  const caret = document.createElement("span");
  caret.className = "moduleIdentitySelectorCaret moduleIdentitySlotCaret";
  caret.setAttribute("aria-hidden", "true");
  caret.textContent = "▾";
  button.append(label, value, caret);

  params.attachTooltip?.(button, { text: params.tooltip ?? `Select ${params.label.toLowerCase()}.`, ariaLabel: params.ariaLabel });

  let currentValue = params.value;
  let panel: HTMLElement | null = null;
  let removeListeners: (() => void) | null = null;
  let reposition: ReturnType<typeof bindFloatingPanelReposition> | null = null;

  const syncOptions = () => {
    const selected = params.options.find((option) => option.value === currentValue);
    value.textContent = selected?.label ?? String(currentValue);
    button.dataset.value = currentValue;
    button.title = `${params.label.toUpperCase()} ${selected?.label ?? currentValue}`;
    button.setAttribute("aria-label", `${params.ariaLabel}: ${selected?.label ?? currentValue}`);
    button.setAttribute("aria-valuetext", `${params.label} ${selected?.label ?? currentValue}`);
    panel?.querySelectorAll<HTMLButtonElement>(".moduleIdentitySelectorOption").forEach((row) => {
      const isSelected = row.dataset.value === currentValue;
      row.classList.toggle("isSelected", isSelected);
      row.setAttribute("aria-pressed", String(isSelected));
    });
  };

  const close = (restoreFocus = false) => {
    panel?.remove();
    panel = null;
    reposition?.destroy();
    reposition = null;
    removeListeners?.();
    removeListeners = null;
    button.classList.remove("isOpen");
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus && button.isConnected) button.focus();
  };

  const open = () => {
    if (panel) {
      close(true);
      return;
    }
    params.onOpen?.();
    const nextPanel = document.createElement("div");
    nextPanel.className = `floatingPanel moduleIdentitySelectorPanel moduleIdentitySelectorPanel--${params.accent}`;
    nextPanel.setAttribute("role", "dialog");
    nextPanel.setAttribute("aria-label", params.ariaLabel);
    const list = document.createElement("div");
    list.className = "moduleIdentitySelectorList";
    params.options.forEach((option) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "moduleIdentitySelectorOption";
      row.dataset.value = option.value;
      row.textContent = option.label;
      row.onclick = () => {
        const changed = option.value !== currentValue;
        currentValue = option.value;
        close(true);
        syncOptions();
        if (changed) params.onChange(option.value);
      };
      list.appendChild(row);
    });
    nextPanel.appendChild(list);
    document.body.appendChild(nextPanel);

    const width = { minWidth: params.minWidth ?? 150, maxWidth: params.maxWidth ?? 220, matchAnchorWidth: true };
    const place = () => (button.isConnected ? button.getBoundingClientRect() : null);
    placeFloatingPanel(nextPanel, button.getBoundingClientRect(), {
      preferredSide: params.preferredSide ?? "bottom", align: params.align ?? "start", offset: 8, ...width,
    });
    reposition = bindFloatingPanelReposition(nextPanel, place, {
      preferredSide: params.preferredSide ?? "bottom", align: params.align ?? "start", offset: 8, ...width,
    });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (nextPanel.contains(target) || button.contains(target))) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    removeListeners = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
    panel = nextPanel;
    button.classList.add("isOpen");
    button.setAttribute("aria-expanded", "true");
    syncOptions();
  };

  button.onclick = open;
  button.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel) {
      event.preventDefault();
      close(true);
    }
  });
  syncOptions();
  return { button, setValue: (next: T) => { currentValue = next; syncOptions(); }, close };
}
