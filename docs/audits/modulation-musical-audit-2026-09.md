# Musical modulation audit: DRUM, SYNTH, and GEN

Date: 2026-09-27  
Scope: modulation target choice and musical scaling only. This audit does not change DSP behavior, patch schema, or the one-source-per-parameter rule.

## Capability terms

- **Assignable** means present in the CTRL target catalog. The choice can be stored as a legacy map and represented by a typed route.
- **Inspector** means an assignment/declaration for that parameter gets a row in Routing Inspector. The inspector lists routed parameters, not every available target.
- **Runtime** means the audio engine or scheduler samples that value from CTRL. It describes current behavior, which is sampled when an event/voice is created; CTRL does not continuously update active audio voices.
- **Safe musical** and **extended** are proposed future modulation depths around the saved parameter value, not current ranges. Clamp the final value to its legal parameter range. Ranges below are suggestions for a future normalized bipolar modulation amount.

Current runtime consumption is narrow: `trigger.density` in the scheduler, `drum.basePitch` in the drum voice start path, and `tonal.cutoff` in the synth voice start path. Density and Drum pitch resolve valid typed routes before legacy fallback. Synth cutoff still reads the legacy target-owned map. Every other catalog target is assignable and inspectable but has no DSP/scheduler modulation consumer.

## DRUM

All named rows below are assignable and inspector-visible when routed, except channel/lane selection. Only `basePitch` is currently consumed by runtime, sampled at voice start. “UI key” identifies the actual stored field because some faceplate labels are aliases.

| Target / UI key | Current runtime | Should become modulable | Safe musical range | Extended range | Suggested mapping | Musical risk / priority |
| --- | --- | --- | --- | --- | --- | --- |
| Pitch / `basePitch` | Yes; resolver-backed typed precedence with legacy fallback, sampled for new drum voices | Implemented | Typed route: ±7 semitones around saved pitch; legacy-only curve remains compatible | Future extended mode: ±24 semitones, clamped | Typed route converts normalized control to semitone offset in log-frequency/MIDI space | Low–medium; large jumps change drum identity. Extended range remains unimplemented. |
| Decay / `decay` | No CTRL consumer | Yes | 0.75–1.35× saved decay | 0.25–3×, with sensible time floor/ceiling | Multiplicative/log-time scaling; sample per hit | Low; changes tail and overlap. **P2** |
| Attack / `attack` | No | Later | ±5 ms around saved value, clamped to 1–51 ms | Full existing 1–51 ms span | Additive milliseconds, with floor and ceiling | Medium; large attack softens or removes the transient. **P3** |
| Tone / `tone` | No | Yes | About ±1 octave of filter frequency around saved tone | About ±3 octaves, bounded by Nyquist | Map to log frequency, not linear knob position | Low–medium; extreme values can thin or darken the hit. **P2** |
| Drive / `bodyTone` (Main label `Drive`, catalog label `Body tone`) | No | Later, after separating coupled behavior | ±0.1 normalized around saved value | ±0.35 normalized | Smooth bounded amount; do not cross the body oscillator's 0.55 sine/triangle switch in safe mode | Medium; this field also selects body waveform and sets drive. **P3** |
| Noise / `noise` | No | Yes, after a real balance mapping exists | ±0.15 normalized around saved value | ±0.5 normalized | Prefer equal-power body/noise balance; current noise is an independent branch level, so avoid silently treating it as a true crossfade | Medium; can radically change perceived source and loudness. **P3** |
| Snap / `snap` | No | Later | ±0.1 normalized | ±0.4 normalized | Bounded additive amount; smooth if applied during active sound | Medium; click frequency/Q and transient level move together. **P4** |
| Bend / `pitchEnvAmt` | No | Yes, after pitch range work | ±0.15 normalized | ±0.5 normalized | Bounded envelope-depth scaling; per hit | Medium; can shift attack pitch dramatically. **P3** |
| Level / `amp` | No | Not in first modulation set | ±1 dB around saved level | Up to ±6 dB with headroom protection | Gain in dB, then clamp/limit at voice or bus level | High; many CTRL-driven voices can reduce headroom. **P5** |
| Pan / `panBias` (Main label `Pan`) | No | Later | ±0.15 around saved pan | Full -1..1 | Additive pan with clamp; consider lane role and mono compatibility | Medium; fast pan can distract and collapse in mono. **P4** |
| Width / `stereoWidth` | No | No for now | — | — | Current engine scales mono panning; it does not create stereo width | Misleading target: modulation cannot provide the label's expected stereo effect. **Keep visible-only** |
| Dynamics / `comp`, `compThreshold`, `compRatio`, `boost` | No | Experimental only, after level metering | Small excursions around saved values | Existing normalized ranges | Slow stepped changes or carefully bounded smoothed gain/threshold | High; level pumping and transient loss. **Keep visible-only for now** |
| `driveColor`, `transient`, bend decay fields | No | Not until first-class UI semantics and tests exist | — | — | These are not current catalog targets; transient is not event-velocity response | Risk of hidden/compound behavior. **Do not add yet** |
| Channel / `drumChannel` and boost focus / `boostTarget` | No; channel changes scheduler stream/lane behavior, focus is an enum | No | — | — | Keep discrete routing/focus choices under direct user control | Structural/discrete changes can reroute events or switch branches. **Not modulable** |

## SYNTH

All named rows below are assignable and inspector-visible when routed. Only `cutoff` is currently consumed by audio, from the legacy map at voice creation. Most envelope and oscillator parameters are read when a new voice is created; they are not continuous automation of existing voices.

| Target / UI key | Current runtime | Should become modulable | Safe musical range | Extended range | Suggested mapping | Musical risk / priority |
| --- | --- | --- | --- | --- | --- | --- |
| Cutoff / `cutoff` | Yes, legacy only; new voice | Yes; consolidate typed resolver after Drum pitch | ±1 octave around saved cutoff | ±4 octaves, bounded to useful audio range/Nyquist | Log-frequency/octave mapping; soften modulation near extremes | Low–medium; classic timbral motion. **P2 after DRUM pitch** |
| Resonance / `resonance` | No | Yes, after cutoff | Keep Q roughly 0.5–4 | Q up to roughly 10, clamp output/headroom | Map to Q or a perceptual curve; reduce safe depth near high saved Q | Medium–high; peaks can dominate and clip. **P3** |
| Attack / `attack` | No CTRL consumer | Yes, per-note first | ±20% of current attack, with 2 ms–250 ms bounds | Full current range | Multiplicative/log-time mapping | Low–medium; changes articulation, but only for new notes. **P3** |
| Decay / `decay` | No | Yes, per-note first | ±20% of saved decay | Full current range | Multiplicative/log-time mapping | Low–medium; changes contour on new notes. **P3** |
| Sustain / `sustain` | No | Yes, per-note first | ±0.1 normalized | ±0.35 normalized | Bounded linear amplitude ratio, preferably dB-aware near low values | Medium; alters held note level and release start. **P3** |
| Release / `release` | No | Yes, after note-off lifecycle is verified | 0.75–1.35× saved release | 0.25–3×, with maximum voice lifetime | Multiplicative/log-time mapping; capture at note-off or smooth active MIDI voices intentionally | Medium; long tails raise polyphony and overlap. **P4** |
| Wave / `waveform` | No | Experimental stepped target only | No continuous safe range | Four stepped oscillator types | Quantized regions with hysteresis, or crossfade oscillator pairs; never imply smooth morph with current oscillator selection | High; jumps alter harmonic content/click risk. **Keep visible-only for now** |
| Coarse pitch / `coarseTune` | No | Yes, after base-pitch and note tracking semantics | ±2 semitones | ±12 semitones | Semitone quantization or a musical pitch ratio | Medium; can conflict with incoming notes and module-index-derived base pitch. **P4** |
| Fine pitch / `fineTune` | No | Yes, as vibrato/detune only after alias labels are fixed | ±25 cents | ±100 cents | Convert to cents then pitch ratio; slew to avoid zippering | Medium; current tuning behavior is context-dependent and the UI also aliases this field as Drift/Phase. **P4** |
| LFO depth/rate / `modDepth`, `modRate` (UI labels `Drive`, `FM`) | No external CTRL consumer | Later, after accurate naming | Small vibrato depth/rate variation | Larger pitch modulation, still below audio-rate claims | Map depth to cents and rate logarithmically; label as pitch LFO, not FM/drive | Medium; can become seasick or detuned. **P4** |
| Level / `amp` | No CTRL consumer | Not in first modulation set | ±1 dB | Up to ±6 dB with headroom protection | Gain in dB with polyphony-aware limit | High; affects every active/new voice level and headroom. **P5** |
| Pan / `pan` | No CTRL consumer | Later | ±0.15 | Full -1..1 | Additive with clamp; consider mono compatibility | Medium. **P4** |
| Glide / `glide` (some UI aliases call it `Spread`/`Width`) | No CTRL consumer | No, until portamento/voice reuse semantics are explicit | — | — | Keep direct/manual for now; current voice creation does not provide dependable legato spread | UI implies stereo/width or glide semantics that do not consistently match. **Visible-only** |

## GEN / Trigger comparison

Current modulation UI assignment and inspector visibility follow the GEN catalog. Runtime uses only `density`; CTRL density is sampled by the scheduler and affects generated pattern density. The current full-depth offset is broad (`(sample - 0.5) × 0.85` in normalized density units).

| Target | Assignable / inspector | Current runtime | Recommendation after density | Safe / extended behavior | Risk / priority |
| --- | --- | --- | --- | --- | --- |
| Density | Yes / yes when routed | Scheduler; typed valid source wins, legacy fallback | Keep; consider reducing default effective depth to ±0.15 normalized | Safe ±0.15; extended ±0.4; linear around saved value, clamp 0..1 | Large changes alter hit count. Current ±0.425 is better classified as extended. |
| Drop | Yes / yes when routed | No | Candidate after voice timbre targets, if probability is sampled deterministically per event/window | Safe ±0.1 probability; extended ±0.35; additive probability points | Medium; can erase a pattern at high depth. **P4** |
| Length / subdivision | Yes / yes when routed | No | Keep visible-only | No continuous safe range; if ever supported use quantized, bar-boundary updates | High; changes grid and event phase. **Do not add yet** |
| Determinism, gravity, variation/weird, accent, Euclid rotate, CA rule/init | Yes / yes when routed | No CTRL consumer | Keep visible-only until mode-by-mode semantics are defined | Mode-specific, stepped or bounded policies only | High and mode-dependent; may alter pattern identity/discrete state. **Do not add yet** |

## Recommendation and implementation order

1. **Implemented in this pass: `drum.basePitch`, resolver-backed.** Valid typed routes win conflicts and use safe ±7-semitone scaling. Stale or absent typed routes fall back to legacy. Legacy-only patches retain the previous broad normalized mapping exactly so their playback does not change.
2. **Then `drum.decay`.** It is a high-value one-shot articulation control with predictable per-hit behavior. Use bounded multiplicative time scaling and test repeated-hit tails.
3. **Then `tonal.cutoff` resolver parity and log-frequency scaling.** The consumer already exists but current normalized linear offset sweeps a very broad frequency range.
4. Add resonance and selected envelope controls after voice lifecycle tests cover pattern notes and MIDI note-off behavior.
5. Treat oscillator shape, structural routing, mixer/level, compression, and unsupported GEN structural controls as visible-only or experimental until they have an explicit musical interaction model.

The future extended range belongs at the typed-source scaling point in `src/engine/drumPitchModulation.ts`: keep the resolver and source precedence unchanged, then select the semitone span (safe ±7 by default; extended up to ±24) before converting to a frequency ratio. This is where a future range preference should plug in, without changing serialized routing fields. Legacy-only mapping must remain on its compatibility branch until a deliberate migration/range policy exists.

DRUM pitch CTRL affects newly triggered voices only. The engine samples the CTRL value when it creates the oscillator and does not retune active Drum voices afterward. Continuous active-voice pitch movement requires a separate AudioParam tracking/smoothing design.

One source per parameter remains the rule. Safe behavior should be the default; an explicit extended/experimental mode may increase depth, but must keep bounds, headroom, and voice lifetime under control. No source blending or multi-source merge is recommended.

## UI wording recommendations

- Use “Modulation range: Safe / Extended” or a compact “Range: Safe / Experimental” control when range selection is designed; avoid presenting raw 0–1 depth as musical intent.
- Rename SYNTH `Drive` to “Pitch LFO depth” and `FM` to “Pitch LFO rate” until an actual drive stage or audio-rate FM exists.
- Rename SYNTH `Spread`/`Width` where it writes `glide`; reserve “Spread” and “Width” for real stereo/unison controls.
- Rename DRUM `Drive` to “Body/drive” or split those behaviors before exposing modulation. `Body tone` is the current routing-catalog label.
- Describe drum channel as “Lane/Channel” with an explicit routing hint; do not list it as a modulation target.
- Mark catalog assignments that lack a DSP consumer as “Routing only” or “Not active in sound yet” in the target picker/inspector.
- Inspector should distinguish “Assigned” from “Affects sound now”; route existence alone does not promise runtime modulation.

## Test coverage gaps found

- Existing tests cover resolver states, single-owner replacement, schema-version stability, scheduler density playback, and sound module defaults/channel normalization.
- Audio-runtime helper assertions now prove DRUM `basePitch` legacy compatibility and typed semitone range. There are still no numeric response-curve assertions for SYNTH `cutoff`.
- No regression tests cover current legacy-only audio modulation playback, disabled/missing CTRL behavior, CTRL sampling only at voice creation, or typed audio routes remaining inactive in DSP.
- There are no modulation tests for decay, tone, noise/body balance, synth resonance/envelopes/pitch, range clamping, active MIDI note lifecycle, headroom, or repeated-hit/retrigger behavior.
- The catalog contains controls whose UI labels overstate or alias the underlying field. Add catalog-to-DSP semantic tests before expanding runtime targets.
