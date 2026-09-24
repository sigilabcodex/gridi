# Auditoría de motores DRUM y SYNTH

Fecha: 2026-09-24
Alcance: arquitectura de instrumentos, semántica DSP/UI, modulación y direcciones futuras. Auditoría de lectura; no se modificaron motores ni valores de presets. No se hizo prueba auditiva, así que posibles clicks, aliasing y diferencias de nivel son riesgos por verificar, no fallos audibles confirmados.

## DRUM — arquitectura real

### Estado y parámetros

`DrumSynthModule` está definido en `src/patch.ts`. El estado serializado incluye `drumChannel`, `basePitch`, `attack`, `decay`, `transient`, `snap`, `noise`, `bodyTone`, `driveColor`, `pitchEnvAmt`, `pitchEnvDecay`, `bendDecay`, `tone`, `comp`, `compThreshold`, `compRatio`, `compAttack`, `compRelease`, `boost`, `boostTarget`, `stereoWidth` y `panBias`; hereda `enabled`, `amp`, `pan`, `triggerSource` y `modulations`.

Los defaults de `makeSound("drum")` están en `src/patch.ts`. Los controles DSP son mayormente normalizados 0–1, con paneo -1–1. `drumChannel` (Auto/01–08) identifica una parte/lane de DRUM en el ruteo del secuenciador, no canal MIDI.

`pitchEnvDecay` y `bendDecay` coexisten en el estado normalizado. El runtime usa `bendDecay` y toma `pitchEnvDecay` como fallback si falta; si ambos existen, `pitchEnvDecay` no determina el tiempo de caída. La UI de fine-tune actualiza ambos como compatibilidad.

### Grafo DSP efectivo

Cada golpe construye nodos nuevos en `src/engine/audio.ts`:

1. Oscilador de cuerpo con seno o triángulo según umbral de `bodyTone`.
2. Ganancia/envolvente de cuerpo, pre-drive y waveshaper de 256 puntos con oversampling 2x, seguido por low-pass.
3. Buffer de ruido blanco generado con `Math.random()` por golpe, band-pass y envolvente de ganancia.
4. Oscilador cuadrado de click y ganancia corta.
5. Las tres ramas entran a un DynamicsCompressor con makeup y después a StereoPanner/salida de efectos o master.

El pitch del cuerpo parte por encima de su frecuencia base y cae exponencialmente de acuerdo con `pitchEnvAmt` y `bendDecay`. Cada trigger es una voz independiente que se detiene y limpia al terminar; no hay pool ni límite global de voces DRUM. Parámetros de audio se asignan al construir la voz; los controles no transforman continuamente golpes activos.

### Significado efectivo de parámetros

- `basePitch`: frecuencia base de cuerpo.
- `attack`, `decay`: ataque y caída de la envolvente de cuerpo.
- `pitchEnvAmt`, `bendDecay`: cantidad y duración de caída de pitch.
- `transient`: nivel del cuerpo y del click. No es velocity de evento.
- `snap`: contribuye a tono/duración/nivel del click y al Q del ruido.
- `noise`: nivel de la rama de ruido blanco.
- `tone`: afecta low-pass del cuerpo y band-pass del ruido.
- `bodyTone`: cambia la onda cuerpo cerca de un umbral y también escala el drive/waveshaper.
- `driveColor`: influye en pendiente del waveshaper y respuesta de filtros.
- `comp`: combina cambios de knee, ratio, threshold, makeup, pico de cuerpo y duración de cola.
- `compThreshold`, `compRatio`, `compAttack`, `compRelease`: parámetros del compresor por golpe.
- `boost`/`boostTarget`: refuerza principalmente cuerpo, click/ataque o ruido/aire, pero conserva contribuciones parciales a otras ramas.
- `panBias`/`pan`: paneo. `panBias` tiene precedencia de runtime con fallback `pan`.
- `stereoWidth`: escala la cantidad de paneo; no crea señal estéreo ensanchada.

## DRUM — fortalezas y límites

La identidad real es la de un sintetizador híbrido genérico de percusión con cuerpo tonal, ráfaga de ruido y click. Puede cubrir kicks, toms/conga sintéticos, percusión tonal breve, ticks/hats cerrados y golpes tipo snare aproximados. También puede crear material experimental con pitch envelope, waveshaping y mezcla de ruido.

No es un motor multi-modelo de batería. Un solo cuerpo oscilatorio, un ruido filtrado y un click cuadrado limitan la posibilidad de hacer convincentes cymbals/hats abiertos largos, claps con varias capas de transientes, resonancias metálicas complejas, rims detallados o instrumentos acústicos. Faltan bancos de parciales inarmónicos, múltiples resonadores, capas de muestras y envelopes independientes completos para todas las ramas.

**Velocity está ignorada en DRUM.** El scheduler crea `velocity`, pero la rama DRUM del motor no la aplica a amplitud ni timbre. `transient` es estático, no reacciona al valor de cada evento.

El balance de nivel depende de las configuraciones: la compresión/makeup afectan a una voz, no normalizan loudness global. El cuerpo tiene waveshaping 2x oversampled, pero el click cuadrado y sus transientes no pasan por el mismo camino. Esto amerita medición de aliasing/clicks y niveles, sin que el código permita afirmar que ya son problemas audibles. Golpes rápidos se solapan con grafos nuevos; no hay un limitador o política de retrigger de voz específica.

## SYNTH — arquitectura real

### Osciladores, pitch y timbre

`TonalSynthModule` está definido en `src/patch.ts`; los defaults y normalización están en la misma área. Por nota, `src/engine/audio.ts` crea **dos osciladores**: forma seno/triángulo/sierra/cuadrada por tramos de `waveform` para el primero; el segundo lee `waveform + 0.22` y su frecuencia queda fija a 1.004 veces la primera (~6.9 cents). No hay nivel o afinación individual configurable por oscilador.

Con `reception: poly`, se aceptan hasta cuatro alturas por evento, por lo que el máximo normal por evento es ocho osciladores. Cada nota/evento crea nodos nuevos.

La frecuencia base depende de `coarseTune`, `fineTune`, macro y del índice del módulo dentro de la lista de voces sonoras. Ese índice elige una frecuencia base/octava de una tabla. Añadir, quitar o reordenar módulos puede, por tanto, cambiar el pitch base de una instancia existente. Es una dependencia de contexto oculta, no un parámetro del instrumento.

### Filtro, envolvente, glide y LFO

- Un low-pass común con cutoff y Q fijados al crear la voz; no hay filter envelope.
- ADSR de amplitud con ramps. Las voces de patrón sostienen un tiempo fijo breve (~60 ms antes de release), independientemente de una duración de gate musical larga.
- Glide aplica `setTargetAtTime` a osciladores nuevos desde su valor inicial; al no reutilizar una voz mono, no equivale siempre a portamento legato entre notas.
- LFO sinusoidal por voz, aproximadamente 0.2–11.2 Hz, conectado a frecuencia de los dos osciladores. Es vibrato/modulación lenta de pitch, no FM de audio.
- Paneo con StereoPanner; no hay control de ancho/unison estéreo.
- Amplitud usa `amp * velocity` y se divide por raíz de número de notas. Velocity afecta volumen, no filtro o ataque.

### Polyphony y vida de voz

`mono` selecciona una altura por evento y `poly` hasta cuatro, pero esto no implica un voice allocator mono global. Voces generadas de eventos sucesivos pueden solaparse. No hay límite global de polyphony ni voice stealing general. El tracking separado de Note On/Off MIDI permite liberar/reemplazar voces MIDI mono y sostener polifonía MIDI, pero no registra todas las voces del patrón. Note Off temprano puede fijar el gain al nivel sustain antes de iniciar release, dando un posible salto si la voz aún estaba en attack/decay.

## SYNTH — fortalezas y límites

El motor cubre síntesis sustractiva sencilla de dos osciladores, low-pass, ADSR y vibrato lento. Sirve para bass, pluck, lead sencillo, tonos tipo órgano básicos, drones disparados y sonidos tonales percusivos. Algunas campanas pueden aproximarse con afinación, pero no hay parciales inarmónicos, decays independientes o resonadores que sostengan un carácter bell/glass convincente.

No hay **FM de audio, wavetable, fuente de ruido SYNTH, filter envelope, unison real, nivel/detune independientes por oscilador, modulación espectral continua ni allocator de voces general**. Pads y evoluciones largas también están limitados por el gate corto fijo de voces generadas y la ausencia de modulación continua durante la vida de la voz.

## Modulación/expresividad que realmente consume el runtime

El inventario de capacidades de routing es más extenso que los consumidores DSP actuales. Los destinos de voz leídos por runtime son:

- `trigger.density`, en el scheduler;
- `drum.basePitch`, muestreado al disparar una voz;
- `tonal.cutoff`, muestreado al disparar una voz.

No se actualizan voces activas con la modulación de UI/CTRL. Otras entradas de `modulations` y destinos tipados que aparezcan disponibles en UI/schema no deben considerarse automatización DSP funcional sin un consumidor de runtime.

Destinos naturales futuros: velocity/accent a nivel y timbre; DRUM pitch, decay, tono y mezcla de ruido; SYNTH cutoff, pitch, resonancia, profundidad/rate LFO y envolvente. Destinos discretos como waveform requieren semántica stepped o transición específica. Para CC, pitch bend, aftertouch y modulation wheel harían falta destinos/rangos explícitos y smoothing mientras las voces están activas.

## UI y semántica

Los siguientes nombres visibles no corresponden al efecto DSP habitual:

| Familia | Nombre visible | Efecto runtime actual |
| --- | --- | --- |
| DRUM | Drive | `bodyTone`, que también conmuta la forma de onda del cuerpo y no es sólo drive. |
| DRUM | Clip | `snap`; no es threshold de clipping. |
| DRUM | Symmetry | `boost`; no controla simetría del waveshaper. |
| DRUM | Spread | `panBias`; no es anchura estéreo. |
| SYNTH | Drive | `modDepth` del LFO de pitch; no hay etapa de drive. |
| SYNTH | Spread | `glide`; no es spread estéreo/unison. |
| SYNTH | FM | `modRate` del LFO lento; no hay FM de audio. |
| SYNTH | Noise | `coarseTune`; no crea ruido. |
| SYNTH | Drift | `fineTune` estático; no hay drift aleatorio. |

Fine-tune también ofrece nombres que aparentan capacidades ausentes o asignan aliases a parámetros distintos: DRUM “Snap mode”, “Noise color”, “Knee”, “Mono low”, entre otros; SYNTH “Key tracking”, “Filter drive”, “Wave morph”, “Phase”, “Sync”, “Velocity”, “Env amount”, “Width” y “Pan law”. La forma de onda actual es discreta; cutoff no sigue pitch; glide no es width; no existe ley de paneo seleccionable ni envelope amount independiente. Los perfiles/rutas de control que escriben coarse/fine o ADSR son presets de ajuste sobre los campos existentes, no estados independientes.

Conviene aclarar nombres/rangos primero y preservar claves serializadas. Cambiar significado o rango puede alterar sesiones y factory presets guardados, aunque no cambie el schema nominal.

## Ideas históricas encontradas

- `docs/architecture/sound-modules.md` describe estos motores y propone para DRUM selección de modelos kick/snare/hat, EQ de transiente y distorsión; para tonal, entrada explícita de nota, unison spread y filter envelope. Son ideas, no runtime actual.
- `docs/module-layout-spec.md` presenta DRUM como voz sintetizada general, no como selector actual de instrumentos acústicos.
- `docs/manual/11-future-directions.md`, `docs/roadmap-instrument-state.md` y `docs/status.md` mencionan sampling/looping/granular como exploración futura.
- No se encontró implementación activa de sampler, wavetable, FM, granular o modelado físico. La etiqueta UI “FM” no implementa FM.

## Dirección y recomendaciones

### A. Refinements del motor actual

| Propuesta | Beneficio | Complejidad | Riesgo de sesión/preset | CPU | Modulación/MIDI |
| --- | --- | --- | --- | --- | --- |
| Alinear nombres, rangos y controles UI al DSP real manteniendo claves | Edición más clara y sonidos más predecibles. | Baja–media | Bajo si es sólo wording; medio si cambia rango/escritura. | Nulo | Hace claros los destinos disponibles. |
| Desacoplar efectos compuestos de `comp` y `bodyTone` gradualmente | Menos interacciones sorprendentes y mejor consistencia. | Media | Medio–alto si cambia interpretación de valores guardados. | Bajo | Expone destinos independientes. |
| Medir niveles, transientes y aliasing; corregir ramping donde se confirme problema | Menos saltos/clicks y respuesta de nivel más consistente. | Media | Bajo–medio según si altera curva audible. | Bajo | Facilita automatización segura. |
| Resolver duplicidad `pitchEnvDecay`/`bendDecay` con lectura compatible | Estado sin precedencia oculta. | Media | Medio, exige normalización/migración compatible. | Nulo | Simplifica target de pitch envelope. |

### B. Missing expressive controls

| Propuesta | Beneficio | Complejidad | Riesgo de sesión/preset | CPU | Modulación/MIDI |
| --- | --- | --- | --- | --- | --- |
| Velocity/accent coherente en DRUM y destino tímbrico gradual opcional en SYNTH | Acentuación musical y mejor respuesta MIDI/GEN. | Baja–media | Medio, cambia sonido efectivo de eventos guardados. | Despreciable | Añade velocity como fuente útil. |
| Envelopes independientes para ramas/tono según motor | Más control de transiente/ruido y articulación. | Media | Medio si se introducen defaults/curvas nuevos. | Bajo | Ofrece targets de envolvente expresivos. |
| Smoothing y actualización de voces activas en targets continuos | CC/CTRL/aftertouch se convierten en gestos audibles, sin sólo afectar futuros triggers. | Media–alta | Bajo–medio; define nuevo comportamiento de voces sostenidas. | Bajo | Base para modulación continua/MIDI expresivo. |

### C. Architectural limits

Un cuerpo + click + ruido no basta para metal/resonadores detallados, y dos osciladores sustractivos más un LFO lento no son una base convincente para FM, wavetable, granular o muestras. Esas identidades deberían tener voz/tipo de motor propio, con estado separado y normalización explícita, no una larga lista de knobs dentro de los esquemas actuales.

### D. Candidate future engines

| Candidato separado | Beneficio musical | Complejidad | Riesgo de compatibilidad | CPU | Modulación/MIDI |
| --- | --- | --- | --- | --- | --- |
| Percusión modal/resonante | Metales, campanas, toms y parciales inarmónicos. | Media | Bajo como nuevo tipo; medio si se reutiliza DRUM. | Baja–media | Targets de excitación, decaimiento y brillo. |
| One-shot sampler | Cymbals, claps y material grabado; capas por velocity. | Media | Medio por assets y portabilidad de sesiones. | CPU baja–media; memoria/IO mayor. | Muy útil para velocity layers/articulaciones. |
| FM o wavetable tonal real | Campanas, digitales y evolución espectral. | Media | Bajo si es motor separado. | Media según polyphony/calidad. | Pitch, índice/morph y envelopes. |
| Granular/textural | Nubes, textura y evolución extensa. | Alta | Medio–alto por buffers y estado temporal. | Media–alta/variable. | Mucho potencial, necesita control de granos y tiempo. |

## Qué no conviene añadir a estos motores

- No acumular parámetros para perseguir cymbals, claps complejos o metales resonantes dentro de la arquitectura DRUM actual.
- No presentar el LFO lento como FM ni como fuente de ruido, ni waveform por tramos como wavetable/morph.
- No agregar sampler/granular como otra sección de knobs de SYNTH; alteran fuente, ciclo de vida, estado y consumo.
- No añadir CC/aftertouch como destinos indiscriminados antes de definir smoothing, rangos y comportamiento de voz activa.
- No cambiar semántica de parámetros persistidos sin lectura compatible y comparación auditiva de sesiones anteriores.

## Secuencia propuesta de PRs pequeños

1. Alinear UI, nombres, rangos y mapeos con DSP real conservando claves existentes.
2. Definir respuesta a velocity/accent para DRUM y respuesta de velocity para SYNTH; comprobar cambio audible sobre eventos guardados.
3. Medir y corregir los invariantes confirmados de nivel/transiente/ramping, más la precedencia de decay con carga compatible.
4. Incorporar smoothing y actualización activa empezando por pitch/cutoff como destinos continuos acotados.
5. Prototipar una voz nueva separada (modal/resonante o one-shot) sólo tras decidir qué hueco musical necesita cubrir el nuevo banco.

El orden definitivo entre frentes de motores de voz y control externo no está congelado.

## Áreas inspeccionadas

- `src/patch.ts`, `src/engine/audio.ts`, `src/engine/events.ts`, `src/engine/scheduler.ts`
- `src/ui/voiceModule.ts`, `src/routingGraph.ts`
- `docs/architecture/sound-modules.md`, `docs/module-layout-spec.md`, `docs/manual/11-future-directions.md`, `docs/roadmap-instrument-state.md`, `docs/status.md`, `docs/routing-compatibility-matrix.md`, `docs/audio-control-instability-diagnosis-2026-04-13.md`
