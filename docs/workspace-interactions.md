# Workspace interactions UX pass

This pass focuses on interaction mechanics in the fixed-footprint workspace grid.

## 1) Click-to-add behavior

- `AddModuleSlot` now receives a concrete `insertionIndex` from the lane grid so insertion is tied to a real cell index.
- Clicking a slot opens the add menu at cursor-relative coordinates inside that slot (anchored placement), reinforcing “add here” locality.
- The menu includes a small visual pointer and remains inside the slot boundary, so the relationship between slot and menu stays explicit.
- Clicking outside the slot cleanly dismisses the menu.
- Pressing `Escape` dismisses and restores focus to the slot.

## 2) Hover and drag-over states

- `AddModuleSlot` hover/focus states were strengthened slightly with subtle border/background/inset ring feedback (no layout shift).
- Valid drag-over state (`dragReady`) is intentionally stronger than hover using a brighter accent and thicker inset ring.
- Draggable module surfaces now expose lightweight hover feedback.
- The currently dragged module is visibly active via reduced opacity and accent ring.

## 3) Insertion model and drop behavior

- Add and drop operations are now index-based per family lane.
- Clicking add in a slot inserts the new module at that slot’s lane index (deterministic position).
- Dropping a draggable module on a valid `AddModuleSlot` moves that exact module to that exact lane insertion index.
- Drops only commit when target lane + index are valid; otherwise no reflow is applied.
- Grid proportions remain fixed because operations only reorder module data; cell sizing remains unchanged.

## 4) Swapping support

- Swapping with occupied cells is **not** implemented in this pass.
- Move behavior supports deterministic placement into empty slots only.
- This avoids ambiguous half-swap behavior and keeps outcomes legible.

## 5) Grid stability guarantees

- Module and empty-cell footprints are unchanged (`moduleCell` and `moduleSurface` dimensions remain fixed-footprint).
- Drag interaction does not resize cells.
- Insertion and move logic are lane-scoped and index-scoped, minimizing unexpected reshuffle.
- Reordering within family lanes preserves the stable lane model.

## 6) What this enables next

The refactor makes future interaction work easier because the workspace now has explicit lane insertion indices and localized target semantics. Follow-up passes can add:

- richer drag preview placeholders per cell,
- optional deterministic swap mode for occupied-cell drops,
- keyboard reordering using the same index model,
- stronger a11y announcements for add/move commit outcomes.

## Current limitations

- Drag-to-move supports empty-slot targets only.
- There is no dedicated “ghost placeholder” card during drag yet.
- Build/typecheck verification is currently blocked in this environment due restricted npm registry access.
