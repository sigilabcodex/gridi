import type { Connection, Module, Patch } from "../../patch.ts";
import { isSound, uid } from "../../patch.ts";
import type { PatchRoute, RouteEndpoint } from "../../routingGraph.ts";
import {
  getModuleGridPosition,
  gridPositionKey,
  gridPositionToSlotIndex,
  setModuleGridPosition,
  slotIndexToGridPosition,
  WORKSPACE_COLUMNS,
  type GridPosition,
} from "../../workspacePlacement.ts";
import type { ModuleSelectionState } from "./moduleSelection.ts";
import { clearModuleSelection } from "./moduleSelection.ts";

export type DeleteSelectedModulesResult = {
  deletedCount: number;
  deletedIds: string[];
  selection: ModuleSelectionState;
};

export type DuplicateSelectedModulesResult = {
  duplicatedCount: number;
  skippedCount: number;
  idMap: Map<string, string>;
  newIds: string[];
  selection: ModuleSelectionState;
};

function modulePrefix(module: Module) {
  if (module.type === "trigger") return "trg";
  if (module.type === "drum") return "drm";
  if (module.type === "tonal") return "ton";
  if (module.type === "control") return "ctl";
  if (module.type === "visual") return "vis";
  if (module.type === "effect") return "fx";
  return "mod";
}

function cloneModule(module: Module): Module {
  return structuredClone(module) as Module;
}

function cloneConnection(connection: Connection): Connection {
  return structuredClone(connection) as Connection;
}

function cloneRoute(route: PatchRoute): PatchRoute {
  return structuredClone(route) as PatchRoute;
}

function makeUniqueCopyName(sourceName: string, usedNames: Set<string>) {
  const base = sourceName.trim() ? `${sourceName.trim()} Copy` : "Module Copy";
  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }

  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }
}

function endpointReferencesDeletedModule(endpoint: RouteEndpoint, deletedIds: Set<string>) {
  return endpoint.kind === "module" && deletedIds.has(endpoint.moduleId);
}

function remapEndpoint(endpoint: RouteEndpoint, idMap: Map<string, string>): RouteEndpoint {
  if (endpoint.kind !== "module") return endpoint;
  return idMap.has(endpoint.moduleId)
    ? { ...endpoint, moduleId: idMap.get(endpoint.moduleId) as string }
    : endpoint;
}

function pruneDeletedRoutingReferences(patch: Patch, deletedIds: Set<string>) {
  patch.connections = patch.connections.filter((connection) => {
    if (deletedIds.has(connection.fromModuleId)) return false;
    return !(connection.to.type === "module" && connection.to.id && deletedIds.has(connection.to.id));
  });

  if (Array.isArray(patch.routes)) {
    patch.routes = patch.routes.filter((route) => {
      return !endpointReferencesDeletedModule(route.source, deletedIds) && !endpointReferencesDeletedModule(route.target, deletedIds);
    });
  }

  for (const module of patch.modules) {
    if (isSound(module) && module.triggerSource && deletedIds.has(module.triggerSource)) module.triggerSource = null;
    if ("modulations" in module && module.modulations && typeof module.modulations === "object") {
      for (const [parameter, sourceId] of Object.entries(module.modulations)) {
        if (sourceId && deletedIds.has(sourceId)) delete module.modulations[parameter];
      }
    }
  }
}

export function deleteSelectedModules(patch: Patch, selectedModuleIds: Iterable<string>): DeleteSelectedModulesResult {
  const selected = new Set(selectedModuleIds);
  if (!selected.size) return { deletedCount: 0, deletedIds: [], selection: clearModuleSelection() };

  const existingSelectedIds = patch.modules.filter((module) => selected.has(module.id)).map((module) => module.id);
  const deletedIds = new Set(existingSelectedIds);
  if (!deletedIds.size) return { deletedCount: 0, deletedIds: [], selection: clearModuleSelection() };

  patch.modules = patch.modules.filter((module) => !deletedIds.has(module.id));
  pruneDeletedRoutingReferences(patch, deletedIds);

  return {
    deletedCount: deletedIds.size,
    deletedIds: existingSelectedIds,
    selection: clearModuleSelection(),
  };
}

function selectedModulesInPlacementOrder(patch: Patch, selectedModuleIds: Iterable<string>) {
  const selected = new Set(selectedModuleIds);
  return patch.modules
    .filter((module) => selected.has(module.id))
    .sort((a, b) => {
      const aPosition = getModuleGridPosition(a) ?? { x: 0, y: 0 };
      const bPosition = getModuleGridPosition(b) ?? { x: 0, y: 0 };
      return gridPositionToSlotIndex(aPosition) - gridPositionToSlotIndex(bPosition);
    });
}

function reserveNearbyPosition(source: Module, occupied: Set<string>, columns = WORKSPACE_COLUMNS): GridPosition {
  const sourcePosition = getModuleGridPosition(source) ?? { x: 0, y: 0 };
  let slot = gridPositionToSlotIndex(sourcePosition, columns) + 1;
  while (true) {
    const candidate = slotIndexToGridPosition(slot, columns);
    const key = gridPositionKey(candidate);
    if (!occupied.has(key)) {
      occupied.add(key);
      return candidate;
    }
    slot++;
  }
}

function remapSoundRouting(module: Module, idMap: Map<string, string>) {
  if (isSound(module) && module.triggerSource && idMap.has(module.triggerSource)) {
    module.triggerSource = idMap.get(module.triggerSource) as string;
  }

  if ("modulations" in module && module.modulations && typeof module.modulations === "object") {
    for (const [parameter, sourceId] of Object.entries(module.modulations)) {
      if (sourceId && idMap.has(sourceId)) module.modulations[parameter] = idMap.get(sourceId) as string;
    }
  }
}

function duplicateSelectedConnections(patch: Patch, selectedOriginalIds: Set<string>, idMap: Map<string, string>) {
  const duplicates: Connection[] = [];
  for (const connection of patch.connections) {
    if (!selectedOriginalIds.has(connection.fromModuleId)) continue;
    const next = cloneConnection(connection);
    next.id = uid("conn");
    next.fromModuleId = idMap.get(connection.fromModuleId) as string;
    if (next.to.type === "module" && next.to.id && idMap.has(next.to.id)) next.to.id = idMap.get(next.to.id);
    duplicates.push(next);
  }
  patch.connections.push(...duplicates);
}

function shouldDuplicateRoute(route: PatchRoute, selectedOriginalIds: Set<string>) {
  const sourceSelected = route.source.kind === "module" && selectedOriginalIds.has(route.source.moduleId);
  const targetSelected = route.target.kind === "module" && selectedOriginalIds.has(route.target.moduleId);

  if (route.domain === "event" || route.domain === "modulation") return targetSelected;
  if (route.domain === "audio") return sourceSelected || targetSelected;
  if (route.domain === "midi") return sourceSelected || targetSelected;
  return false;
}

function duplicateSelectedRoutes(patch: Patch, selectedOriginalIds: Set<string>, idMap: Map<string, string>) {
  if (!Array.isArray(patch.routes)) return;
  const duplicates: PatchRoute[] = [];
  for (const route of patch.routes) {
    if (!shouldDuplicateRoute(route, selectedOriginalIds)) continue;
    const next = cloneRoute(route);
    next.id = uid("route");
    next.source = remapEndpoint(route.source, idMap);
    next.target = remapEndpoint(route.target, idMap);
    duplicates.push(next);
  }
  patch.routes.push(...duplicates);
}

export function duplicateSelectedModules(patch: Patch, selectedModuleIds: Iterable<string>): DuplicateSelectedModulesResult {
  const originals = selectedModulesInPlacementOrder(patch, selectedModuleIds);
  if (!originals.length) {
    return {
      duplicatedCount: 0,
      skippedCount: 0,
      idMap: new Map(),
      newIds: [],
      selection: clearModuleSelection(),
    };
  }

  const occupied = new Set(patch.modules.map((module) => gridPositionKey(getModuleGridPosition(module) ?? { x: 0, y: 0 })));
  const usedNames = new Set(patch.modules.map((module) => module.name));
  const selectedOriginalIds = new Set(originals.map((module) => module.id));
  const idMap = new Map<string, string>();
  const duplicates: Module[] = [];

  for (const original of originals) {
    const duplicate = cloneModule(original);
    duplicate.id = uid(modulePrefix(original));
    duplicate.name = makeUniqueCopyName(original.name, usedNames);
    setModuleGridPosition(duplicate, reserveNearbyPosition(original, occupied));
    idMap.set(original.id, duplicate.id);
    duplicates.push(duplicate);
  }

  for (const duplicate of duplicates) remapSoundRouting(duplicate, idMap);

  patch.modules.push(...duplicates);
  duplicateSelectedConnections(patch, selectedOriginalIds, idMap);
  duplicateSelectedRoutes(patch, selectedOriginalIds, idMap);

  const newIds = duplicates.map((module) => module.id);
  return {
    duplicatedCount: duplicates.length,
    skippedCount: originals.length - duplicates.length,
    idMap,
    newIds,
    selection: {
      selectedModuleIds: newIds,
      selectionAnchorId: newIds[0] ?? null,
      selectionMode: "replace",
    },
  };
}

