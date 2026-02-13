# GRIDI — Roadmap completo (reconciliado) + Pilares de Arquitectura

## North Star (identidad)

GRIDI = **instrumento rítmico generativo** (indeterminación controlada + matemáticas no-musicales + interacción humana).  
Todo lo demás (síntesis, visuales, FX) está **al servicio del ritmo**.

---

## Estado real hoy (YA está)

### Motor / Patch

- Scheduler por voz ✅

- Modos: hybrid / step / euclid / CA / fractal (proto) ✅

- Seed separado del pitch en percusiones ✅

- Params principales (determinism/density/gravity/drop/weird/rot/ca…) ✅

- Patch v0.3 con `modules[]` ✅

- Creación dinámica de voces + visual ✅ (makeNewVoice + add-slot) ✅

- Master gain / mute en patch ✅ (engine + UI) ✅

### UI / UX

- Grid modular (ya no 8 fijas) ✅

- Add-slot ghost tile ✅

- Undo/Redo ✅

- Visual modules funcionando ✅

- CSS estabilizado ✅

- Settings + Welcome + switches ✅

**Conclusión:** estamos dentro del corazón de “v0.3 Modular Awakening”.  
Lo que falta ahora es **cerrar v0.3 como release estable** y abrir la puerta a **módulos enchufables** (interfaces + patching) sin explotar el scope.

---

# Los 3 Pilares (arquitectura escalable)

Estos pilares no son “features”; son **reglas de diseño** para que GRIDI crezca sin romperse.

## Pilar 1 — Anatomía de un módulo (contrato enchufable)

Definimos una interfaz común para módulos de audio (voice/fx/bus).  
La idea: encadenar como pedales: `src.connect(dst).connect(dst2)`.

**Regla:** módulo = *unidad conectable* (input/output + connect/disconnect).

**Sugerencia (TypeScript):**

- `GridiAudioModule` para módulos que viven en AudioContext (voices/fx/buses)

- `GridiControlModule` para módulos “no-audio” (pattern/terminal/visual)

> Importante: esto NO obliga a que todo sea audio. Solo evita que mezclemos responsabilidades.

---

## Pilar 2 — Reloj preciso (Look-ahead scheduler)

En drum machines el enemigo es el lag.  
**Regla:** nunca dispares eventos con “cuando llegue el momento” desde UI; se programan *por adelantado* con `AudioContext.currentTime`.

Modelo estándar:

- loop rápido (ej. cada 25ms)

- agenda eventos para los próximos ~100ms

- programa con `node.start(exactTime)` y ramps.

> Si ya lo tienes “por voz”, perfecto: el siguiente paso es formalizarlo como `Clock` + `Transport`, para que MIDI clock y polirritmia entren sin reescribir todo.

---

## Pilar 3 — Envolventes ADSR (y pitch env para kicks)

**Regla:** toda voz percusiva debe sonar “instrumental”, no “beep”.

- Gain envelope (A/D/S/R o A/D/R para percusivo)

- Pitch envelope para kick (de ~150Hz a ~50Hz rápido)

- Usar `linearRampToValueAtTime` / `exponentialRampToValueAtTime` y `cancelScheduledValues`.

> Tu `clamp` y `lerp` ayudan, pero WebAudio ya te da rampas perfectas; tu math sirve para curvas custom (exp, pow, sigmoid).

---

# Roadmap por versiones

## v0.3 — Modular Awakening (tag estable)

**Objetivo:** sistema modular usable + reproducible (patch compartible).

### A) Core UX (alta)

- **Header sticky + blur** (regresión a corregir)

- **Gear a extremo derecho** (polish)

- Add-slot pulido: iconos + labels + tooltips
  
  - click = menú
  
  - shift+click = añade “último tipo” directo

- Atajos base (si falta alguno):  
  Space Play/Stop, R regen, Shift+R randomize, S reseed

### B) Patch reproducible (alta)

- Import/Export Patch JSON ✅ (ya)

- Import/Export Banks ✅ (ya)

- Producto “Banks”:
  
  - rename bank
  
  - copy/paste bank
  
  - reset bank
  
  - (persistencia ya existe)

✅ **Criterio “Done v0.3”:** UX sin regresiones + settings/welcome + reproducibilidad + banks “producto”.

---

## v0.31 — “Plug & Clock” (fundaciones de modularidad)

**Objetivo:** preparar modularidad real sin meter routing complejo.

### A) Contratos de módulo (alta) ✅ (pilar 1)

- Introducir interfaces:
  
  - `GridiAudioModule` (input/output/connect)
  
  - `GridiControlModule` (tick/update, bindings, etc.)

- Un “ModuleHost” mínimo que:
  
  - crea/destruye módulos
  
  - gestiona conexiones simples (por ahora: voice→master)
  
  - mantiene un registry por id

### B) Clock / Transport formal (alta) ✅ (pilar 2)

- Extraer el scheduler/lookahead a `Clock`

- `Transport` con:
  
  - play/stop
  
  - bpm
  
  - (futuro) external clock follow

- Esto hace trivial:
  
  - MIDI clock in/out después
  
  - polirritmia sin hacks

### C) Envelopes utilitarias (media-alta) ✅ (pilar 3)

- `env.ts`: helpers para gain env y pitch env (kick)

- Reutilizable en voices nuevas

### D) MIDI Manager v0 (media)

- `MidiManager`:
  
  - mapea 0..127 → rangos internos (0..1 / Hz / ms)
  
  - nota→frecuencia: `440 * 2^((n-69)/12)`
  
  - CC learn simple (8 macros globales)

---

## v0.32 — Pattern Modules (separación UI de secuencia vs timbre)

**Objetivo:** bajar densidad de controles por voz y volver el instrumento más educativo.

- Nuevo `PatternModule` (step/euclid/CA/hybrid)

- VoiceModule puede usar:
  
  - `patternSource: "self" | moduleId`

- Visualizadores ligados a PatternModule:
  
  - euclid ring
  
  - CA evolution
  
  - heatmap

- Aquí encaja perfecto tu idea:
  
  - **bancos por timbre** (drum/synth presets)
  
  - bancos por secuencia (patterns)

> Regla anti-Cardinal: sin cables aún, solo “source selector”.

---

## v0.4 — Performance & Routing

- `connections[]` en patch (voice→fx→master, sends, buses)

- FX Modules (drive/delay/filter/bitcrush)

- MIDI OUT + clock

- Visuals performativos (follow selected, etc.)

---

## v0.5 — Generative Beast

- Markov real, mutation/breeding, morph A→B, auto-evolving sessions

- terminal/live coding avanzado

- preset library comunitaria

---

# Backlog (no perder)

- OSC (con bridge Node/WebSocket)

- Terminal como performance (macros/scripts)

- “GRIDI educativo”: visuales explicando probabilidades

- Idioma, temas UI, fondo reactivo ON/OFF, export de datos/caché, licencia, etc.

---

# Decisión clave (documentada): separar “Seq” de “Voice”

### Ahora (v0.31): separación interna

- `VoiceEngine` consume `PatternEngine`, pero el patch no cambia.

### Después (v0.32): separación UI opcional

- aparece `PatternModule` y `patternSourceId`

Esto te da:

- menos controles por voz

- más espacio para timbre/presets

- visualizadores “con sentido” por secuencia

- sin entrar a routing complejo aún



## v0.30 — Modular Awakening ✅

UI estable  
Patch reproducible  
Settings + Welcome  
Undo/Redo  
Banks  
Sticky glass header

---

## v0.31 — Core Reinforcement

- Module lifecycle (dispose)

- GenericParam system

- Clock service separado

- Look-ahead formalizado

- Envelope utility class

- MIDI Manager v0

- Keyboard refinement

---

## v0.32 — Structural Evolution

- Pattern modules separados de Voice

- connections[] explícito

- UI tabs per module

- Visual modules ligados a Pattern

---

## v0.4 — Performance Routing

- Buses

- FX modules

- MIDI OUT

- Clock out

---

## v0.5 — Generative Ecosystem

- Markov real

- Patch morph

- Mutation / breeding

- Terminal avanzado

- Comunidad + preset exchange

- Algorave mode
