function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function makeModal(title: string) {
  const overlay = el("div", "modalOverlay");
  const modal = el("div", "modal");
  const head = el("div", "modalHead");
  const h = el("div", "modalTitle", title);
  const close = el("button", "modalClose", "×");

  close.title = "Close";
  head.append(h, close);

  const body = el("div", "modalBody");

  modal.append(head, body);
  overlay.appendChild(modal);

  const open = () => document.body.appendChild(overlay);
  const destroy = () => overlay.remove();

  close.onclick = destroy;
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) destroy();
  });

  return { overlay, modal, body, open, destroy };
}

export { el };
