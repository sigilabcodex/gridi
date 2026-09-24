# Auditoría de MIDI y control externo

Fecha: 2026-09-24
Alcance: lectura del runtime, esquema, UI y documentación actual. No se implementaron cambios como parte de esta auditoría.

## Resumen

GRIDI tiene MIDI IN funcional para notas hacia un módulo SYNTH y MIDI OUT funcional para Note On/Off de eventos GEN. Ambas rutas usan Web MIDI con `sysex: false`. MIDI OUT conserva el disparo Web Audio y observa los eventos programados por el scheduler.

La presencia de un dominio MIDI en `Patch.routes` no significa que exista un router MIDI general: el runtime actual ofrece una ruta de entrada y una ruta de salida seleccionadas en la UI, un destino tonal para entrada y un `MidiOutputManager` con un output activo. El schema puede representar más rutas, pero no hay una matriz de puertos/destinos independientes.

## Implementación actual

### MIDI IN

- `src/ui/midiInput.ts` solicita `navigator.requestMIDIAccess({ sysex: false })`, enumera dispositivos, responde a hot-plug y enlaza un único `MIDIInput` activo. Puede elegir automáticamente un dispositivo o usar la selección manual.
- El parser admite Note On (`0x90`) y Note Off (`0x80`); Note On con velocity cero se interpreta como Note Off. Expone canal 1–16 y velocity normalizada 0–1.
- `src/ui/app.ts` mantiene una ruta MIDI IN seleccionada y un módulo SYNTH destino. Convierte la nota entrante a un desplazamiento respecto a la frecuencia base tonal del destino y llama `engine.triggerVoice` con `source: "midi"`, gate, nota MIDI, velocity y hora `AudioContext.currentTime`.
- El mensaje incluye canal, pero la selección de ruta no filtra por canal y el estado de voz en vivo se administra por módulo y nota, no por canal. Por tanto, canales distintos del mismo input no son destinos de ruteo independientes.
- La recepción mono/poly sigue la política del módulo SYNTH. El runtime soporta lifecycle Note On/Off para voces MIDI; esto no extiende el parser a CC, Program Change, pitch bend, clock, start/stop/continue, aftertouch o MPE.

### MIDI OUT

- `src/ui/midiOutput.ts` solicita acceso Web MIDI sin SysEx, enumera outputs, observa cambios de dispositivo y mantiene un output seleccionado (manual o auto/fallback).
- `src/engine/midiOut.ts` forma Note On/Off, normaliza notas, velocity, canal y gate, mapea lanes de batería a notas y produce mensajes de panic (Note Off por nota y All Notes Off).
- `src/engine/scheduler.ts` programa ventanas de 120 ms con ticks cada 25 ms usando `AudioContext.currentTime`. Al despachar un evento llama primero a `engine.triggerVoice(...)` y después notifica `setScheduledEventObserver(...)`.
- `src/ui/app.ts` observa eventos de la ruta MIDI OUT, traduce `timeSec` a un `delayMs` relativo al reloj actual de AudioContext y agenda `MIDIOutput.send` usando `performance.now()`. El output manager programa un Note Off tras el gate en milisegundos.
- GEN tonal mapea el primer desplazamiento de nota alrededor del MIDI base de ruta (por defecto 60). DRUM mapea lanes conocidas (`low`, `mid`, `high`, `accent`) a notas fijas y usa el base note si no hay lane.
- El channel existe en el endpoint externo y se normaliza a 1–16; la UI/runtime actual opera una configuración de ruta seleccionada, con channel por defecto 1. Base note y gate tienen defaults 60 y 120 ms.
- La selección de MIDI OUT y la sección de routing están en `src/ui/header/routingOverviewPanel.ts`; el estado se guarda como ruta tipada en `Patch.routes` y preferencias de dispositivo best-effort. El ID de dispositivo puede no existir al restaurar la sesión en otro navegador o equipo.

## Limitaciones y áreas sin runtime

| Área | Estado actual |
| --- | --- |
| MIDI IN | Notas únicamente, un input activo y un SYNTH destino seleccionado. Canal recibido se informa en el parseo, pero no sirve para filtrar/particionar rutas. |
| MIDI OUT | Note On/Off y panic para un output manager activo. No hay una matriz de outputs independientes por ruta. Aunque `midiOutRoutesForSource` devuelve configuraciones de ruta, el envío real usa el manager global seleccionado; múltiples destinos no constituyen soporte fiable. |
| Canales | Entrada identifica el canal, pero no lo enruta. Salida permite canal 1–16 en el endpoint y lo incluye en los mensajes. No hay canales múltiples configurables como destinos paralelos desde la UI actual. |
| CC / Program Change / pitch bend / aftertouch / MPE | No implementados en el flujo MIDI de entrada o salida. |
| Clock / start / stop / continue / DAW sync | No implementados. |
| MIDI routing | `domain: "midi"`, endpoints externos, normalización e inspección sí existen; no equivalen a un dispatcher multi-ruta completo. |
| GEN hacia salida MIDI | Existe para eventos del scheduler que ya se despachan a una voz interna. GEN no tiene actualmente una ruta de salida musical neutral independiente del destino Web Audio. |
| Persistencia del dispositivo | La ruta puede persistir `portId` y nombre preferido; disponibilidad y permisos dependen del navegador/sistema y se resuelven best-effort al iniciar. |

No se encontraron rastros activos de WebTransport, UDP bridge, companion service ni una API remota de control. OSC sobre UDP arbitrario no está disponible directamente para una web app normal, por lo que requeriría un bridge o servicio externo.

## GEN, evento y Web Audio

Hoy el scheduler renderiza `GridiTriggerEvent`, resuelve una voz DRUM/SYNTH, calcula el `AudioContext` timestamp y llama al motor Web Audio. El observer MIDI se ejecuta después de ese disparo. El tipo de evento (`src/engine/events.ts`) ya contiene datos musicales útiles —tiempo, velocity, lane o desplazamientos de nota—, pero su generación y despacho ocurren dentro del flujo que itera destinos de sonido. Por eso un evento GEN sin una voz de audio no tiene todavía el mismo camino de despacho.

La frontera conceptual mínima propuesta sería un evento musical neutral, por ejemplo:

```ts
type GeneratedEvent = {
  sourceId: string;
  time: MusicalTime;
  notes?: number[];
  lane?: string;
  velocity: number;
  duration?: MusicalDuration;
};
```

Un dispatcher podría entregar ese evento a adaptadores separados: `internal audio adapter`, `MIDI adapter` y posteriormente `OSC adapter`. Es una dirección futura, no una descripción del runtime actual. En el primer paso convendría preservar el scheduler/AudioContext timing existente y extraer sólo la frontera de evento cuando haya un destino GEN independiente del sonido interno.

## Scheduling y sincronización: comportamiento comprobado

- El reloj autoritativo actual del scheduler es `AudioContext.currentTime`, en segundos. Programa una ventana de 120 ms y revisa cada 25 ms.
- Las notas MIDI en vivo entrantes se entregan al motor con el tiempo actual de AudioContext; no se convierten desde timestamps entrantes de DOM a un reloj de audio ni se agenda anticipadamente.
- Para salida, `app.ts` calcula `max(0, eventTimeSec - audioCurrentTime) * 1000`, y el manager lo suma a `performance.now()` para obtener la marca temporal de `MIDIOutput.send`. El Note Off usa esa misma marca más el gate.
- Así se hace una conversión relativa entre relojes en el momento de enviar. No hay una relación de reloj calibrada, estimación de latencia del dispositivo ni compensación medida de jitter. Si el callback llega tarde, el delay se limita a cero y el envío queda inmediato.
- El tempo se puede cambiar mientras corre el transporte; el scheduler conserva el beat actual y reinicia el origen temporal. El gate MIDI de salida es un valor fijo por ruta en milisegundos, no deriva del siguiente evento ni de una duración musical.
- No se encontró una política MIDI dedicada para suspensión/background tab ni recuperación de transporte. El intervalo JS y disponibilidad del AudioContext/navegador pueden afectar la puntualidad. Esto es un riesgo de plataforma, no una latencia medida en esta auditoría.

## Modelo futuro recomendado para MIDI destination/channel

Mantener separado el instrumento/preset del destino. Un destino debería pertenecer a una **ruta de salida**, no al preset del módulo.

- **Ruta:** source GEN, device ID preferido, channel 1–16, enabled, modo de salida y parámetros de mapeo propios del destino (por ejemplo base note, gate o mapa de drum lanes). La identidad de destino puede ser estable aunque el dispositivo no esté conectado.
- **Sesión:** conexiones/rutas elegidas para la composición, incluyendo fuente GEN, destino y canal. No almacenar disponibilidad actual como hecho durable.
- **Configuración de dispositivo/runtime:** permisos Web MIDI, inventario conectado, selección temporal y nombres/IDs resueltos. Debe tolerar unplug, cambio de navegador y IDs no disponibles.
- **Módulo:** únicamente comportamiento de instrumento/generador y datos de evento que realmente le pertenezcan. No incorporar ahí preferencias de hardware ni bank/program por defecto sin un requisito musical claro.

Para múltiples destinos, cada ruta debe resolverse y enviarse a su propia instancia/output seleccionado; una lista de rutas apuntando al output global no basta. Debe definirse también si el canal es único por ruta o si se permite fan-out de canales.

## OSC: opciones futuras

| Opción | Ventajas | Límites e impacto en GRIDI |
| --- | --- | --- |
| Browser WebSocket ↔ bridge local OSC/UDP | Latencia local baja, funciona con aplicaciones OSC existentes y evita UDP desde navegador. | Requiere instalar/ejecutar bridge, definir protocolo WebSocket, descubrimiento/permisos y ciclo de vida; impacto pequeño a medio en GRIDI más software separado. |
| Browser WebSocket ↔ servidor remoto ↔ OSC/UDP | Acceso remoto y bridge centralizado; GRIDI sólo necesita cliente WebSocket y configuración de servidor. | Dependencia de red/servidor, latencia variable, autenticación y seguridad; mayor infraestructura y operación. |
| Companion desktop/local service | Puede poseer puertos MIDI/UDP locales, dispositivos y permisos; ofrece control más uniforme que el navegador. | Distribución, instalación, actualizaciones y protocolo de IPC; mayor alcance de producto, pero puede reutilizarse para MIDI y OSC. |

En cualquiera de las opciones, conviene que OSC sea otro adaptador de eventos neutral y que el bridge defina nombres, tipos, argumentos, bundles/timestamps y política de reconexión. No existe hoy un contrato OSC implementado.

## Blockers reales

1. **Dependencia de voz interna:** el scheduler genera y notifica eventos por destino de sonido; GEN no despacha a un sink independiente sin mantener ese destino.
2. **Salida MIDI global:** un output manager único no satisface múltiples dispositivos independientes ni fan-out robusto de rutas.
3. **Duración/gate simplificados:** MIDI OUT usa gate fijo en milisegundos; no expresa duración ligada a evento o articulación del generador.
4. **Relojes sin calibración:** la conversión AudioContext/performance es relativa; no hay corrección medida de latencia/jitter.
5. **Cobertura de protocolo:** no CC, pitch bend, Program Change, MIDI clock/sync, aftertouch ni MPE.
6. **Dependencia del navegador:** Web MIDI y permisos varían entre navegador, sistema y dispositivo; desconexiones alteran el destino activo.

## Secuencia incremental propuesta

1. **Formalizar evento neutral de GEN:** extraer la emisión musical del loop de destinos y mantener el adaptador Web Audio actual como primer consumidor. No cambiar el sonido existente.
2. **Destino MIDI por ruta:** resolver device/output y channel para cada ruta de manera independiente; añadir pruebas con outputs simulados y desconexión/fallback.
3. **Mejorar duración y sincronización MIDI:** definir gate ligado a evento, conversión de timestamp aislada y medición/compensación de latencia. Mantener clock/transport sync separado hasta tener requisitos.
4. **Ampliar mensajes de control:** especificar destinos, rangos y resolución para CC/pitch bend/Program Change; integrar velocity/accent con semántica consistente. No meter esos controles en presets.
5. **Añadir OSC por adapter/bridge:** elegir entre bridge local WebSocket y companion cuando el contrato de evento neutral y destinos esté probado.

El orden entre consolidar la arquitectura de eventos y expandir MIDI depende de si la prioridad inmediata es salida MIDI o independizar GEN; no está congelado.

## Riesgos y áreas afectadas

- **Reloj musical y salida física:** divergencia temporal, callbacks tardíos, pestaña en background y dispositivos que no respetan scheduling con precisión.
- **Notas colgadas:** desconexión/cambio de output y cleanup de gates; panic sólo puede actuar sobre el output disponible y canal enviado.
- **Compatibilidad de sesión:** las rutas existentes y legacy `triggerSource` deben seguir cargando; preferencias de port no son portables.
- **Fan-out:** el runtime podría duplicar mensajes o mandarlos al mismo output global si se interpreta que varias rutas actuales ya son salidas independientes.
- **Áreas de código candidatas:** `src/engine/events.ts`, `src/engine/scheduler.ts`, `src/engine/audio.ts`, `src/engine/midiOut.ts`, `src/ui/midiInput.ts`, `src/ui/midiOutput.ts`, `src/ui/app.ts`, `src/routingGraph.ts`, `src/ui/header/routingOverviewPanel.ts` y pruebas de scheduler, MIDI lifecycle, MIDI output, routing y persistencia.

## Fuentes principales inspeccionadas

- `src/engine/events.ts`, `src/engine/scheduler.ts`, `src/engine/audio.ts`
- `src/engine/midiOut.ts`, `src/ui/midiInput.ts`, `src/ui/midiOutput.ts`
- `src/ui/app.ts`, `src/routingGraph.ts`, `src/ui/header/routingOverviewPanel.ts`
- `docs/audits/midi-out-phase-0-2026-05.md` (auditoría/implementación de fase previa; sus secciones de propuesta inicial no describen por sí solas el estado actual)
