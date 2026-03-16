# Sound Modules: Drum vs Tonal

## Purpose

GRIDI now has two dedicated sound module families:

- **DrumSynthModule** (`type: "drum"`): percussive one-shot voice for kick/snare/hat-like synthesized hits.
- **TonalSynthModule** (`type: "tonal"`): melodic or drone-oriented voice with ADSR and oscillator/filter shaping.

Both module families can share trigger/routing infrastructure, but they no longer share the same public parameter model.

## DrumSynthModule parameters

- `amp`: output level.
- `pan`: stereo placement.
- `basePitch`: fundamental body frequency.
- `decay`: one-shot decay time contour.
- `transient`: transient/click intensity.
- `snap`: short top-end impulse amount.
- `noise`: noise layer level.
- `bodyTone`: body oscillator color (sine-ish to brighter body).
- `pitchEnvAmt`: pitch envelope depth.
- `pitchEnvDecay`: pitch envelope decay speed.
- `tone`: overall brightness/filter tilt.

### Current drum synthesis model

- Body oscillator with downward pitch envelope.
- Dedicated noise burst branch through bandpass shaping.
- Short click oscillator for attack articulation.
- Fast exponential decays to enforce percussive behavior.

## TonalSynthModule parameters

- `amp`: output level.
- `pan`: stereo placement.
- `waveform`: oscillator shape morph selector.
- `coarseTune`: semitone pitch offset.
- `fineTune`: fine pitch offset.
- `attack`: ADSR attack.
- `decay`: ADSR decay.
- `sustain`: ADSR sustain level.
- `release`: ADSR release.
- `cutoff`: low-pass filter cutoff macro.
- `resonance`: filter Q amount.
- `glide`: pitch glide/portamento response.
- `modDepth`: simple modulation depth.
- `modRate`: simple modulation rate.

### Current tonal synthesis model

- Two oscillators with slight detune for width.
- Low-pass filter with resonance control.
- ADSR-style envelope supporting short plucks and sustained tails.
- LFO pitch modulation for basic movement.

## Current limitations

- Drum module is still a generic synthesized percussion voice (not multi-engine drum models yet).
- Tonal module is monophonic per trigger event in current behavior.
- No dedicated modulation matrix or per-parameter envelopes.
- No velocity layering/sample components.

## Future extension ideas

- Drum: add model switch (kick/snare/hat algorithms), transient EQ, and distortion stage.
- Tonal: add explicit note input, unison spread, and filter envelope amount control.
- Shared: reusable envelope primitives and richer modulation sources while keeping module-specific parameter surfaces.
