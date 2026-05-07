# 04. GEN Modes

GEN modes are different ways for a GEN module to generate timed events. They are not separate instruments and they do not make sound on their own. A GEN mode shapes when events happen, how dense they are, how stable or variable they feel, and how they respond to mode-specific controls.

To hear a GEN mode, route the GEN module to a Drum or Synth module and start playback.

## Maturity and display honesty

Some GEN modes are more mature than others. In this version, GRIDI documents display maturity honestly:

- **strong** means the display closely reflects real generator/runtime behavior;
- **acceptable** means the display is mostly honest but still coarse or abstract;
- **weak** means the metaphor exists, but the current display does not yet show the underlying behavior as clearly as it should;
- **misleading risk** means the current visuals may suggest more than the current generator/display actually proves.

When a mode is marked weak or risky, that does not mean it is unusable. It means the sound/event behavior exists, but the visual explanation still needs refinement.

## Currently implemented GEN modes

### Step Sequencer

A direct step-grid style generator. It is the clearest place to start if you want predictable pulse editing and an easy relationship between steps and sound.

Display maturity: **strong**.

### Euclidean

Distributes pulses around a cycle, useful for balanced repeating rhythms, off-kilter loops, and rotation-based variation.

Display maturity: **strong**.

### Cellular Automata

Uses rule-evolved cellular rows as rhythmic source material. It is useful for patterns that feel systematic but can still mutate into surprising shapes.

Display maturity: **strong**, with a compressed display abstraction.

### Hybrid

Blends structural ideas from multiple generators. It is useful when you want a pattern that feels partly grid-like, partly distributed, and partly evolved.

Display maturity: **acceptable**. Source-attribution in the display is still a refinement area.

### GEAR

Uses interlocking ring/phase ideas to create coincidence-based hits. It is useful for mechanical, rotating, or polymetric-feeling patterns.

Display maturity: **acceptable**. The display should not be read as a full physical gear simulation.

### RADAR

Uses a rotating directional scan with target-return behavior. RADAR is currently implemented and should be understood as a scan/angle-based generator.

Display maturity: **strong**.

### Fractal

Creates self-similar or multi-scale rhythmic structure. It is useful for nested-feeling variation and recursive pattern ideas.

Display maturity: **weak**. The sound/event behavior exists, but the display needs a stronger connection to the recursive metaphor.

### Non-Euclidean

Creates pulse behavior across warped or unequal segments. It is useful for rhythms that feel bent, segmented, or locally uneven.

Display maturity: **acceptable**, still coarse.

### Markov Chains

Uses state-transition-style decisions to shape rhythmic paths. It is useful for patterns that feel probabilistic but not completely random.

Display maturity: **acceptable**. A clearer runtime transition trace is still a refinement area.

### L-Systems

Uses grammar/branch-growth ideas mapped into pulse activity. It is useful for branching or growth-inspired rhythmic behavior.

Display maturity: **weak**. The branch metaphor is present, but the display-state correspondence needs improvement.

### XronoMorph

Morphs between rhythmic source lanes and phase relationships. It is useful for patterns that shift shape over time rather than staying in one fixed structure.

Display maturity: **acceptable**. Some display implications may still be more abstract than literal.

### Genetic Algorithms

Uses population, selection, and mutation ideas as a musical pattern metaphor. It is useful for evolutionary-feeling variation, but should not be read as a complete visible evolutionary simulation in this version.

Display maturity: **misleading risk**. Future work should either expose the generation/selection process more clearly or simplify the visuals.

### 1/f Noise

Uses correlated, pink-noise-like fluctuation crossing thresholds to create events. It is useful for patterns that feel organic, drifting, and less grid-obvious.

Display maturity: **acceptable**. The threshold relationship can still become clearer.

## RADAR and SONAR are different

RADAR is implemented now as a rotating scan mode.

SONAR is not currently available as a GEN mode. It is a planned/future concept based on pulse propagation and echo-style behavior. Do not expect to find SONAR in the current GEN mode list unless a future version adds it.
