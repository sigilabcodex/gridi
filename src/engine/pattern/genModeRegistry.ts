import type { Mode } from "../../patch";

export type GenModeFamily = "structural" | "field" | "conceptual" | "asset";
export type GenModeStage = "demo" | "refine" | "prototype" | "defer";

export type GenModeMeta = {
  mode: Mode;
  fullLabel: string;
  shortLabel: string;
  family: GenModeFamily;
  stage: GenModeStage;
};

export const GEN_MODE_REGISTRY: Record<Mode, GenModeMeta> = {
  "step-sequencer": { mode: "step-sequencer", fullLabel: "Step Sequencer", shortLabel: "SSEQ", family: "structural", stage: "demo" },
  "euclidean": { mode: "euclidean", fullLabel: "Euclidean", shortLabel: "EUC", family: "structural", stage: "demo" },
  "cellular-automata": { mode: "cellular-automata", fullLabel: "Cellular Automata", shortLabel: "CA", family: "structural", stage: "demo" },
  "hybrid": { mode: "hybrid", fullLabel: "Hybrid", shortLabel: "HYB", family: "structural", stage: "demo" },
  "gear": { mode: "gear", fullLabel: "GEAR", shortLabel: "GEAR", family: "structural", stage: "refine" },
  "radar": { mode: "radar", fullLabel: "RADAR", shortLabel: "RADAR", family: "field", stage: "refine" },
  "fractal": { mode: "fractal", fullLabel: "Fractal", shortLabel: "FRACT", family: "conceptual", stage: "prototype" },
  "non-euclidean": { mode: "non-euclidean", fullLabel: "Non-Euclidean", shortLabel: "NEUC", family: "conceptual", stage: "prototype" },
  "markov-chains": { mode: "markov-chains", fullLabel: "Markov Chains", shortLabel: "MARKOV", family: "conceptual", stage: "prototype" },
  "l-systems": { mode: "l-systems", fullLabel: "L-Systems", shortLabel: "LSYS", family: "conceptual", stage: "prototype" },
  "xronomorph": { mode: "xronomorph", fullLabel: "XronoMorph", shortLabel: "XRM", family: "conceptual", stage: "prototype" },
  "genetic-algorithms": { mode: "genetic-algorithms", fullLabel: "Genetic Algorithms", shortLabel: "GA", family: "conceptual", stage: "prototype" },
  "one-over-f-noise": { mode: "one-over-f-noise", fullLabel: "1/f Noise", shortLabel: "1/F", family: "field", stage: "prototype" },
};

export const GEN_MODES = Object.keys(GEN_MODE_REGISTRY) as Mode[];

export function getGenModeMeta(mode: Mode): GenModeMeta {
  return GEN_MODE_REGISTRY[mode];
}
