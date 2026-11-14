# Organizador del día — documento de diseño

Fecha: 14/11/2026

## 1. Propósito

La app tiene que decir en cada momento del día **qué toca hacer y cómo empezarlo**, y hacer que todo cuadre: clases, trabajo, estudio, entregas, deporte, familia, descanso y trayectos. El objetivo es acabar con la procrastinación que aparece cuando no se sabe por dónde empezar.

**Criterio de éxito:** al abrir la app se ve qué toca ahora y el primer paso concreto, y se puede hacer sin tener que pensar en cómo organizarse.

## 2. Uso diario

- **La noche anterior:** mostrar a qué hora hay que levantarse.
- **Al levantarse:** mostrar el día entero en bloques con hora y duración: levantarse, desayunar y todo lo que implica, ir a clase o estudiar en casa, gym, trabajo, etc.
- **Durante el día:** aceptar cambios escritos o por voz y reorganizar el resto del día.
- **Entrada de tareas:** entender lo que se dice o escribe y dividirlo en pasos claros.
- **Bloques de estudio:** no deben ser solo un título, sino una guía concreta. Por ejemplo: "ponte con los temas X, Y y Z. Para X, lee este temario y resuelve estos ejercicios; para Y, haz tal y tal ejercicio para consolidar; para Z, haz esto para poder resolverlo bien". Recordar también qué hay que entregar y qué día, relacionándolo con lo hecho hoy y otros días.
- **Dentro de cada tema:** mostrar cómo estudiarlo. Por ejemplo: "primero lee esto para entender aquello, luego haz esta parte del ejercicio…".
- **Fuentes:** leer Google Calendar (clases, exámenes y otros eventos) y la UdG (entregas y temario de las asignaturas). Algunos exámenes están en un calendario externo con su propio enlace, así que hay que aceptar **varios enlaces de calendario**.

## 3. Estudio enfocado a examen

- El estudio va **completamente orientado al examen**. El objetivo es saber resolver **cualquier tipo de problema posible de cada tema, por complicado que sea**.
- Para cada tema, sacar del material todos los tipos de problema que aparecen.
- Ordenar las guías de lo básico a lo más difícil.
- No dar un tema por dominado hasta haber resuelto bien los problemas más complicados.
- Si se suben exámenes de otros años, usarlos para saber qué tipos de problema caen y con qué dificultad.
- **Idioma:** las guías y explicaciones del temario van **en catalán**, que es el idioma del material. El resto de la interfaz va en castellano.

## 4. Reglas de la semana

**Intocable:** el trabajo (GEiEG). Solo cambia si se indica explícitamente que ha cambiado el horario. Todo lo demás se puede recortar, mover o adaptar respetando el orden de prioridad.

**Orden de prioridad cuando no cabe todo:**
1. **Estudios**, con su propio orden interno: entregas cercanas → exámenes → estudio general para examen.
2. **Entrenos y partidos de balonmano.** Los partidos de fútbol de la uni van en este mismo nivel.
3. **Gym** (objetivo: 3-4 veces por semana) **y objetivos flexibles** (ver a los abuelos, etc.). Si no caben, pasan a otro día.

**Entrenos de balonmano:** no cambian de hora. Solo se decide ir o no ir, y esa decisión es siempre del usuario.

**Clases:**
- Solo las **prácticas** son de asistencia obligatoria y no se tocan nunca.
- En principio se va a todas las clases, aunque eso implique quitar horas de sueño.
- Solo en casos extremos se salta una clase no obligatoria. Regla: hay un **mínimo de sueño** (por defecto 4 h, ajustable). Si para ir a una clase no obligatoria hubiera que dormir eso o menos, proponer saltársela y apuntar qué hay que recuperar de ella para el examen. La decisión la confirma el usuario.
- Reconocer las prácticas por el nombre del evento ("Pràctica", "Laboratori"…) y permitir marcar a mano cualquier evento como obligatorio o no.

**Descanso y sueño:** el descanso es muy importante.
- El descanso del día se recorta después del gym y los objetivos flexibles, y antes que el sueño.
- El sueño se puede recortar cuando haga falta, respetando el mínimo de sueño de la regla de clases.
- Avisar claramente siempre que se recorte descanso o sueño.

**Otras reglas:**
- Si un objetivo semanal no se puede cumplir, decirlo claramente en lugar de esconderlo.
- **Hora de levantarse:** calcularla hacia atrás desde el primer compromiso del día (rutina de mañana + trayecto + margen), respetando las horas de sueño configuradas.
- **Trayectos y tiempos muertos:** añadir el trayecto cada vez que se cambia de sitio y un margen de transición entre bloques (por defecto 10 min, ajustable), para que el plan cuadre con la realidad.

## 5. Objetivos, no objetivos y anti-objetivos

**Objetivos**
- Plan diario completo y realista, con trayectos y márgenes.
- Reorganización rápida por voz o texto.
- Guías de estudio concretas basadas en el material real.
- Que nunca se escape una entrega.
- Alarma para levantarse y avisos al empezar cada bloque.

**No objetivos (por ahora)**
- Compartir la app con otras personas: es de uso personal.
- Entregar trabajos o escribir en el Moodle.
- Crear eventos en Google Calendar: la app solo lo lee y el plan vive en la app.
- iPhone.

**Anti-objetivos (sería un fracaso aunque funcione)**
- Que montarla requiera tanta configuración que no se use. La puesta en marcha tiene que ser corta y guiada.
- Que el plan sea irreal: sin trayectos ni márgenes, sin descanso o sobrecargado.
- Que las guías de estudio sean genéricas ("estudia el tema 3"). Tienen que indicar páginas, ejercicios y orden concreto.
- Que cueste dinero.

## 6. Restricciones

- **Gratis:** solo herramientas sin coste. Sin tarjeta en Firebase (plan gratuito Spark).
- **Móvil:** Android, Xiaomi Redmi Note 14 (HyperOS, restricciones de batería agresivas). Las notificaciones de una app web instalada no son fiables en este móvil; por eso hace falta APK.
- **También en el ordenador.**
- **Configuración técnica:** la hace Claude a través de GitHub. Los pasos que tenga que hacer el usuario deben ser pocos y guiados paso a paso.
- **UdG:** el Moodle tiene app oficial (adaptación de Moodle Mobile), así que el acceso móvil está activado. Pero el login es por La meva UdG, y no está garantizado que una app propia pueda conectarse directamente.

## 7. Material de estudio

- Hoy el material son **PDFs de los profes en el Moodle** y algunos apuntes en **Goodnotes**.
- **Versión 1:** subir los PDFs a la app (descargados del Moodle o exportados desde Goodnotes; en Android, con "Compartir → Organizador").
- Procesar cada PDF una vez con Gemini y guardar un **mapa de la asignatura**: temas, páginas, conceptos, tipos de problema, ejercicios y qué depende de qué.
- No guardar los PDFs en Firebase Storage (requiere tarjeta). Extraer el texto por página y guardarlo en Firestore junto al mapa, para poder regenerar guías sin volver a subir el PDF.
- Alternativa descartada por ahora: carpeta de Google Drive por asignatura. Los permisos de Drive son sensibles y añaden pantallas de verificación.
- **Más adelante:** si la conexión directa con el Moodle funciona, que los PDFs nuevos entren solos.

## 8. Enfoques considerados

| | Enfoque | A favor | En contra |
|---|---|---|---|
| **A** ✅ | Web + APK con Capacitor, como "Diario de Alineadores" | Un solo código para móvil y ordenador; notificaciones fiables con la app cerrada; alarma real desde el APK; reutiliza Firebase, GitHub Pages, la compilación automática del APK y las actualizaciones automáticas | La alarma y las notificaciones necesitan la parte nativa |
| B | App nativa de Android desde cero | Control total del móvil | Mucho más trabajo; no funciona igual en el ordenador; demasiada configuración |
| C | Sin app: Claude organiza cada noche y escribe en Google Calendar | Funciona al día siguiente | No es una app propia; depende de Claude; interfaz limitada |

**Elegido: A** (14/11/2026). Es la misma forma de trabajar que ya funciona en la app de los alineadores.

## 9. Arquitectura

- **Cliente:** web en GitHub Pages, empaquetada como APK con Capacitor y compilada por una GitHub Action, igual que `pmorenod16/diario-alineadores`. Repositorio nuevo, p. ej. `pmorenod16/organizador`. Se actualiza sola al abrirla.
- **Datos:** Firebase (Auth con Google, Firestore). Un solo usuario.
- **IA:** Gemini (nivel gratuito) a través de un Cloudflare Worker que guarda la clave, como en el armario. Se usa para:
  - entender lo que se dice o escribe;
  - dividir tareas en pasos y estimar duraciones;
  - procesar PDFs al mapa de asignatura;
  - generar guías de estudio;
  - aplicar los cambios del día.
- **Planificador:** algoritmo propio y determinista que coloca los bloques (huecos, trayectos, márgenes, prioridades, objetivos semanales, mínimo de sueño). La IA no decide las horas: propone tareas, pasos y duraciones, y el algoritmo los encaja. Así los horarios son fiables y explicables.
- **Voz:** reconocimiento de voz del móvil (plugin de Capacitor; Web Speech en el ordenador) → texto → IA.
- **Calendarios:** direcciones iCal secretas (solo lectura), como en los alineadores: Google Calendar, el calendario externo de exámenes y el calendario del Moodle exportado (Calendari → Exporta) para las entregas.
- **Entregas y exámenes a mano:** desde la fase 1 se pueden añadir por voz o texto, por si algún enlace no existe o no lo trae todo.
- **Partidos y entrenos:** leerlos del calendario si están ahí y permitir apuntarlos a mano, también los que se repiten (p. ej. "entreno martes y jueves 20:00"). Por defecto quedan reservados en el plan hasta que se indique que no se va.
- **Sitios:** la UdG puede ser varios sitios (Montilivi, Barri Vell…). Cada asignatura tiene su sitio por defecto, y se usa la ubicación del evento del calendario cuando la trae. Los tiempos de trayecto se introducen a mano.
- **Alarma y avisos:** notificaciones locales programadas desde el APK. La alarma de levantarse usa la API de alarmas de Android; si la hora exacta no es posible, se abre el reloj con la hora ya puesta.

## 10. Configuración inicial (corta y guiada)

1. Entrar con Google.
2. Pegar los enlaces iCal: Google Calendar, calendario de exámenes y Moodle (con instrucciones paso a paso y capturas).
3. Sitios habituales y lo que se tarda entre ellos: casa, UdG, GEiEG, gym, casa de los abuelos, campo de fútbol.
4. Horario del trabajo, horas de sueño y mínimo de sueño, rutina de mañana (ducha, desayuno…) con duraciones, objetivos semanales (gym 3-4, abuelos…) y si se va a los entrenos de balonmano.
5. Subir los PDFs de cada asignatura (se puede hacer poco a poco).

## 11. Fases

1. **El día:** configuración, lectura de calendarios, entrada por voz y texto, tareas divididas en pasos, plan del día con trayectos y márgenes, reorganización, hora de levantarse con alarma y avisos.
2. **El estudio:** subir PDFs, mapa de asignatura, guías de estudio enfocadas a examen dentro de los bloques, "cómo estudiar este tema", relación con las entregas y con lo hecho otros días.
3. **La semana:** objetivos semanales completos, aviso de semanas imposibles, historial de lo hecho y ajuste de las estimaciones según lo que se tarda de verdad.

Cada fase se usa de verdad antes de empezar la siguiente.

## 12. Lo que queda al constructor

- Modelo de datos en Firestore y forma exacta del mapa de asignatura.
- Algoritmo de colocación de bloques y resolución de conflictos dentro de las reglas de la sección 4.
- Diseño visual: limpio y legible en el móvil. La vista principal es "ahora toca" + la línea del día.
- Cómo se marca un bloque o paso como hecho, aplazado o saltado.
- Límites del nivel gratuito de Gemini y cómo no pasarse (procesar cada PDF una sola vez y guardar los resultados).
