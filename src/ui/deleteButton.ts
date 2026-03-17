export function wireSafeDeleteButton(btn: HTMLButtonElement, onConfirm: () => void) {
  let armed = false;
  let armTimer = 0;
  const baseText = btn.textContent ?? "×";

  const disarm = () => {
    armed = false;
    btn.classList.remove("armed");
    btn.textContent = baseText;
    btn.title = "Remove module (undo available with Ctrl/Cmd+Z)";
    if (armTimer) {
      window.clearTimeout(armTimer);
      armTimer = 0;
    }
  };

  btn.title = "Remove module (undo available with Ctrl/Cmd+Z)";
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    if (!armed) {
      armed = true;
      btn.classList.add("armed");
      btn.textContent = "Confirm";
      btn.title = "Click again to remove. Undo with Ctrl/Cmd+Z.";
      armTimer = window.setTimeout(disarm, 1200);
      return;
    }

    disarm();
    onConfirm();
  });

  btn.addEventListener("blur", () => {
    if (armed) disarm();
  });
}
