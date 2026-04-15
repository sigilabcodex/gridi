import type { Connection, Module, Patch } from "../patch";

export type RouteValidation = {
  validConnections: Connection[];
  warnings: string[];
};

function isAudioSourceModule(module: Module) {
  return module.type === "drum" || module.type === "tonal" || module.type === "effect";
}

function isAudioProcessingTarget(module: Module) {
  return module.type === "effect";
}

export function validateConnections(patch: Patch): RouteValidation {
  const modulesById = new Map(patch.modules.map((m) => [m.id, m]));
  const validConnections: Connection[] = [];
  const warnings: string[] = [];

  for (const conn of patch.connections) {
    if (!conn.enabled) continue;

    const source = modulesById.get(conn.fromModuleId);
    if (!source) {
      warnings.push(`Connection ${conn.id} has unknown source module ${conn.fromModuleId}`);
      continue;
    }

    if (!isAudioSourceModule(source)) {
      warnings.push(`Connection ${conn.id} source ${conn.fromModuleId} (${source.type}) is not an audio output module`);
      continue;
    }

    if (conn.fromPort !== "main") {
      warnings.push(`Connection ${conn.id} uses unsupported source port ${conn.fromPort}`);
      continue;
    }

    if (conn.to.type === "module") {
      if (!conn.to.id) {
        warnings.push(`Connection ${conn.id} has missing module target id`);
        continue;
      }
      const target = modulesById.get(conn.to.id);
      if (!target) {
        warnings.push(`Connection ${conn.id} has unknown target module ${conn.to.id}`);
        continue;
      }
      if (!isAudioProcessingTarget(target)) {
        warnings.push(`Connection ${conn.id} target ${conn.to.id} (${target.type}) is not an audio input module`);
        continue;
      }
      validConnections.push(conn);
      continue;
    }

    if (conn.to.type === "master") {
      validConnections.push(conn);
      continue;
    }

    warnings.push(`Connection ${conn.id} targets bus ${conn.to.id ?? "(missing)"}, but bus routing is not currently supported at runtime`);
  }

  return { validConnections, warnings };
}

export function collectVoiceRoutes(voiceId: string, connections: Connection[]): Connection[] {
  return connections.filter((c) => c.fromModuleId === voiceId && c.fromPort === "main");
}
