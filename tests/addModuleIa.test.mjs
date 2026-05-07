import assert from "node:assert/strict";
import test from "node:test";
import {
  ADD_MODULE_FAMILIES,
  getAddModuleFamily,
  getAddModuleRootKeyboardMetadata,
  getAddModuleSearchResults,
  getAddModuleSubtypeItems,
} from "../src/ui/AddModuleSlot.ts";
import {
  makeControl,
  makeSound,
  makeTrigger,
  makeVisual,
} from "../src/patch.ts";
import {
  createModuleFromModulePreset,
  loadModulePresetLibrary,
} from "../src/ui/persistence/modulePresetStore.ts";

function withMockStorage(run) {
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  try {
    return run();
  } finally {
    if (typeof original === "undefined") delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
}

function factoryRecords() {
  return withMockStorage(() => loadModulePresetLibrary());
}

function createModuleForPick(pick, index = 0) {
  if (pick === "drum" || pick === "tonal") return makeSound(pick, index);
  if (pick === "trigger") return makeTrigger(index);
  if (pick === "control-lfo") return makeControl("lfo", index);
  if (pick === "control-drift") return makeControl("drift", index);
  if (pick === "control-stepped") return makeControl("stepped", index);
  return makeVisual(pick, index);
}

test("add-module IA exposes expected family-first order", () => {
  assert.deepEqual(
    ADD_MODULE_FAMILIES.map((family) => ({
      id: family.id,
      code: family.code,
      defaultPick: family.defaultPick,
    })),
    [
      { id: "gen", code: "GEN", defaultPick: "trigger" },
      { id: "drum", code: "DRUM", defaultPick: "drum" },
      { id: "synth", code: "SYNTH", defaultPick: "tonal" },
      { id: "ctrl", code: "CTRL", defaultPick: "control-lfo" },
      { id: "vis", code: "VIS", defaultPick: "scope" },
    ],
  );
});

test("add-module family defaults preserve existing module creation mappings", () => {
  const created = ADD_MODULE_FAMILIES.map((family, index) =>
    createModuleForPick(family.defaultPick, index),
  );

  assert.deepEqual(
    created.map((module) => ({
      type: module.type,
      engine: module.engine,
      kind: module.kind ?? null,
    })),
    [
      { type: "trigger", engine: "trigger", kind: null },
      { type: "drum", engine: "drum", kind: null },
      { type: "tonal", engine: "synth", kind: null },
      { type: "control", engine: "control", kind: "lfo" },
      { type: "visual", engine: "visual", kind: "scope" },
    ],
  );
});

test("add-module control and visual subtypes still create supported variants", () => {
  assert.deepEqual(
    getAddModuleSubtypeItems("ctrl").map((item) => item.value),
    ["control-lfo", "control-drift", "control-stepped"],
  );
  assert.deepEqual(
    getAddModuleSubtypeItems("vis").map((item) => item.value),
    [
      "scope",
      "spectrum",
      "vectorscope",
      "spectral-depth",
      "flow",
      "ritual",
      "glitch",
      "cymat",
    ],
  );

  for (const item of getAddModuleSubtypeItems("ctrl")) {
    const module = createModuleForPick(item.value);
    assert.equal(module.type, "control");
    assert.equal(item.value, `control-${module.kind}`);
  }

  for (const item of getAddModuleSubtypeItems("vis")) {
    const module = createModuleForPick(item.value);
    assert.equal(module.type, "visual");
    assert.equal(module.kind, item.value);
  }
});

test("add-module subtype lookup is empty for direct-add families", () => {
  assert.equal(getAddModuleFamily("gen").defaultPick, "trigger");
  assert.deepEqual(getAddModuleSubtypeItems("gen"), []);
  assert.deepEqual(getAddModuleSubtypeItems("drum"), []);
  assert.deepEqual(getAddModuleSubtypeItems("synth"), []);
});

test("add-module root keyboard metadata explicitly marks subtype-capable families", () => {
  assert.deepEqual(getAddModuleRootKeyboardMetadata(), [
    { familyId: "gen", defaultPick: "trigger", opensSubtypes: false },
    { familyId: "drum", defaultPick: "drum", opensSubtypes: false },
    { familyId: "synth", defaultPick: "tonal", opensSubtypes: false },
    { familyId: "ctrl", defaultPick: "control-lfo", opensSubtypes: true },
    { familyId: "vis", defaultPick: "scope", opensSubtypes: true },
  ]);
});

test("add-module keyboard subtype intent is independent from visible family copy", () => {
  const originalCopy = ADD_MODULE_FAMILIES.map((family) => ({
    family,
    code: family.code,
    label: family.label,
    desc: family.desc,
  }));

  try {
    for (const { family } of originalCopy) {
      family.code = `Copy ${family.id}`;
      family.label = `Visible ${family.id}`;
      family.desc = `Description ${family.id}`;
    }

    assert.deepEqual(
      getAddModuleRootKeyboardMetadata().map(({ familyId, opensSubtypes }) => ({
        familyId,
        opensSubtypes,
      })),
      [
        { familyId: "gen", opensSubtypes: false },
        { familyId: "drum", opensSubtypes: false },
        { familyId: "synth", opensSubtypes: false },
        { familyId: "ctrl", opensSubtypes: true },
        { familyId: "vis", opensSubtypes: true },
      ],
    );
  } finally {
    for (const { family, code, label, desc } of originalCopy) {
      family.code = code;
      family.label = label;
      family.desc = desc;
    }
  }
});

test("add-module quick search finds generator family by code and label", () => {
  const results = getAddModuleSearchResults("gen");

  assert.deepEqual(
    results.map((result) => ({
      id: result.family.id,
      code: result.family.code,
      label: result.family.label,
      familyMatches: result.familyMatches,
    })),
    [{ id: "gen", code: "GEN", label: "Generator", familyMatches: true }],
  );
});

test("add-module quick search finds control LFO subtype under CTRL", () => {
  const results = getAddModuleSearchResults("lfo");

  assert.deepEqual(
    results.map((result) => ({
      id: result.family.id,
      code: result.family.code,
      subtypeLabels: result.matchedSubtypes.map((item) => item.label),
      subtypeValues: result.matchedSubtypes.map((item) => item.value),
    })),
    [
      {
        id: "ctrl",
        code: "CTRL",
        subtypeLabels: ["LFO"],
        subtypeValues: ["control-lfo"],
      },
    ],
  );
});

test("add-module quick search finds visual Scope subtype under VIS", () => {
  const results = getAddModuleSearchResults("scope");
  const visualResult = results.find((result) => result.family.id === "vis");

  assert.equal(visualResult?.family.code, "VIS");
  assert.ok(
    visualResult?.matchedSubtypes.some(
      (item) => item.label === "Scope" && item.value === "scope",
    ),
  );
});

test("add-module empty quick search preserves default family list", () => {
  assert.deepEqual(
    getAddModuleSearchResults("").map((result) => result.family.id),
    ["gen", "drum", "synth", "ctrl", "vis"],
  );
});

test("add-module quick search remains independent from visible keyboard metadata copy", () => {
  const originalCopy = ADD_MODULE_FAMILIES.map((family) => ({
    family,
    code: family.code,
    label: family.label,
    desc: family.desc,
  }));

  try {
    for (const { family } of originalCopy) {
      family.code = `Renamed ${family.id}`;
      family.label = `Searchable ${family.id}`;
      family.desc = `Changed ${family.id}`;
    }

    assert.deepEqual(
      getAddModuleSearchResults("lfo").map((result) => ({
        familyId: result.family.id,
        subtypeValues: result.matchedSubtypes.map((item) => item.value),
      })),
      [{ familyId: "ctrl", subtypeValues: ["control-lfo"] }],
    );
    assert.deepEqual(
      getAddModuleRootKeyboardMetadata().map(({ familyId, opensSubtypes }) => ({
        familyId,
        opensSubtypes,
      })),
      [
        { familyId: "gen", opensSubtypes: false },
        { familyId: "drum", opensSubtypes: false },
        { familyId: "synth", opensSubtypes: false },
        { familyId: "ctrl", opensSubtypes: true },
        { familyId: "vis", opensSubtypes: true },
      ],
    );
  } finally {
    for (const { family, code, label, desc } of originalCopy) {
      family.code = code;
      family.label = label;
      family.desc = desc;
    }
  }
});

test("add-module empty quick search does not dump factory presets", () => {
  const results = getAddModuleSearchResults("", factoryRecords());

  assert.deepEqual(
    results.map((result) => [result.family.id, result.matchedFactoryPresets.length]),
    [
      ["gen", 0],
      ["drum", 0],
      ["synth", 0],
      ["ctrl", 0],
      ["vis", 0],
    ],
  );
});

test("add-module quick search finds factory preset by stable code", () => {
  const results = getAddModuleSearchResults("DRUM014", factoryRecords());
  const drumResult = results.find((result) => result.family.id === "drum");

  assert.equal(drumResult?.family.code, "DRUM");
  assert.deepEqual(
    drumResult?.matchedFactoryPresets.map((record) => ({ code: record.code, name: record.name, source: record.source })),
    [{ code: "DRUM014", name: "Closed Hat", source: "factory" }],
  );
});

test("add-module quick search finds factory preset by descriptive name", () => {
  const results = getAddModuleSearchResults("sub sine bass", factoryRecords());
  const synthResult = results.find((result) => result.family.id === "synth");

  assert.equal(synthResult?.family.code, "SYNTH");
  assert.deepEqual(
    synthResult?.matchedFactoryPresets.map((record) => ({ code: record.code, name: record.name, family: record.family })),
    [{ code: "SYNTH013", name: "Sub Sine Bass", family: "tonal" }],
  );
});

test("factory preset insertion creates a compatible module with preset metadata", () => {
  const records = factoryRecords();
  const closedHat = records.find((record) => record.code === "DRUM014");
  assert.ok(closedHat);

  const inserted = createModuleFromModulePreset(closedHat, 3);

  assert.ok(inserted);
  assert.equal(inserted.type, "drum");
  assert.equal(inserted.engine, "drum");
  assert.equal(inserted.name, "Drum 4");
  assert.equal(inserted.presetName, "Closed Hat");
  assert.equal(inserted.presetMeta.modulePresetId, closedHat.id);
  assert.equal(inserted.presetMeta.modulePresetSource, "factory");
  assert.equal(inserted.presetMeta.modulePresetCode, "DRUM014");
  assert.equal(inserted.decay, closedHat.state.decay);
});

test("factory preset insertion rejects incompatible subtype records", () => {
  const badVisualPreset = {
    id: "factory-visual-bad",
    code: "VIS999",
    name: "Bad Visual",
    family: "visual",
    subtype: "not-a-visual",
    state: { enabled: true, kind: "not-a-visual", fftSize: 2048 },
    source: "factory",
    createdAt: 1,
    updatedAt: 1,
  };

  assert.equal(createModuleFromModulePreset(badVisualPreset), null);
});
