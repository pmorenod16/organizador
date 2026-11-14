# Organizador del día — Fase 1 («El día») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web + APK que lee los calendarios, entiende entradas por voz/texto, y genera y reorganiza el plan del día con trayectos, márgenes, prioridades, hora de levantarse, alarma y avisos.

**Architecture:** Web estática sin paso de compilación (módulos ES, Firebase desde CDN) servida por GitHub Pages, igual que `pmorenod16/diario-alineadores`. Un APK de Capacitor abre esa web y añade notificaciones locales, voz y alarma. Un Cloudflare Worker hace dos cosas: lee y expande los iCal (evita CORS) y llama a Gemini guardando la clave. El planificador es un módulo JS puro y determinista; la IA nunca decide horas.

**Tech Stack:** HTML/CSS/JS (módulos ES), Firebase Auth + Firestore 10.12.2 (CDN), Cloudflare Workers + `ical.js` + `jose`, Gemini API (nivel gratuito), Capacitor 6.2.0, `@capacitor/local-notifications`, `@capacitor-community/speech-recognition`, `@capacitor-firebase/authentication` 6.3.0, GitHub Actions. Tests: `node --test` (cliente) y `vitest` (Worker).

**Spec:** `docs/superpowers/specs/2026-11-14-organizador-dia-design.md`

**Referencia de código:** `pmorenod16/diario-alineadores` (workflow `android.yml`, `capacitor.config.json`, puente `capacitor-core.js`, patrón de autoactualización por `APP_VERSION`).

## Global Constraints

- Coste cero: Firebase plan Spark (sin tarjeta, sin Storage), Cloudflare Workers gratis, Gemini nivel gratuito.
- Zona horaria fija: `Europe/Madrid`.
- Interfaz en castellano. (Las guías de estudio en catalán son de la fase 2.)
- Un solo usuario: Firestore y Worker solo aceptan el UID del dueño (`OWNER_UID`).
- La app solo **lee** calendarios; nunca escribe en Google Calendar.
- El trabajo (`kind: "trabajo"`) no se mueve ni se recorta nunca; solo cambia con una acción `trabajo-horario` explícita.
- Prácticas (`obligatorio: true`) no se mueven ni se proponen saltar nunca.
- Orden de prioridad: 1) estudios (entregas cercanas → exámenes → estudio general), 2) entrenos y partidos (balonmano y fútbol de la uni), 3) gym y objetivos flexibles.
- Orden de recorte: objetivos flexibles/gym → descanso → sueño (hasta `minSleepHours`).
- Defaults: margen de transición `10` min; `minSleepHours` `4`; gym objetivo `3`–`4` veces/semana.
- Entrenos/partidos: la app solo **propone** no ir; la decisión es del usuario. Saltar una clase no obligatoria: igual, solo propuesta.
- Avisar siempre (aviso visible) cuando se recorta descanso o sueño, y cuando un objetivo semanal no se puede cumplir.
- La configuración que hace el usuario debe ser corta y guiada (anti-objetivo: demasiada configuración).
- Repo: `pmorenod16/organizador`, público, sin datos personales en el código (solo config pública de Firebase).

## Review Focus

1. **Clases recurrentes** (RRULE semanal con `EXDATE` por festivos e instancias movidas con `RECURRENCE-ID`): deben salir en su día y hora reales, no la serie original. → test en Task 2.
2. **Cambio de hora** (último domingo de octubre/marzo): una clase a las 9:00 sigue a las 9:00 locales a ambos lados. → test en Task 2.
3. **Mismo examen en dos calendarios** (Google + calendario externo): debe aparecer una sola vez. → test en Task 3.
4. **Día sin nada fijo** (fin de semana): plan válido con hora de levantarse por defecto del perfil, sin errores. → test en Task 4.
5. **La IA entiende mal o devuelve JSON roto**: nada cambia sin confirmación; JSON inválido → mensaje de error y estado intacto. → tests en Task 6.

---

## Estructura de ficheros

```
index.html              shell de la app, carga src/main.js
styles.css
config.js               firebaseConfig, WORKER_URL, OWNER_UID, timeZone
sw.js                   service worker mínimo (copiado del patrón de alineadores)
firestore.rules
src/
  main.js               arranque, auth, router de vistas, autoactualización (APP_VERSION)
  tiempo.js             conversiones fecha ↔ minutos locales
  clasificar.js         evento iCal → EventoFijo (tipo, obligatorio, sitio), deduplicado
  planificador.js       planDay() puro
  acciones.js           validar y aplicar acciones de la IA al estado
  store.js              lectura/escritura Firestore
  ia.js                 llamadas al Worker
  nativo.js             puente Capacitor: notificaciones, alarma, voz
  vistas/configuracion.js  asistente inicial
  vistas/dia.js            «ahora toca» + línea del día + avisos/propuestas
  vistas/entrada.js        barra de texto/voz + tarjeta de confirmación
test/                   node --test para src/*.js puros
worker/
  wrangler.toml
  package.json
  src/index.js          rutas /eventos y /ia/entrada
  src/auth.js           verificación del ID token de Firebase
  src/ical.js           descarga y expansión de iCal
  src/gemini.js         llamada a Gemini con esquema JSON
  test/
app/
  package.json, capacitor.config.json
  android-extra/AlarmaPlugin.java
.github/workflows/android.yml
GUIA.md                 pasos del usuario
```

## Tipos compartidos (JSDoc en `src/tipos.js`, solo comentarios)

Minutos locales = minutos desde las 00:00 del día planificado en `Europe/Madrid` (pueden ser < 0 para la noche anterior o > 1440 pasada la medianoche).

- `EventoFijo`: `{id, titulo, inicio: number, fin: number, tipo: "clase"|"practica"|"examen"|"trabajo"|"entreno"|"partido"|"otro", obligatorio: boolean, sitioId: string|null, asistir: boolean}`
- `Tarea`: `{id, titulo, tipo: "entrega"|"examen"|"estudio"|"gym"|"flexible"|"otro", fechaLimite: "YYYY-MM-DD"|null, sitioId: string|null, pasos: [{id, titulo, minutos, hecho}]}`
- `Objetivo`: `{id, titulo, tipo: "gym"|"flexible", vecesSemana: number, minutos: number, sitioId}`
- `Perfil`: `{casaId, sitios: [{id, nombre}], trayectos: {"a|b": minutos}, rutinaManana: [{titulo, minutos}], horaDormir: number, horasSueno: number, minSleepHours: 4, margen: 10, descansoMinDia: number, levantarseDefecto: number, trabajo: [{diaSemana, inicio, fin}], objetivos: Objetivo[], asignaturas: [{nombre, sitioId}]}`
- `Plan`: `{fecha, horaLevantarse, bloques: [{inicio, fin, tipo, titulo, refId, pasoIds?, sitioId}], avisos: [{tipo, texto}], propuestas: [{tipo: "saltar-clase"|"no-ir", refId, motivo}], sinColocar: [{refId, minutos}]}`

---

### Task 1: Repositorio, web base, login y reglas de Firestore

**Files:**
- Create: `index.html`, `styles.css`, `config.js`, `sw.js`, `src/main.js`, `src/store.js`, `firestore.rules`, `README.md`, `docs/superpowers/specs/…` (copiar el spec), `docs/superpowers/plans/…` (este plan)

**Interfaces:**
- Produces: `store.js` → `cargarPerfil(): Promise<Perfil|null>`, `guardarPerfil(p: Perfil)`, `cargarTareas(): Promise<Tarea[]>`, `guardarTarea(t: Tarea)`, `borrarTarea(id)`, `cargarDia(fecha): Promise<{overrides, hechos}>`, `guardarDia(fecha, datos)`. Ruta Firestore: `usuarios/{uid}/perfil/actual`, `usuarios/{uid}/tareas/{id}`, `usuarios/{uid}/dias/{YYYY-MM-DD}`.
- Produces: `main.js` → `usuario()` (uid actual), `APP_VERSION` con autoactualización igual que en alineadores.

- [ ] **Step 1:** Crear el repo `pmorenod16/organizador` (público) con `add_repo` en modo push y activar GitHub Pages desde `main` raíz.
- [ ] **Step 2:** `firestore.rules`: lectura/escritura solo si `request.auth.uid == "<OWNER_UID>"` y la ruta empieza por `usuarios/{request.auth.uid}`.
- [ ] **Step 3:** `index.html` + `main.js`: login con Google (popup en web; `@capacitor-firebase/authentication` con `skipNativeAuth` en el APK, igual que en alineadores). Tras entrar: si no hay perfil → vista configuración; si hay → vista día.
- [ ] **Step 4:** Verificar abriendo `https://pmorenod16.github.io/organizador/` con un proyecto Firebase de prueba: login correcto, y un UID distinto recibe `permission-denied` al leer.
- [ ] **Step 5:** Commit `feat: base de la app, login y reglas`.

### Task 2: Worker — autenticación y `/eventos`

**Files:**
- Create: `worker/wrangler.toml`, `worker/package.json`, `worker/src/index.js`, `worker/src/auth.js`, `worker/src/ical.js`
- Test: `worker/test/ical.test.js`, `worker/test/auth.test.js`, `worker/test/fixtures/*.ics`

**Interfaces:**
- Produces: `POST /eventos` body `{urls: string[], desde: "YYYY-MM-DD", hasta: "YYYY-MM-DD"}`, cabecera `Authorization: Bearer <Firebase ID token>` → `200 {eventos: [{uid, titulo, desc, ubicacion, inicio: ISO, fin: ISO, todoElDia: boolean, origen: url}]}`. `401` si el token no es válido o el UID ≠ `OWNER_UID`. `502 {error, url}` si un calendario no responde (los demás siguen devolviéndose en `eventos`, con `fallidos: [url]`).
- Produces: `auth.js` → `verificarToken(token, {projectId, ownerUid}): Promise<boolean>` (JWKS de `securetoken@system.gserviceaccount.com` con `jose`).
- Produces: `ical.js` → `expandir(textoIcs: string, desde: Date, hasta: Date): Evento[]` usando el iterador de recurrencias de `ical.js`.

- [ ] **Step 1: Tests que fallan** con fixtures:

```js
test("clase semanal con EXDATE y una instancia movida", () => {
  const ev = expandir(semanal, new Date("2026-11-16"), new Date("2026-11-30"));
  // serie: lunes 09:00-11:00; EXDATE 23/11; instancia 30/11 movida a 12:00
  expect(ev.map(e => e.inicio)).toEqual([
    "2026-11-16T08:00:00.000Z", "2026-11-30T11:00:00.000Z"]);
});
test("cambio de hora: 09:00 local antes y después del 25/10/2026", () => {
  const ev = expandir(semanal, new Date("2026-10-19"), new Date("2026-10-27"));
  expect(ev.map(e => e.inicio)).toEqual([
    "2026-10-19T07:00:00.000Z", "2026-10-26T08:00:00.000Z"]);
});
test("evento de todo el día", () => { /* todoElDia === true, inicio "2026-12-01" */ });
test("token de otro UID → false", async () => { /* jose con clave de prueba */ });
```

- [ ] **Step 2:** `cd worker && npx vitest run` → FAIL.
- [ ] **Step 3:** Implementar `expandir`, `verificarToken` y la ruta `/eventos` (descarga en paralelo, CORS solo para `https://pmorenod16.github.io` y `capacitor://localhost`/`https://localhost`).
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat(worker): eventos de calendarios iCal`.

### Task 3: Clasificar eventos

**Files:**
- Create: `src/tiempo.js`, `src/clasificar.js`
- Test: `test/tiempo.test.js`, `test/clasificar.test.js`

**Interfaces:**
- Consumes: eventos de `/eventos` (Task 2).
- Produces: `tiempo.js` → `aMinutos(iso: string, fecha: "YYYY-MM-DD"): number`, `deMinutos(min: number, fecha): Date`, `diaSemana(fecha): 0-6` (0 = lunes).
- Produces: `clasificar.js` → `clasificar(eventos, fecha, perfil, marcas: {[uid]: {obligatorio?, tipo?, asistir?}}): EventoFijo[]`

- [ ] **Step 1: Tests que fallan**:

```js
test("Pràctica → practica obligatoria", () => assert.deepEqual(
  pick(clasificar([ev("Pràctica 2 Teoria de Circuits")], F, perfil, {})[0]),
  {tipo: "practica", obligatorio: true}));
test("Laboratori → practica", …);
test("Examen / Prova / Parcial → examen obligatorio", …);
test("clase normal → clase, obligatorio false, asistir true", …);
test("Entreno handbol / Partit → entreno / partido", …);
test("marca manual gana a la heurística", …);
test("sitio: ubicación con 'Montilivi' → sitio Montilivi; si no, sitio de la asignatura", …);
test("mismo examen en dos calendarios (mismo título normalizado y misma hora) → uno", () =>
  assert.equal(clasificar([exA, exADuplicado], F, perfil, {}).length, 1));
test("aMinutos de 23:30 del día anterior → -30", …);
```

- [ ] **Step 2:** `node --test test/` → FAIL.
- [ ] **Step 3:** Implementar. Palabras clave (sin mayúsculas ni acentos): práctica `practica|laboratori|lab\b`; examen `examen|prova|parcial|final`; entreno `entreno|entrenament|handbol|balonmano`; partido `partido|partit|futbol`. El trabajo no sale del calendario: lo genera el planificador desde `perfil.trabajo`.
- [ ] **Step 4:** `node --test test/` → PASS.
- [ ] **Step 5:** Commit `feat: clasificar eventos del calendario`.

### Task 4: Planificador — bloques fijos, trayectos, márgenes y hora de levantarse

**Files:**
- Create: `src/planificador.js`
- Test: `test/planificador.fijos.test.js`

**Interfaces:**
- Consumes: `EventoFijo[]` (Task 3), `Perfil`.
- Produces: `planDay({fecha, fijos: EventoFijo[], tareas: Tarea[], perfil: Perfil, semana: {hechosObjetivo: {[id]: number}}, overrides: {retrasoMin?, horaLevantarse?}}): Plan` (esta tarea cubre la parte fija; Task 5 añade el resto sin cambiar la firma).
- Produces: `trayecto(perfil, aId, bId): number` (0 si son el mismo sitio; simétrico; si falta, 15 + aviso `trayecto-desconocido`).

- [ ] **Step 1: Tests que fallan**:

```js
test("hora de levantarse = primer fijo − trayecto − margen − rutina", () => {
  // clase 09:00 en UdG, casa→UdG 15, margen 10, rutina 20+20
  assert.equal(planDay(caso1).horaLevantarse, 7*60 + 55);
});
test("bloque de trayecto entre sitios distintos y margen entre bloques", () => { … });
test("trabajo del perfil aparece como bloque fijo aunque no esté en el calendario", …);
test("día sin fijos → horaLevantarse = perfil.levantarseDefecto, sin errores", () =>
  assert.equal(planDay(finde).horaLevantarse, perfil.levantarseDefecto));
test("sueño < minSleepHours por una clase no obligatoria → propuesta saltar-clase", () =>
  assert.deepEqual(planDay(trasnoche).propuestas[0], {tipo: "saltar-clase", refId: "c1", motivo: "sueno"}));
test("la misma situación con una práctica → sin propuesta, aviso de sueño", …);
test("evento con asistir:false no genera bloque ni trayecto", …);
test("retrasoMin desplaza todo lo no fijo posterior", …);
```

- [ ] **Step 2:** `node --test test/planificador.fijos.test.js` → FAIL.
- [ ] **Step 3:** Implementar la parte fija. Sueño disponible = `horaLevantarse − (perfil.horaDormir − 1440)`; si < `horasSueno` → aviso `sueno-recortado`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat: planificador, parte fija`.

### Task 5: Planificador — tareas, prioridades, descanso y recortes

**Files:**
- Modify: `src/planificador.js`
- Test: `test/planificador.flexible.test.js`

**Interfaces:**
- Consumes/Produces: misma `planDay` de Task 4.

Algoritmo (lo que la firma no determina):
1. Huecos = tiempo libre entre bloques fijos (ya con trayectos y márgenes), desde la rutina de mañana hasta `horaDormir`.
2. Cola de prioridad: tareas `entrega` por `fechaLimite` asc → `examen` por fecha asc → `estudio`/`otro`. Se colocan **pasos** no hechos, en orden, dentro de cada tarea; un bloque agrupa pasos seguidos de la misma tarea, máx. 90 min, con margen entre bloques.
3. Reservar `descansoMinDia` en el hueco más largo de la tarde.
4. Gym/objetivos: solo si `vecesSemana − hechosObjetivo` > 0 y quedan días suficientes; si no caben → `sinColocar` y, si ya no se puede cumplir la semana, aviso `objetivo-incumplible`.
5. **Urgente** = `fechaLimite` ≤ mañana. Si una tarea urgente no cabe: (a) quitar gym/objetivos del día, (b) recortar descanso (aviso `descanso-recortado`), (c) si choca con un entreno/partido → propuesta `no-ir`, (d) adelantar el levantarse / retrasar la hora de dormir hasta `minSleepHours` (aviso `sueno-recortado`), (e) si aún no cabe → aviso `entrega-no-cabe`. Nunca tocar `trabajo` ni `practica`.
6. Lo no urgente que no cabe va a `sinColocar` (pasa a otro día).

- [ ] **Step 1: Tests que fallan**: un test por cada punto anterior, incluidos:

```js
test("entrega de mañana antes que examen de la semana que viene", …);
test("gym no se coloca si el objetivo semanal ya está cumplido", …);
test("entrega urgente quita el gym antes que el descanso", …);
test("entrega urgente recorta descanso y avisa", …);
test("entrega urgente que choca con entreno → propuesta no-ir, el entreno sigue en el plan", …);
test("entrega urgente recorta sueño hasta 4 h, nunca por debajo", …);
test("nunca se solapa nada con el trabajo", …);
test("bloque de estudio ≤ 90 min y respeta el orden de los pasos", …);
```

- [ ] **Step 2:** Tests → FAIL. **Step 3:** Implementar. **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat: planificador, prioridades y recortes`.

### Task 6: Entrada por texto con IA y acciones con confirmación

**Files:**
- Create: `worker/src/gemini.js`, `src/acciones.js`, `src/ia.js`
- Modify: `worker/src/index.js`
- Test: `worker/test/entrada.test.js`, `test/acciones.test.js`

**Interfaces:**
- Produces: `POST /ia/entrada` body `{texto, fecha, ahora: number, contexto: {asignaturas, sitios, tareas: [{id, titulo}], bloques: [{refId, titulo, inicio}]}}` → `{acciones: Accion[]}`. Gemini con `responseMimeType: "application/json"` y `responseSchema`; modelo en `GEMINI_MODEL` (var de `wrangler.toml`, el flash gratuito actual); clave en secreto `GEMINI_API_KEY`. Prompt en castellano: dividir tareas en pasos concretos con minutos estimados; no inventar fechas.
- `Accion` (unión por `tipo`):
  - `{tipo: "tarea", tarea: Omit<Tarea,"id">}`
  - `{tipo: "evento", evento: {titulo, tipo, fecha, inicio, fin, repetir?: {diasSemana: number[]}}}` (entrenos/partidos/entregas/exámenes a mano)
  - `{tipo: "retraso", minutos}` · `{tipo: "no-ir", refId}` · `{tipo: "hecho", refId}` · `{tipo: "aplazar", refId, fecha}` · `{tipo: "trabajo-horario", diaSemana, inicio, fin}`
- Produces: `acciones.js` → `validar(json): {ok: true, acciones} | {ok: false, error}`, `describir(accion): string` (texto en castellano para la tarjeta), `aplicar(estado, acciones): estado` (puro).
- Produces: `ia.js` → `entrada(texto, contexto): Promise<Accion[]>`.

- [ ] **Step 1: Tests que fallan**:

```js
test("JSON inválido → ok:false y aplicar no se llama", …);
test("acción con tipo desconocido → ok:false", …);
test("refId inexistente → ok:false", …);
test("aplicar tarea añade con id nuevo y pasos hecho:false", …);
test("trabajo-horario cambia perfil.trabajo; ninguna otra acción lo toca", …);
test("describir retraso → 'Retrasar el resto del día 20 min'", …);
test("worker: respuesta de Gemini no-JSON → 502 {error}", …); // fetch simulado
```

- [ ] **Step 2:** Tests → FAIL. **Step 3:** Implementar. **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat: entrada con IA y acciones`.

### Task 7: Asistente de configuración

**Files:**
- Create: `src/vistas/configuracion.js`
- Modify: `src/main.js`, `styles.css`

**Interfaces:**
- Consumes: `guardarPerfil` (Task 1), `/eventos` (Task 2) para probar cada enlace.

- [ ] **Step 1:** Cinco pantallas, en el orden del spec §10: (1) login hecho; (2) enlaces iCal: Google, exámenes y Moodle, cada uno con instrucciones paso a paso y botón «Probar», que muestra cuántos eventos encontró o el error; (3) sitios y trayectos (tabla casa ↔ cada sitio; los trayectos entre otros sitios son opcionales); (4) trabajo, sueño (horas, hora de dormir, mínimo 4 h), rutina de mañana, descanso diario, objetivos (gym 3-4, abuelos…), entrenos sí/no; (5) PDFs: «se hará en la fase 2», saltable.
- [ ] **Step 2:** Trayectos por defecto (dados por el usuario): casa ↔ UdG `15` min, casa ↔ GEiEG `15` min, casa ↔ gym `10` min (dijo 5-10; se usa el máximo para que cuadre). Valores por defecto en todo lo demás, para que se pueda terminar en menos de 5 minutos y ajustarlo después desde «Ajustes».
- [ ] **Step 3:** Verificar en el navegador: completar el asistente con datos de prueba, recargar, y comprobar que abre directamente la vista del día.
- [ ] **Step 4:** Commit `feat: asistente de configuración`.

### Task 8: Vista del día y barra de entrada

**Files:**
- Create: `src/vistas/dia.js`, `src/vistas/entrada.js`
- Modify: `src/main.js`, `styles.css`

**Interfaces:**
- Consumes: `planDay` (Tasks 4-5), `clasificar` (Task 3), `ia.entrada`/`validar`/`describir`/`aplicar` (Task 6), `store.*` (Task 1).
- Produces: `nativo.js` stub en web → `escucharVoz(): Promise<string>` (Web Speech API, `lang: "es-ES"`), `programarAvisos(plan)` y `ponerAlarma(minutos)`, que en web no hacen nada.

- [ ] **Step 1:** Vista «Mañana» (por la noche) y «Hoy». Arriba, «Ahora toca»: el bloque actual con su primer paso no hecho. Debajo, la línea del día (hora, duración, título, pasos con casilla), los avisos (en amarillo) y las propuestas con botones «Sí» / «No» que generan la acción correspondiente.
- [ ] **Step 2:** Barra inferior: campo de texto + micrófono → `ia.entrada` → tarjeta de confirmación con `describir()` de cada acción y botones «Aplicar» / «Cancelar». Solo «Aplicar» guarda y replanifica.
- [ ] **Step 3:** Recalcular el plan al abrir, al aplicar acciones y cada 5 min con la app abierta.
- [ ] **Step 4:** Verificar en el navegador con datos de prueba: «la clase ha acabado 20 min tarde» → tarjeta → Aplicar → el resto del día se desplaza; «tengo que entregar la práctica 2 el viernes» → aparece la tarea con pasos.
- [ ] **Step 5:** Commit `feat: vista del día y entrada`.

### Task 9: APK — avisos, alarma y voz nativa

**Files:**
- Create: `app/package.json`, `app/capacitor.config.json`, `app/www/index.html` (redirección mínima), `app/android-extra/AlarmaPlugin.java`, `.github/workflows/android.yml`, `capacitor-core.js` (copia de alineadores)
- Modify: `src/nativo.js`

**Interfaces:**
- Produces: `nativo.js` en APK → `programarAvisos(plan)` (cancela los anteriores y programa una notificación local por bloque al empezar, canal `bloques`, importancia alta), `ponerAlarma(minutosLocales)` (plugin `Alarma.poner({hora, minuto, mensaje})` → `AlarmClock.ACTION_SET_ALARM` con `EXTRA_SKIP_UI = true`, permiso `com.android.alarm.permission.SET_ALARM`), `escucharVoz()` (`@capacitor-community/speech-recognition`, `es-ES`).

- [ ] **Step 1:** `android.yml` adaptado del de alineadores: appId `io.github.pmorenod16.organizador`, `server.url` `https://pmorenod16.github.io/organizador/?apk=N`, copiar `AlarmaPlugin.java` al proyecto Android y registrarlo en `MainActivity`, añadir el permiso al manifest, firmar y publicar `organizador.apk` en Releases.
- [ ] **Step 2:** En la vista «Mañana», botón «Poner alarma a las HH:MM». En el APK, la alarma se pone sola al guardar el plan de mañana, si la hora ha cambiado.
- [ ] **Step 3:** Verificar en el Xiaomi: instalar el APK, poner la alarma (debe aparecer en la app Reloj), recibir un aviso de bloque con la app cerrada y dictar una entrada por voz.
- [ ] **Step 4:** Commit `feat: APK con avisos, alarma y voz`.

### Task 10: Puesta en marcha y guía

**Files:**
- Create: `GUIA.md`
- Modify: `config.js`, `README.md`

- [ ] **Step 1:** `GUIA.md` con solo los pasos que tiene que hacer el usuario, con capturas o descripciones exactas: crear el proyecto Firebase `organizador` (Auth Google + Firestore), copiar su configuración, crear la clave de Gemini en AI Studio, iniciar sesión en Cloudflare para desplegar el Worker (`npx wrangler deploy` + `wrangler secret put GEMINI_API_KEY`) y sacar los enlaces iCal (Google Calendar → Configuración → «Dirección secreta en formato iCal»; Moodle → Calendari → Exporta).
- [ ] **Step 2:** Rellenar `config.js` (`OWNER_UID` tras el primer login), desplegar las reglas, el Worker y Pages, y lanzar el workflow del APK.
- [ ] **Step 3:** Prueba completa con sus datos reales: plan de mañana con hora de levantarse correcta, clases reales y trayectos.
- [ ] **Step 4:** Commit `docs: guía de puesta en marcha`.
