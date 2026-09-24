# Factory Sound Bank v1 — hoja de escucha

Inventario de los **16 presets factory DRUM** y **16 presets factory SYNTH** actuales. Fuente: [`starterModulePresets()`](../src/ui/persistence/modulePresetStore.ts) y defaults de [`makeSound()`](../src/patch.ts). Los valores son controles normalizados, no Hz, segundos ni dB. Las descripciones y los solapamientos son **hipótesis técnicas** derivadas de parámetros; no sustituyen la escucha. GEN, CTRL y VIS quedan fuera de esta revisión.

**Uso:** cargar cada código en un módulo de su familia, comparar los pares sugeridos en el mismo contexto musical, marcar **una** evaluación por preset y escribir notas de escucha. Las casillas están deliberadamente vacías; ninguna decisión musical se ha tomado aquí.

> **Contexto del banco:** la revisión del proyecto confirma que el banco factory actual se creó principalmente como banco inicial/testing. No existe requisito de conservar presets individuales y Factory Bank v2 puede reemplazar completamente los presets factory DRUM/SYNTH actuales. La definición del nuevo banco debe esperar hasta resolver primero las decisiones relevantes sobre los motores de voz. Esta nota no asigna evaluaciones a presets ni modifica sus valores.

## C. Agrupación provisional para escuchar

| Familia | Grupo de escucha | Códigos sugeridos | Motivo técnico |
| --- | --- | --- | --- |
| DRUM | Kicks | DRUM001–006 | Base grave/media y variaciones de ataque, ruido y cuerpo. |
| DRUM | Snare/rim | DRUM008, 013, 016 | Transiente y ruido prominentes; 016 es más breve y agudo. |
| DRUM | Hats/ticks | DRUM009, 010, 014 | Pitch alto, decaimiento breve y énfasis en aire/ataque. |
| DRUM | Percusión tonal/experimental | DRUM007, 011, 012, 015 | Cuerpo tonal, envolvente de pitch o drive más distintivos. |
| SYNTH | Bajos | SYNTH001, 002, 013 | Afinación baja, filtro relativamente cerrado. |
| SYNTH | Plucks | SYNTH003, 004 | Ataque inmediato, sustain y release breves. |
| SYNTH | Leads y glide | SYNTH005, 006, 012, 014 | Sustain medio/alto; 012 destaca por glide. |
| SYNTH | Pads/drone | SYNTH007, 008, 015 | Ataque y release largos, sustain alto. |
| SYNTH | Tonos/sweep | SYNTH009, 010, 011, 016 | Timbre brillante o modulación marcada. |

## A. Inventario DRUM

Abreviaturas: `amp` amplitud; `p` basePitch; `A/D` attack/decay; `tr` transient; `sn` snap; `nz` noise; `body` bodyTone; `drv` driveColor; `pEnv` pitchEnvAmt; `tone`; `comp`; `boost` y destino (`body`, `attack`, `air`); `W` stereoWidth. Todos los presets comparten `pan=0` y `panBias=0`; los controles de compresión no listados conservan los defaults, salvo DRUM003 y DRUM012, que tienen ajustes propios. Esta es una selección de parámetros principales, no el estado serializado completo.

| Código | Nombre | Parámetros principales | Lectura técnica breve | Posible solapamiento | Evaluación manual | Notas de escucha |
| --- | --- | --- | --- | --- | --- | --- |
| DRUM001 | Deep Kick | amp .20; p .23; A/D .12/.52; tr/sn .46/.18; nz .06; body/ drv .34/.34; pEnv .68; tone .30; comp .38; boost .40 body; W .22 | Grave, decay largo, poco ruido y caída de pitch marcada. | 002, 005: kicks suaves/graves. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM002 | Soft Kick | amp .16; p .33; A/D .24/.38; tr/sn .30/.12; nz .04; body/drv .45/.25; pEnv .42; tone .44; comp .22; boost .12 body; W .18 | Ataque más lento, transiente y drive bajos, casi sin ruido. | 001, 005: variante de kick suave. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM003 | Punch Kick | amp .20; p .40; A/D .10/.30; tr/sn .84/.62; nz .11; body/drv .58/.60; pEnv .56; tone .56; comp .52; boost .34 attack; W .24 | Kick corto con ataque fuerte, snap y compresión elevados. | 004: énfasis de ataque, con distinta duración. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM004 | Click Kick | amp .18; p .50; A/D .03/.24; tr/sn .92/.88; nz .15; body/drv .44/.68; pEnv .48; tone .62; comp .58; boost .50 attack; W .20 | Ataque casi inmediato, decay breve y snap muy alto. | 003: kick de ataque; 011: golpe corto. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM005 | Sub Kick | amp .24; p .12; A/D .22/.60; tr/sn .22/.08; nz .02; body/drv .26/.20; pEnv .24; tone .20; comp .22; boost .52 body; W .12 | Pitch mínimo del banco, decay largo y casi nada de ruido/ataque. | 001, 002: zona grave y suave. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM006 | Noisy Kick | amp .19; p .46; A/D .08/.42; tr/sn .70/.62; nz .55; body/drv .52/.76; pEnv .50; tone .64; comp .46; boost .36 air; W .42 | Kick medio con más ruido y drive; boost hacia air. | 008: transiente ruidoso, distinta función nominal. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM007 | Tom Like | amp .18; p .56; A/D .18/.48; tr/sn .36/.22; nz .08; body/drv .70/.40; pEnv .34; tone .62; comp .28; boost .18 body; W .30 | Percusión con cuerpo alto, poco ruido y decay medio/largo. | 015: percusión tonal de poco ruido. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM008 | Snare Like | amp .16; p .62; A/D .06/.44; tr/sn .78/.66; nz .72; body/drv .58/.64; pEnv .24; tone .56; comp .50; boost .40 attack; W .58 | Ruido y transiente altos con decay medio. | 013: snare más corto; 006: golpe ruidoso. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM009 | Hat Like | amp .11; p .82; A/D .02/.14; tr/sn .82/.78; nz .94; body/drv .78/.74; pEnv .12; tone .80; comp .34; boost .44 air; W .86 | Pitch y ruido altos, decay breve, ancho elevado. | 014: pareja más cercana; 010/016: agudos breves. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM010 | Metallic Tick | amp .12; p .90; A/D .01/.10; tr/sn .94/.86; nz .60; body/drv .84/.90; pEnv .20; tone .90; comp .40; boost .60 air; W .72 | El pitch más alto, ataque/decay muy breves y drive fuerte. | 016: golpe agudo y breve; 009/014: hats. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM011 | Pop Perc | amp .15; p .68; A/D .04/.20; tr/sn .82/.68; nz .32; body/drv .62/.56; pEnv .66; tone .68; comp .40; boost .24 attack; W .44 | Golpe breve con transiente y pitch envelope altos. | 003/004: ataque prominente; 012: percusión aguda. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM012 | Distorted Perc | amp .14; p .74; A/D .04/.28; tr/sn .74/.70; nz .48; body/drv .66/.96; pEnv .32; tone .76; comp .68; boost .70 air; W .50 | Drive y compresión máximos del banco, con ruido medio. | 011: percusión aguda; 016: drive/air. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM013 | Tight Snare | amp .16; p .66; A/D .03/.30; tr/sn .86/.78; nz .68; body/drv .50/.54; pEnv .18; tone .58; comp .46; boost .34 attack; W .44 | Variante de snare con decay más corto y ataque más rápido. | 008: pareja cercana. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM014 | Closed Hat | amp .10; p .88; A/D .006/.08; tr/sn .90/.84; nz .96; body/drv .82/.62; pEnv .08; tone .86; comp .28; boost .38 air; W .76 | Ruido máximo y decay mínimo; muy próximo al perfil de 009. | 009: pareja más cercana; 010: tick agudo. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM015 | Low Conga | amp .15; p .48; A/D .08/.36; tr/sn .50/.28; nz .12; body/drv .76/.36; pEnv .26; tone .54; comp .24; boost .18 body; W .34 | Cuerpo alto y poco ruido, con decay medio. | 007: pareja tonal cercana. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| DRUM016 | Dust Rim | amp .11; p .78; A/D .012/.18; tr/sn .88/.80; nz .82; body/drv .68/.88; pEnv .16; tone .74; comp .50; boost .54 air; W .62 | Golpe muy breve, ruidoso y con drive/air altos. | 010: tick agudo; 009/014: hats. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |

## B. Inventario SYNTH

Abreviaturas: `amp`; `wave` waveform; `coarse/fine` coarseTune/fineTune; `A/D/S/R` attack/decay/sustain/release; `cut/res` cutoff/resonance; `glide`; `mod` modDepth/modRate; `pan`. Todos tienen `pan=0`, salvo SYNTH012 (`pan=.18`). El oscilador principal usa seno para `wave<.25`, triángulo para `.25–<.50`, diente de sierra para `.50–<.75` y cuadrada para `≥.75`; hay un segundo oscilador con un desplazamiento de `wave` de `.22`. Los rótulos de onda de abajo se refieren **sólo al oscilador principal**.

| Código | Nombre | Parámetros principales | Lectura técnica breve | Posible solapamiento | Evaluación manual | Notas de escucha |
| --- | --- | --- | --- | --- | --- | --- |
| SYNTH001 | Rubber Bass | amp .14; wave .24 (seno); coarse/fine .16/.44; A/D/S/R .01/.32/.52/.28; cut/res .42/.24; glide .14; mod .22/.30 | Bajo de ataque rápido, filtro medio/bajo y release breve. | 002, 013: bajos filtrados. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH002 | Soft Bass | amp .13; wave .34 (triángulo); coarse/fine .12/.50; A/D/S/R .06/.42/.58/.50; cut/res .34/.16; glide .10; mod .12/.20 | Bajo con ataque/release más largos y filtro más cerrado. | 001, 013: bajos suaves. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH003 | Bright Pluck | amp .12; wave .74 (sierra); coarse/fine .20/.56; A/D/S/R .002/.22/.20/.16; cut/res .82/.52; glide .02; mod .18/.56 | Pluck de ataque inmediato, sustain bajo y cutoff alto. | 004: envolvente pluck, filtro distinto. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH004 | Muted Pluck | amp .12; wave .44 (triángulo); coarse/fine .18/.48; A/D/S/R .004/.20/.14/.12; cut/res .32/.36; glide .03; mod .16/.42 | Pluck breve con filtro mucho más cerrado que 003. | 003: contraste brillante/filtrado. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH005 | Lead | amp .15; wave .68 (sierra); coarse/fine .60/.50; A/D/S/R .01/.30/.68/.34; cut/res .68/.34; glide .20; mod .22/.48 | Lead de ataque rápido y sustain medio/alto. | 014: pareja más cercana; 006: lead más resonante. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH006 | Hollow Lead | amp .13; wave .90 (cuadrada); coarse/fine .66/.46; A/D/S/R .02/.28/.60/.40; cut/res .56/.62; glide .24; mod .28/.40 | Lead cuadrado con más resonancia y menor cutoff que 005. | 005, 014: leads. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH007 | Drone | amp .11; wave .36 (triángulo); coarse/fine .08/.54; A/D/S/R .22/.64/.86/.82; cut/res .28/.24; glide .42; mod .38/.12 | Capa sostenida de afinación baja, filtro cerrado y release largo. | 015: envolvente sostenida; 008: pad. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH008 | Airy Pad | amp .10; wave .62 (sierra); coarse/fine .24/.58; A/D/S/R .26/.56/.78/.88; cut/res .62/.22; glide .34; mod .20/.18 | Pad de ataque/release largos y filtro más abierto que 015. | 015: pareja cercana de pads. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH009 | Glass Tone | amp .12; wave .96 (cuadrada); coarse/fine .28/.62; A/D/S/R .01/.36/.44/.36; cut/res .84/.74; glide .06; mod .30/.58 | Tono de ataque rápido, cutoff/resonancia altos. | 010: zona brillante, modulación distinta. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH010 | Noisy Tone | amp .11; wave .82 (cuadrada); coarse/fine .88/.64; A/D/S/R .02/.40/.46/.42; cut/res .72/.46; glide .12; mod .56/.52 | Tono agudo y bastante modulado; no hay parámetro de ruido SYNTH. | 011: timbre/movimiento; 009: brillo. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH011 | FM-like Tone | amp .12; wave .56 (sierra); coarse/fine .70/.50; A/D/S/R .006/.34/.40/.30; cut/res .66/.48; glide .08; mod .74/.82 | Ataque rápido y modulación de frecuencia por LFO alta dentro del banco. | 010: movimiento fuerte; 005: tono de lead. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH012 | Wide Stereo Tone | amp .11; pan .18; wave .66 (sierra); coarse/fine .32/.52; A/D/S/R .03/.44/.62/.50; cut/res .60/.34; glide .82; mod .26/.36 | Sustain medio y glide máximo; pan levemente desplazado, sin control de anchura dedicado. | 005: sustain; 008: release; glide lo distingue. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH013 | Sub Sine Bass | amp .14; wave .08 (seno); coarse/fine .10/.50; A/D/S/R .02/.38/.72/.34; cut/res .26/.12; glide .12; mod .06/.18 | Bajo con onda principal seno, cutoff y modDepth bajos. | 001, 002: bajos; más sustain que ambos. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH014 | Square Lead | amp .14; wave .76 (cuadrada); coarse/fine .58/.50; A/D/S/R .008/.24/.64/.24; cut/res .72/.36; glide .16; mod .18/.46 | Lead cuadrado rápido, de release corto y filtro abierto. | 005: pareja más cercana. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH015 | Warm Pad | amp .10; wave .42 (triángulo); coarse/fine .24/.52; A/D/S/R .34/.60/.82/.90; cut/res .48/.18; glide .28; mod .16/.16 | Ataque y release máximos; sustain alto y filtro más cerrado que 008. | 008: pareja cercana; 007: capa sostenida. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |
| SYNTH016 | Noise Sweep | amp .10; wave .92 (cuadrada); coarse/fine .74/.60; A/D/S/R .18/.70/.54/.74; cut/res .86/.70; glide .58; mod .68/.64 | Envolvente larga, filtro brillante/resonante y modulación alta; no hay fuente de ruido SYNTH. | 010/011: movimiento y brillo, con envolvente distinta. | ☐ KEEP ☐ TWEAK ☐ RENAME ☐ REPLACE |  |

## D. Redundancias y huecos técnicos por comprobar al oído

**Criterio:** comparación de los valores normalizados de los campos numéricos presentes en todas las definiciones factory de cada familia (16 campos DRUM; 13 SYNTH). No hay dos estados idénticos. Las distancias siguientes son RMS de esos campos (menor = más cercanía), sólo para priorizar A/B; no predicen similitud perceptual y pueden ocultar diferencias de onda, destino del boost o respuesta del motor.

- **DRUM009/014 (0.062):** hats muy próximos; 014 reduce `decay` de `.14` a `.08`, entre otros cambios. **DRUM008/013 (0.084):** snares cercanos, 013 acorta el decay y aumenta snap. **DRUM007/015 (0.084):** poco ruido y cuerpo alto, aunque 007 tiene pitch y decay superiores. Son los primeros pares para escuchar. DRUM003/004 (0.103) comparten énfasis de ataque, pero su diferencia de snap/duración puede ser funcional.
- **SYNTH005/014 (0.046):** es el par numéricamente más próximo; la onda principal cambia de sierra a cuadrada, por lo que la cercanía numérica no equivale a timbre idéntico. **SYNTH008/015 (0.079):** dos pads de envolvente larga con diferencias de onda/cutoff. **SYNTH001/002 (0.094):** dos bajos cercanos; la onda y el release cambian.
- **Espacios DRUM poco cubiertos:** no hay preset llamado clap u open hat. Los hats 009/014 concentran decays de `.08–.14`; ninguno ofrece una variante de hat largo. En la zona grave (`basePitch≤.35`) los tres kicks 001/002/005 tienen `noise≤.06`, así que no hay un grave claramente ruidoso en ese tramo. Son huecos de cobertura del banco, no peticiones automáticas de nuevos sonidos.
- **Espacios SYNTH poco cubiertos:** el seno del oscilador principal (`wave<.25`) aparece sólo en bajos 001/013; no hay pad o lead de esa onda principal. Los presets con `cutoff≤.34` (002/004/007/013) tienen `resonance≤.36`; no existe una variante muy filtrada y muy resonante. Sólo 012 lleva `glide>.60`.
- **Nombres para verificar:** `Wide Stereo Tone` (012) guarda `pan=.18`, pero el estado SYNTH no tiene parámetro de anchura estéreo; su rasgo más extremo es `glide=.82`. `Noisy Tone` (010) y `Noise Sweep` (016) no incluyen un generador/parámetro de ruido SYNTH: el motor usa dos osciladores de forma de onda y modulación por LFO. `FM-like Tone` (011) sí usa modulación de frecuencia por LFO, pero el calificativo “FM-like” necesita confirmación auditiva. Son dudas sobre la correspondencia entre nombre y parámetros, **no decisiones de renombrado**.

## E. Fricciones del flujo actual de audition

El botón **PRESET** abre un panel por módulo; se puede buscar por nombre o código y cargar cualquier preset compatible. Es suficiente para una escucha individual y para saltar a un código concreto.

- La carga cierra el panel. Para comparar A/B o recorrer 16, hay que reabrirlo en cada cambio y volver a localizar el siguiente preset.
- El grupo **Factory presets** comienza cerrado y muestra inicialmente 12 registros; para ver los 16 desde la lista sin búsqueda hay que abrir el grupo y pulsar **Show 4 more**. La lista se ordena por **nombre**, no por código ni por los grupos provisionales de este documento.
- **Recent** y **Current / linked** pueden repetir presets que también aparecen en **Factory presets**, lo que añade navegación visual durante una revisión sistemática.
- No hay controles siguiente/anterior, cola de escucha ni A/B fijado. Esta revisión no propone implementarlos todavía; la búsqueda por código permite una secuencia manual fiable usando el orden de la tabla.

## Siguiente paso tras la escucha

Rellenar casillas y notas de los 32 presets en un contexto de disparo y nivel consistente; comparar primero los pares cercanos señalados. Después consolidar decisiones musicales por código antes de modificar valores, nombres o cobertura del banco.
