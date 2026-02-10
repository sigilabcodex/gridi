// src/ui/AddModuleSlot.ts
import type { ModuleType, VoiceKind, VisualKind } from "../patch";

export type AddModuleChoice =
  | { type: "voice"; kind: VoiceKind; template?: string }
  | { type: "visual"; kind: VisualKind }
  | { type: "terminal" }
  | { type: "effect" };

export function AddModuleSlot(props: {
  onChoose: (c: AddModuleChoice) => void;
}) {
  function pick() {
    // ultra-simple v0.3: prompt-based menu (no UI dependencies)
    // luego lo cambiamos a popover bonito.
    const t = prompt("Add module: voice / visual / terminal", "voice");
    if (!t) return;
    const type = t.trim().toLowerCase() as ModuleType;

    if (type === "voice") {
      const k = prompt("Voice kind: drum / tonal", "drum");
      if (!k) return;
      const kind = (k.trim().toLowerCase() === "tonal" ? "tonal" : "drum") as VoiceKind;

      if (kind === "drum") {
        const tpl = prompt("Drum template: kick/snare/hat/blank", "blank") || "blank";
        props.onChoose({ type: "voice", kind, template: tpl.trim().toLowerCase() });
      } else {
        const tpl = prompt("Tonal template: fm/drone/blank", "fm") || "fm";
        props.onChoose({ type: "voice", kind, template: tpl.trim().toLowerCase() });
      }
      return;
    }

    if (type === "visual") {
      const k = prompt("Visual: scope / spectrum / pattern", "scope");
      if (!k) return;
      const kind = (k.trim().toLowerCase() as VisualKind) || "scope";
      props.onChoose({ type: "visual", kind });
      return;
    }

    if (type === "terminal") {
      props.onChoose({ type: "terminal" });
      return;
    }

    alert("Not implemented yet.");
  }

  return (
    <div className="module add-slot" onClick={pick} title="Add module">
      <div className="add-slot-plus">+</div>
      <div className="add-slot-text">Add module</div>
    </div>
  );
}
