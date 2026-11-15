// Puente con Android (Capacitor): avisos, alarma y voz. En la web, la voz usa el navegador
// y los avisos y la alarma no hacen nada.
import { deMinutos, hhmm } from "./tiempo.js?v=202611150839";

export const esNativo = () => !!(window.Capacitor?.isNativePlatform?.());

// La app carga la web desde internet; el puente nativo no trae registerPlugin, así que se usa
// @capacitor/core (copia local). Un plugin responde a cualquier método, también a «then»:
// nunca se devuelve directamente desde una promesa, se guarda dentro de { p }.
const plugins = {};
function plug(nombre) {
  return plugins[nombre] ||= (async () => {
    const reg = typeof window.Capacitor?.registerPlugin === "function" ? window.Capacitor.registerPlugin : (await import("../capacitor-core.js?v=202611150839")).registerPlugin;
    return { p: reg(nombre) };
  })();
}
const llamar = async (nombre, metodo, ...args) => (await plug(nombre)).p[metodo](...args);

const AVISOS = new Set(["estudio", "gym", "flexible", "clase", "practica", "examen", "trabajo", "entreno", "partido", "trayecto", "descanso", "comida"]);

/** Programa un aviso al empezar cada bloque que queda por delante, de uno o varios días (borra los anteriores). */
export async function programarAvisos(planes) {
  if (!esNativo()) return;
  try {
    const perm = await llamar("LocalNotifications", "checkPermissions");
    if (perm.display !== "granted") await llamar("LocalNotifications", "requestPermissions");
    await llamar("LocalNotifications", "createChannel", { id: "bloques", name: "Bloques del día", description: "Aviso al empezar cada cosa del plan", importance: 4, vibration: true });
    const pend = await llamar("LocalNotifications", "getPending");
    if (pend.notifications?.length) await llamar("LocalNotifications", "cancel", { notifications: pend.notifications.map(n => ({ id: n.id })) });
    const ahora = Date.now();
    const notifications = [].concat(planes).flatMap((plan, d) => plan.bloques
      .filter(b => AVISOS.has(b.tipo))
      .map((b, i) => ({ b, i: d * 200 + i, at: deMinutos(b.inicio, plan.fecha) })))
      .filter(x => x.at.getTime() > ahora + 30000)
      .slice(0, 60)
      .map(({ b, i, at }) => ({
        id: 1000 + i, channelId: "bloques",
        title: `${hhmm(b.inicio)} · ${b.titulo}`,
        body: b.tipo === "trayecto" ? "Sal ya para llegar con margen." : `Hasta las ${hhmm(b.fin)}`,
        schedule: { at, allowWhileIdle: true },
      }));
    if (notifications.length) await llamar("LocalNotifications", "schedule", { notifications });
  } catch (e) {
    console.warn("avisos", e);
  }
}

/** Pone una alarma de verdad en la app Reloj de Android. */
export async function ponerAlarma(minutos, mensaje = "Organizador: hora de levantarse") {
  if (!esNativo()) return false;
  const m = ((minutos % 1440) + 1440) % 1440;
  await llamar("Alarma", "poner", { hora: Math.floor(m / 60), minuto: m % 60, mensaje });
  return true;
}

/** Escucha una frase y la devuelve como texto. */
export async function escucharVoz() {
  if (esNativo()) {
    const perm = await llamar("SpeechRecognition", "checkPermissions");
    if (perm.speechRecognition !== "granted") await llamar("SpeechRecognition", "requestPermissions");
    const r = await llamar("SpeechRecognition", "start", { language: "es-ES", maxResults: 1, partialResults: false, popup: true });
    return r?.matches?.[0] || "";
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) throw new Error("Este navegador no permite dictar. Escríbelo.");
  return new Promise((ok, mal) => {
    const sr = new SR();
    sr.lang = "es-ES"; sr.interimResults = false; sr.maxAlternatives = 1;
    sr.onresult = e => ok(e.results[0][0].transcript);
    sr.onerror = e => mal(new Error(e.error === "not-allowed" ? "Permite el micrófono para dictar." : "No te he entendido."));
    sr.onend = () => ok("");
    sr.start();
  });
}
