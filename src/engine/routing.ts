import type { Connection, Patch } from "../patch";

export type RouteValidation = {
  validConnections: Connection[];
  warnings: string[];
};

export function validateConnections(patch: Patch): RouteValidation {
  const moduleIds = new Set(patch.modules.map((m) => m.id));
  const busIds = new Set(patch.buses.map((b) => b.id));
  const validConnections: Connection[] = [];
  const warnings: string[] = [];

  for (const conn of patch.connections) {
    if (!conn.enabled) continue;
    if (!moduleIds.has(conn.fromModuleId)) {
      warnings.push(`Connection ${conn.id} has unknown source module ${conn.fromModuleId}`);
      continue;
    }

    if (conn.to.type === "module") {
      if (!conn.to.id || !moduleIds.has(conn.to.id)) {
        warnings.push(`Connection ${conn.id} has unknown target module ${conn.to.id ?? "(missing)"}`);
        continue;
      }
    } else if (conn.to.type === "bus") {
      if (!conn.to.id || !busIds.has(conn.to.id)) {
        warnings.push(`Connection ${conn.id} has unknown bus ${conn.to.id ?? "(missing)"}`);
        continue;
      }
    }

    validConnections.push(conn);
  }

  return { validConnections, warnings };
}

export function collectVoiceRoutes(voiceId: string, connections: Connection[]): Connection[] {
  return connections.filter((c) => c.fromModuleId === voiceId && c.fromPort === "main");
}
