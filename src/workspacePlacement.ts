import type { Module } from "./patch";

export type GridPosition = {
  x: number;
  y: number;
};

export type ResolvedGridLayout<T> = {
  modulesByPosition: Map<string, T>;
  slotByModuleId: Map<string, number>;
  totalCells: number;
};

export const WORKSPACE_COLUMNS = 3;

function isValidGridAxis(value: unknown) {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function isGridPosition(value: unknown): value is GridPosition {
  if (!value || typeof value !== "object") return false;
  return isValidGridAxis((value as GridPosition).x) && isValidGridAxis((value as GridPosition).y);
}

export function getModuleGridPosition(module: Pick<Module, "x" | "y">): GridPosition | null {
  if (!isValidGridAxis(module.x) || !isValidGridAxis(module.y)) return null;
  return { x: module.x as number, y: module.y as number };
}

export function gridPositionKey(position: GridPosition) {
  return `${position.x},${position.y}`;
}

export function gridPositionToSlotIndex(position: GridPosition, columns = WORKSPACE_COLUMNS) {
  return position.y * columns + position.x;
}

export function slotIndexToGridPosition(slotIndex: number, columns = WORKSPACE_COLUMNS): GridPosition {
  return {
    x: slotIndex % columns,
    y: Math.floor(slotIndex / columns),
  };
}

export function canonicalizeGridPosition(position: GridPosition, columns = WORKSPACE_COLUMNS): GridPosition {
  return slotIndexToGridPosition(gridPositionToSlotIndex(position, columns), columns);
}

export function setModuleGridPosition(module: Pick<Module, "x" | "y">, position: GridPosition) {
  module.x = position.x;
  module.y = position.y;
}

export function normalizeModuleGridPositions<T extends Pick<Module, "id" | "x" | "y">>(
  modules: T[],
  columns = WORKSPACE_COLUMNS
) {
  const occupied = new Set<string>();
  let nextDenseSlot = 0;

  const reserveNextDensePosition = () => {
    while (occupied.has(gridPositionKey(slotIndexToGridPosition(nextDenseSlot, columns)))) nextDenseSlot++;
    const position = slotIndexToGridPosition(nextDenseSlot, columns);
    nextDenseSlot++;
    return position;
  };

  for (const module of modules) {
    const preferred = getModuleGridPosition(module);
    const target = preferred && !occupied.has(gridPositionKey(preferred))
      ? preferred
      : reserveNextDensePosition();
    setModuleGridPosition(module, target);
    occupied.add(gridPositionKey(target));
  }

  return modules;
}

export function resolveGridLayout<T extends Pick<Module, "id" | "x" | "y">>(
  modules: T[],
  columns = WORKSPACE_COLUMNS
): ResolvedGridLayout<T> {
  const modulesByPosition = new Map<string, T>();
  const slotByModuleId = new Map<string, number>();
  let highestOccupiedSlot = -1;
  let nextDenseSlot = 0;

  const reserveNextDensePosition = () => {
    let position = slotIndexToGridPosition(nextDenseSlot, columns);
    while (modulesByPosition.has(gridPositionKey(position))) {
      nextDenseSlot++;
      position = slotIndexToGridPosition(nextDenseSlot, columns);
    }
    nextDenseSlot++;
    return position;
  };

  for (const module of modules) {
    const preferred = getModuleGridPosition(module);
    const canonicalPreferred = preferred ? canonicalizeGridPosition(preferred, columns) : null;
    const position = canonicalPreferred && !modulesByPosition.has(gridPositionKey(canonicalPreferred))
      ? canonicalPreferred
      : reserveNextDensePosition();
    const slotIndex = gridPositionToSlotIndex(position, columns);
    modulesByPosition.set(gridPositionKey(position), module);
    slotByModuleId.set(module.id, slotIndex);
    highestOccupiedSlot = Math.max(highestOccupiedSlot, slotIndex);
  }

  const cellsNeededForOccupancy = highestOccupiedSlot + 1;
  const cellsWithTrailingSlot = Math.max(columns, cellsNeededForOccupancy + 1);

  return {
    modulesByPosition,
    slotByModuleId,
    totalCells: Math.ceil(cellsWithTrailingSlot / columns) * columns,
  };
}
