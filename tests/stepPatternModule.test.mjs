import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSync } from "esbuild";

const tempDir = mkdtempSync(join(tmpdir(), "gridi-step-test-"));
const outfile = join(tempDir, "stepPatternModule.bundle.mjs");

try {
  buildSync({
    entryPoints: ["src/engine/pattern/stepPatternModule.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "es2022",
  });

  const mod = await import(`file://${outfile}`);
  const { genStepPattern } = mod;

  const params = { seed: 123456, length: 32, density: 0.42 };
  const a = genStepPattern(params);
  const b = genStepPattern(params);

  assert.deepEqual(Array.from(a), Array.from(b));
  console.log("stepPatternModule deterministic test passed");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
