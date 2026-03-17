# UI principles

These are the active interface constraints for GRIDI's workspace.

## 1) Fixed module size rule

- Each module occupies one fixed-size grid cell.
- Module surfaces should not change outer footprint between families or tabs.
- Empty cells (add-slots) and occupied cells use the same visual geometry.

Why: stable spatial memory while performing or editing patches.

## 2) No internal scrollbars rule

- Module content should fit the fixed shell.
- Avoid nested/internal scrolling regions in module surfaces.
- If content overflows, split controls across tabs or simplify the face.

Why: preserve instrument feel and avoid mini-app panels.

## 3) Tab behavior

- Tabs swap the active module face inside the fixed shell.
- Tab changes should not resize module cards.
- Main face is for immediate, performance-relevant controls.
- Secondary tabs handle routing/settings and less-frequent controls.

## 4) Main-face philosophy

- Keep the first face compact, legible, and playable.
- Prefer grouped controls with clear musical meaning over long forms.
- Show setup/configuration detail only when needed (via tabs).

## 5) Workspace composition philosophy

- The workspace is a modular grid, not a scrolling dashboard.
- Add/remove actions are local to grid cells.
- Interaction should emphasize patch-building and performance flow, not menu depth.
