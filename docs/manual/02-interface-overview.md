# 02. Interface Overview

GRIDI's interface is built around a compact global control area and a modular workspace grid. The details may continue to be refined, but the main areas are consistent.

## Global/header area

The header is the compact top-level control strip. It is where you will usually find global actions such as:

- transport controls such as play/stop;
- tempo and master/output status;
- session or preset actions;
- routing overview access;
- MIDI status and input selection when supported by the browser/device;
- other utilities that affect the whole instrument.

The header is meant to stay light. GRIDI avoids turning the top of the app into a large mixer or settings page.

## Workspace grid

The main area is a grid-based workspace. Modules sit in fixed-size cells so the patch remains visually stable while you perform.

The workspace is for building a small modular instrument:

- add modules into empty cells;
- arrange modules by family or musical role;
- connect generators, sound modules, controls, and visual tools;
- keep the patch visible while playing.

## Module cards

Each module appears as a card or faceplate. A typical module card includes:

- a compact identity/header area showing what the module is;
- a main display or behavior surface;
- performance controls;
- tabs for different work areas;
- a small status/footer area where relevant.

Module cards are intentionally compact. GRIDI favors playable surfaces over long forms and large inspectors.

## Tabs

Tabs divide each module into practical areas. Current user-facing language centers on:

- **Main** for the most important performance controls;
- **Fine-tune** for deeper shaping that is still module-local;
- **Routing** for connections to or from the module.

Some older or internal documentation may still mention advanced/settings language, but the user-facing direction is compact Main, Fine-tune, and Routing surfaces.

## Add slots

Empty grid cells act as add slots. Use them to add modules where you want them in the workspace.

In this version, add and move interactions may still receive refinement, but the practical idea is simple: empty cells are invitations to expand the instrument locally rather than through a detached browser panel.

## Transport

The transport starts and stops musical time. A GEN module can exist and be routed, but it will not drive playback until the transport is running and the audio engine is active.

If modulation is present, it is also transport-aware: movement is meant to happen when GRIDI is actually running.

## Routing at a high level

Routing tells GRIDI what listens to what. Common examples:

- GEN event route to a Drum module;
- GEN event route to a Synth module;
- Control modulation route to a parameter;
- MIDI input route to a Synth module;
- audio routes toward output/master behavior.

Routing is still being refined, especially around editing workflows and visibility. Current GRIDI intentionally avoids a large DAW-style cable matrix; it keeps routing close to modules and the global Routing overview.
