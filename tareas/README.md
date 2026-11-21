# Tasca

Tareas para estudiar, gratis y tuyas: proyectos por asignatura, tareas con pasos, fechas y repeticiones, calendario, recordatorios, Pomodoro y estadísticas. Importa los CSV de Todoist.

- Web: https://pmorenod16.github.io/organizador/tareas/
- APK de Android: https://github.com/pmorenod16/organizador/releases/download/tasca/tasca.apk

Usa el mismo Firebase, la misma cuenta y la misma clave de firma que el Organizador. Los datos van en `usuarios/<uid>/tasca_*`.

| Archivo | Qué hace |
|---|---|
| `src/main.js` | Arranque, sesión, navegación y eventos |
| `src/datos.js` | Firestore en tiempo real (sin conexión también) |
| `src/logica.js`, `src/fechas.js` | Orden, vistas, subtareas, repeticiones (puro) |
| `src/rapido.js` | Añadido rápido: «Problemas 4-6 mañana 18:00 #TC !2 cada semana» |
| `src/csv.js` | Importar CSV de Todoist (secciones, INDENT → pasos, notas, fechas en/es) |
| `src/pomodoro.js`, `src/enfoque.js`, `src/sonido.js` | Pomodoro, cronómetro, ruido de fondo y estadísticas |
| `src/avisos.js`, `src/nativo.js` | Recordatorios (APK: del sistema; web: con la pestaña abierta) |
| `app/` | Proyecto Capacitor del APK (`.github/workflows/android-tasca.yml`) |

Antes de publicar: `node tareas/scripts/version.mjs` (la app se recarga sola cuando cambia `version.json`; los tests avisan si se olvida).

Tests: `cd tareas && npm test`. Interfaz con Firebase falso: `python3 tareas/test/navegador/probar.py . /tmp/capturas`.

Atajos en el ordenador: `Q` añadir · `/` buscar · `F` enfoque · `Esc` cerrar.
