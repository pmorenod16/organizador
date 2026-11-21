// Dictar tareas con la voz. En la web usa el reconocimiento del navegador (Chrome, Edge, Safari);
// en el APK, el de Android (plugin @capacitor-community/speech-recognition), porque el navegador interno no lo trae.
import { esNativo, llamar } from "./nativo.js";

const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const hayVoz = () => esNativo() || !!SR();

let actual = null;
export function parar() { try { actual?.stop(); } catch {} }

/** Escucha una frase. alParcial(texto) recibe lo que se va entendiendo (solo en la web). Devuelve el texto o null. */
export async function escuchar({ alParcial } = {}) {
  if (esNativo()) {
    let disp;
    try { disp = await llamar("SpeechRecognition", "available"); }
    catch { throw new Error("apk-viejo"); }
    if (!disp?.available) throw new Error("sin-voz");
    const p = await llamar("SpeechRecognition", "checkPermissions");
    if (p.speechRecognition !== "granted") {
      const q = await llamar("SpeechRecognition", "requestPermissions");
      if (q.speechRecognition !== "granted") throw new Error("sin-permiso");
    }
    const r = await llamar("SpeechRecognition", "start", { language: "es-ES", maxResults: 1, prompt: "Di la tarea", popup: true, partialResults: false });
    return r?.matches?.[0] || null;
  }
  const C = SR(); if (!C) throw new Error("sin-voz");
  return new Promise((ok, mal) => {
    const rec = new C();
    rec.lang = "es-ES"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let texto = "";
    rec.onresult = e => { texto = [...e.results].map(x => x[0].transcript).join(" "); alParcial?.(texto); };
    rec.onerror = e => { actual = null; mal(new Error(e.error === "not-allowed" || e.error === "service-not-allowed" ? "sin-permiso" : e.error === "no-speech" ? "silencio" : e.error)); };
    rec.onend = () => { actual = null; ok(texto.trim() || null); };
    actual = rec;
    rec.start();
  });
}

export const MENSAJES = {
  "apk-viejo": "Para dictar en el móvil hace falta la app nueva: descarga otra vez el APK e instálalo encima.",
  "sin-voz": "Este dispositivo no tiene reconocimiento de voz. En Android, instala o activa la app de Google.",
  "sin-permiso": "Sin permiso para el micrófono. Actívalo en los ajustes del móvil o del navegador.",
  "silencio": "No he oído nada. Prueba otra vez.",
};
