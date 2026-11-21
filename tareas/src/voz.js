// Dictar tareas con la voz. En la web usa el reconocimiento del navegador (Chrome, Edge, Safari);
// en el APK, el de Android (plugin @capacitor-community/speech-recognition), porque el navegador interno no lo trae.
// En los dos casos la escucha se ve en la pantalla de Tasca (sin la ventana de Google).
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
    // Sin la ventana de Google: se escucha por debajo y el texto sale en nuestra propia pantalla, como en la web.
    // Android avisa del final de la voz antes del resultado definitivo, así que se espera un poco a que llegue;
    // y si se queda callado (o no se entiende nada) se termina solo.
    return new Promise(async (ok, mal) => {
      let texto = "", acabado = false, espera = 0;
      const manejadores = [];
      const terminar = () => {
        if (acabado) return; acabado = true;
        clearTimeout(espera); clearTimeout(limite);
        manejadores.forEach(h => { try { h.remove(); } catch {} });
        llamar("SpeechRecognition", "stop").catch(() => {});
        actual = null; ok(texto.trim() || null);
      };
      const esperar = ms => { clearTimeout(espera); espera = setTimeout(terminar, ms); };
      const limite = setTimeout(terminar, 30000);
      try {
        manejadores.push(await llamar("SpeechRecognition", "addListener", "partialResults", d => { const m = d?.matches?.[0]; if (m) { texto = m; alParcial?.(texto); esperar(2500); } }));
        manejadores.push(await llamar("SpeechRecognition", "addListener", "listeningState", d => { if (d?.status === "stopped") esperar(1200); }));
        actual = { stop: () => esperar(900) };
        esperar(8000); // si en 8 s no se oye nada
        await llamar("SpeechRecognition", "start", { language: "es-ES", maxResults: 1, popup: false, partialResults: true });
      } catch (e) { acabado = true; clearTimeout(espera); clearTimeout(limite); manejadores.forEach(h => { try { h.remove(); } catch {} }); actual = null; mal(e); }
    });
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
