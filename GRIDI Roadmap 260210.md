# GRIDI — Roadmap completo (reconciliado)

## Identidad (se queda como “North Star”)

GRIDI = **instrumento rítmico generativo** (indeterminación controlada + matemáticas no musicales + interacción humana).  
Todo lo demás (síntesis, visuales, FX) es *servicio del ritmo*.

---

## Estado real hoy (lo que YA está)

### Motor / Patch

- Scheduler por voz ✅

- Modos: hybrid / step / euclid / CA / fractal (proto) ✅

- Seed separado del pitch en percusiones ✅

- Params principales (determinism/density/gravity/drop/weird/rot/ca…) ✅

- Patch v0.3 con `modules[]` ✅

- Creación dinámica de voces + visual ✅ (`makeNewVoice`, add-slot) ✅

- Master gain / mute en patch ✅ (engine + UI masterGain ya) ✅

### UI / UX

- Grid modular (ya no 8 fijas) ✅

- Add-slot ghost tile ✅

- Undo/Redo ✅ (Ctrl/Cmd+Z/Y + Shift+Z)

- Visual modules funcionando ✅ (y ya sabemos el “por qué” de los colapsos)

- CSS estabilizado ✅ (desduplicado + knobs ok)

**Conclusión:** ya estamos en el corazón de “v0.3 Modular Awakening”. Lo que falta es **empaquetar** (settings/welcome/import-export) y **control** (keyboard + MIDI).

---

# Bloques de trabajo (por versión)

## v0.3 — Modular Awakening (lo que deberíamos “taggear” pronto)

**Objetivo:** sistema modular usable + reproducible.

### A) Core UX (alta prioridad)

1. **Welcome screen / Lightbox** (tu punto 4)
- Reemplaza el “Audio ON/OFF” como puerta de entrada:
  
  - breve readme + links
  
  - “Start Audio Engine”
  
  - checkbox “don’t show again” (localStorage)

- Bonus: muestra “WebAudio requires user gesture”.
2. **Settings (gear icon)** (tu punto 2)  
   Panel modal o drawer:
- Toggle: *Experimental mode* (feature flags)

- Custom CSS textbox (persistente en localStorage)

- Info útil: versión, links, export/import

- (opcional) “Reset UI” (limpia localStorage)
3. **Mejor layout de parámetros** (tu punto 3 + 6)
- Desktop: 4 knobs por fila (en lugar de 2 controles grandes)

- Mobile: sliders/inputs grandes (modo “touch”)

- Replantear Mode/Seed:
  
  - Mode: knob “stepped” o mini-segmented control
  
  - Seed: “dice button” + input compacto + copy/paste
4. **Add-slot upgrade** (tu punto 7)
- Más estético y claro:
  
  - iconos + labels
  
  - hover tooltips (“Add Drum Voice”, “Add Scope”, etc.)
  
  - lógica de uso: click = menú, shift+click = añade directo lo último

### B) Patch reproducible (alta prioridad)

5. **Import/Export Patch JSON**
- Export: botón → descarga/clipboard

- Import: pega JSON → valida version → aplica patch

- Import/export también en Settings
6. **Banks sólidos**
- Ya existen, pero falta “producto”:
  
  - rename bank
  
  - copy/paste bank
  
  - save/load banks (localStorage)
  
  - (opcional) morph A→B (v0.4)

### C) Terminal / Live coding (media-alta)

7. **Terminal Module v0**
- Un módulo que abre un mini prompt + history

- Comandos mínimos:
  
  - `help`
  
  - `set v3.density 0.2` / `set masterGain 0.7`
  
  - `mute v5` / `solo v2`
  
  - `reseed v*` / `randomize v*`
  
  - `add drum|tonal|scope|spectrum`
  
  - `export` / `import`

- Esto ya te abre la puerta a comunidad y reproducibilidad.

### D) Keyboard control (media)

8. **Controles por teclado** (tu punto 8)
- Atajos globales:
  
  - Space = Play/Stop
  
  - A = Audio toggle / o abre Welcome
  
  - R = Regen, Shift+R = Randomize, S = Reseed
  
  - 1–9 seleccionan módulo (o banco)
  
  - Flechas modifican knob seleccionado (ya lo hace el knob individual; falta selección global)

**Criterio “tag v0.3”:**

- Welcome + Settings + Import/Export + Banks persistentes + Add-slot pulido + teclado base.

> Todo lo que sea MIDI/FX lo podemos dejar para v0.31 o v0.4 si quieres taggear ya.

---

## v0.31 — Control Layer (si quieres iterar sin “romper” v0.3)

**Objetivo:** control externo y mapeo, sin meternos aún en conexiones de audio complejas.

### MIDI IN (prioridad media-alta)

- WebMIDI:
  
  - Note in: disparar voces / seleccionar módulo
  
  - CC in: mapear a parámetros (mínimo 8 macros)
  
  - Clock in (si se puede) como “follow external”

- Mapeo simple:
  
  - “MIDI learn” desde Settings o desde módulo

### OSC (opcional, depende del stack)

- En web puro es más raro; quizá con bridge (node/websocket) en futuro.

---

## v0.4 — Performance & Routing

**Objetivo:** performance real + conexiones explícitas.

### A) Connections[] (gran paso arquitectónico)

- `connections[]` en patch:
  
  - voice -> effect
  
  - voice -> master
  
  - group bus

- UI mínima: “in/out badges” + routing modal

### B) FX Modules (tu sección 2)

- Saturation/Drive (simple)

- Delay rítmico

- Filter/Resonator

- Bitcrush

- “FX como módulo” (insert o send)

### C) Visuals performativos (tu sección 3)

- Pattern grid por voz (mini)

- Euclid ring

- CA evolution

- Heatmap de actividad

- “Follow selected module”

### D) MIDI OUT + clock

- Notas generadas por patrones

- Clock out

---

## v0.5 — Generative Beast

**Objetivo:** GRIDI como “ecosistema evolutivo”.

- Markov real (transiciones entre estados/patrones)

- Mutation / breeding de patches

- Morphing entre bancos

- Sesiones auto-evolving

- Live coding avanzado (scripts, macros, guardado de sesiones)

- Librería de presets comunitaria

---

# Cosas que NO quiero que se pierdan (backlog largo plazo)

- MIDI output para controlar hardware externo (ya lo dijimos desde el inicio) ✅ en v0.4

- OSC / integración con DAW (puente externo) ✅ backlog

- “Terminal como performance” (macros, scripts) ✅ v0.5

- “GRIDI como instrumento educativo”: visuales que expliquen probabilidades ✅ v0.4+
