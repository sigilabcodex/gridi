# Bank / Preset / Session System

## Terminology

GRIDI now uses a **Preset Session** model.

- **Preset**: A named snapshot of one full `Patch` (all modules + routing + transport state).
- **Session**: A local collection of presets, plus which preset is currently selected.
- **Current patch**: The live editable state loaded from the selected preset.
- **Unsaved changes**: Edits in the current patch that have not yet been explicitly saved to the selected preset (unless autosave is enabled).

Legacy term **bank** is treated as migration-only language from older versions.

## Why this replaces the old bank model (audit summary)

Previous behavior had these usability issues:

1. Fixed 4-bank indexing (`Bank 1/4`, `Bank 2/4`, etc.) gave no semantic meaning.
2. No naming or metadata made recall difficult during performance.
3. Prev/next switching increased accidental load/overwrite risk.
4. Save/load behavior was implicit and hard to reason about.
5. Import/export was hidden inside settings textarea workflows and mixed patch-vs-banks formats.

## Data model overview

Storage key: `gridi.presets.v0_33`.

```ts
{
  version: "0.33",
  selectedPresetId: string,
  presets: [
    {
      id: string,
      name: string,
      patch: Patch,
      createdAt: number,
      updatedAt: number
    }
  ]
}
```

### Compatibility / migration

- On startup, GRIDI first attempts to load `gridi.presets.v0_33`.
- If missing/invalid, it migrates legacy `gridi.state.v0_30` bank payload into named presets (`Bank 1`, `Bank 2`, etc.).
- If both are missing/invalid, a default starter preset is created.

## Save / load behavior

### Save

- Explicit save action is available from header (`Save` / `Save*`) and Preset Manager.
- Dirty indicator (`*`) appears when the live patch differs from saved selected preset.
- `Ctrl/Cmd+S` saves the current patch to selected preset.
- If app setting `data.autosave` is enabled, edits update selected preset automatically.

### Load

- Loading another preset is intentional (dropdown or Preset Manager `Load`).
- If unsaved changes exist and autosave is off, GRIDI asks confirmation before loading another preset.

### Safety behaviors

- Deleting a preset requires confirmation.
- At least one preset must remain.

## Import / export behavior

### Export

- **Export Current**: writes a single-preset JSON file.
- **Export Session**: writes entire session JSON with all presets.

### Import

- **Import File** accepts either:
  - single preset payload, or
  - session payload with `presets` array.
- Imported preset ids that conflict with local ids are remapped.
- Imported presets are merged into current local session; first imported preset is selected.

## Module-era preservation guarantees

A preset stores the full `Patch` object. That includes:

- Trigger modules
- Drum modules
- Tonal modules
- Visual modules
- Module relationships and routing (e.g. trigger assignments + connections)

Tests validate relationship persistence through export/import roundtrip.

## Current limitations

- Still local-first browser storage only (no cloud sync).
- No preset folders/tags yet.
- No partial merge (import is additive at preset granularity).
- No binary/media asset packaging in preset files.
