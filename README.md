# Organizador

App personal que dice **qué toca ahora y cómo empezarlo**: lee los calendarios (Google, exámenes, Moodle de la UdG), entiende lo que escribes o dictas, divide las tareas en pasos y organiza el día con trayectos, márgenes, prioridades, descanso y sueño.

- Web: https://pmorenod16.github.io/organizador/
- APK de Android: https://github.com/pmorenod16/organizador/releases/latest/download/organizador.apk
- Puesta en marcha: [GUIA.md](GUIA.md)
- Diseño: [docs/superpowers/specs](docs/superpowers/specs) · Plan: [docs/superpowers/plans](docs/superpowers/plans)

## Estructura

| Carpeta | Qué hay |
|---|---|
| `index.html`, `styles.css`, `src/` | La app (módulos ES sin compilación; Firebase desde CDN) |
| `src/planificador.js` | El organizador del día: puro y determinista |
| `worker/` | Cloudflare Worker: lee y expande los iCal, y llama a Gemini |
| `app/` | Proyecto Capacitor del APK (abre la web y añade avisos, alarma y voz) |
| `scripts/` | Preparación del APK en Firebase y publicación de las reglas |
| `test/`, `worker/test/` | Tests (`npm test` y `cd worker && npx vitest run`) |
