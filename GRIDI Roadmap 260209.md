# GRIDI — Re-Roadmap General

## Identidad (recordatorio importante)

GRIDI **no es un sinte genérico** ni un groovebox tradicional.

Es:

> **Un instrumento rítmico generativo**, basado en:

- indeterminación controlada

- principios matemáticos no musicales

- patrones complejos (CA, Euclid, fractales, Markov, etc.)

- interacción humana (manual, MIDI, live-coding)

Todo lo demás (síntesis, visuales, efectos) **está al servicio del ritmo**.

---

## Estado actual (v0.2 – lo que YA tenemos)

### Motor

- Scheduler por voz independiente ✅

- Patrones: step / euclid / CA / hybrid / fractal (proto) ✅

- Seed separado de pitch para percusiones ✅

- Determinism / density / gravity / drop / weird funcionando ✅

- Audio engine estable (con glitches conocidos) ✅

### UI

- Grid de 8 voces fijo

- Controles claros por voz

- ON/OFF, Randomize, Regen, Stop, Audio ON/OFF

- Bancos (parcial)

- CSS funcional pero frágil

👉 **Conclusión**: la base es sólida. El problema ya no es “hacer que suene”, sino **cómo escalar el concepto**.

---

# GRAN CAMBIO CONCEPTUAL PARA v0.3

## ❗ Abandonar el paradigma de “8 voces fijas”

Para v0.3:

> **GRIDI deja de ser un instrumento de 8 voces**  
> y se convierte en un **sistema de módulos en un grid**.

---

## Tipos de Módulos (visión clara)

### 1. Voice Modules (Rítmicos)

**El corazón del sistema**

Subtipos:

- 🥁 Percussive Voice

- 🎹 Tonal / Synth Voice

- 🌊 Drone / Texture Voice

Características:

- Cada módulo = una voz independiente

- Puede:
  
  - generar su propio patrón
  
  - reaccionar a clock global o MIDI
  
  - ser rítmico sin ser sonoro (gatillar MIDI, FX, etc.)

---

### 2. Effect Modules

Procesamiento **post-voz** o **insertado en el grid**

Ejemplos:

- Saturation / Drive

- Delay rítmico

- Comb / Resonator

- Bitcrush

- Filter bank

Concepto importante:

- Un efecto **también es un módulo**

- Puede recibir input de:
  
  - una voz
  
  - varias voces
  
  - o el master

---

### 3. Visual Modules

Referencia, no decoración.

Ejemplos:

- Pattern grid (pasos activos)

- Euclidean ring

- CA evolution

- Waveform

- Spectrum (AnalyserNode)

- Activity heatmap por módulo

Esto:

- ayuda a entender el comportamiento probabilístico

- vuelve GRIDI educativo y performativo

---

### 4. Terminal / Live-Coding Module

Tu idea es **muy poderosa** y bastante original en web-audio.

Funciones:

- Ejecutar comandos:
  
  - control del patch
  
  - mutaciones
  
  - bancos

- Base para:
  
  - scripting
  
  - reproducibilidad
  
  - comunidad

Esto convierte a GRIDI en:

> “Un instrumento que se puede **tocar**, **programar** y **mutar**”.

---

## Arquitectura nueva (mental model)

`GRID  ├─ Module  │   ├─ VoiceModule  │   ├─ EffectModule  │   ├─ VisualModule  │   └─ TerminalModule  │  ├─ Patch  │   ├─ modules[]  │   ├─ connections[]  │   └─ global state  │  ├─ Engine  │   ├─ audio  │   ├─ scheduler  │   ├─ midi  │   └─ visual sync`

👉 **Conexiones explícitas**, no implícitas.

---

# MIDI — entra fuerte en v0.3

Tu intuición es correcta: **Web MIDI + Linux + Ardour** es un combo brutal.

### MIDI I/O (prioridad media-alta)

Funciones clave:

- MIDI IN:
  
  - notas → disparar módulos
  
  - CC → mapear parámetros
  
  - clock sync (external master)

- MIDI OUT:
  
  - clock
  
  - notas generadas por patrones
  
  - CC automations

Esto permite:

- usar GRIDI como **generador rítmico para hardware**

- integrar controladores físicos

- performance híbrida

---

# Ritmos complejos (profundizar lo que ya existe)

Prioridades claras aquí:

1. **Deterministic ↔ Probabilistic más explícito**
   
   - slider central por voz
   
   - afecta:
     
     - regeneración
     
     - evolución
     
     - drop
     
     - mutación

2. **Polirritmia real**
   
   - diferente subdiv por voz
   
   - posibles time signatures por módulo

3. **Capas de probabilidad**
   
   - pattern base
   
   - probability mask
   
   - mutation layer

---

# Generativo avanzado (mediano / largo plazo)

No para v0.3, pero sí en roadmap:

- Markov chains (evolución entre patrones)

- L-systems reales (estructuras largas)

- Breeding / mutation de patches

- Morphing entre bancos

- Auto-evolving sessions

---

# Roadmap resumido por versiones

## v0.3 — “Modular Awakening”

**Objetivo**: GRIDI como sistema modular usable

- Sistema de módulos (add/remove)

- VoiceModule percussive + tonal

- Patch JSON import/export

- Terminal module (comandos básicos)

- Visual module simple (pattern + waveform)

- MIDI IN (notas + CC básicos)

- Banks sólidos

- Limpieza UI/CSS

## v0.4 — “Performance & Control”

- MIDI OUT + clock

- FX modules

- Polirritmia avanzada

- Mejor visualización

- Preset library

## v0.5 — “Generative Beast”

- Markov / fractal real

- Evolution / mutation

- Live-coding avanzado

- Community presets
