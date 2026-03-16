# GRIDI UI Design: Module-Centric Interface

## GUI philosophy

GRIDI now presents itself as a modular generative instrument, not a voice rack with sequencing embedded everywhere.

Core principles:

- **Module identity first**: Trigger, Drum, Tonal, and Visual cards use distinct headers, badges, colors, and control group names.
- **Main controls first**: the most performance-critical controls are always visible in the main panel.
- **Advanced panels second**: tabs now expose secondary functionality like connections, settings, and MIDI placeholders.
- **Calm routing clarity**: relationships are shown through connection badges, module IDs, and explicit trigger-source selectors.
- **Family-based composition**: the Add Module card is structured by module family, with future expansion space.

## Module card anatomy

Each module card follows the same high-level anatomy:

1. **Header**
   - Type badge (family)
   - Module type label
   - Name
   - Short ID reference
   - On/Off + Delete actions
2. **Relationship strip**
   - Labeled connection indicators (source/role/mode)
3. **Main control area**
   - Frequently used performance controls grouped by intent
4. **Advanced tabs**
   - Connections / Trigger View / Settings / MIDI (where applicable)

## Main controls vs advanced tabs

### Trigger modules
Main panel emphasizes event generation:
- Mode
- Seed
- Density
- Determinism
- Gravity
- Weirdness
- Drop probability
- Subdivision
- Length
- Pattern preview

Advanced tabs:
- Trigger View
- Connections
- Settings (rotation and CA controls)

### Drum synth modules
Main panel groups percussive controls by role:
- Amplitude
- Pitch / Body
- Decay
- Transient / Click
- Noise / Texture

Advanced tabs:
- Connections (trigger source)
- MIDI (placeholder)
- Settings (placeholder)

### Tonal synth modules
Main panel groups melodic and drone-friendly controls:
- Amplitude / Envelope
- Waveform / Oscillator
- Pitch / Tuning
- Brightness / Filter

Advanced tabs:
- Connections (trigger source)
- MIDI (placeholder)
- Settings (placeholder)

### Visual modules
Main panel prioritizes visualization canvas output.
Controls remain minimal and secondary to output visibility.

## Connection indicators (no cables)

Routing clarity is provided by:

- **Connection pills** in each header section (e.g., role, source, mode)
- **Module ID references** displayed in card headers
- **Explicit trigger-source selector** in synth connection tabs
- **Sectioned grid layout** separating trigger, synth, visual, and add-module zones

This keeps relationships visible without introducing patch-cable spaghetti.

## Add Module design guidelines

The Add Module card now works as a family browser:

- Trigger
- Drum
- Tonal
- Visual
- Future placeholder: Algorithm / Livecoding

Visual modules open a focused second step (Scope / Spectrum), then can return to family view.

## Future module guidelines

When adding new module families:

1. Define a clear family badge and color identity.
2. Provide a concise module role label in header.
3. Keep performance controls in the main panel.
4. Move optional/configuration-heavy controls to tabs.
5. Expose relationships via indicators and selectors, not cables.
6. Preserve responsive card behavior in the shared grid.
