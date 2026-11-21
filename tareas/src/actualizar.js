// Actualización automática, como en el Armario: la app (web y APK, que carga la web publicada) mira si
// hay una versión nueva al abrirse, al volver a la app y cada 30 min; si la hay, se recarga sola.
import { toast, hayHoja } from "./ui.js";

export let VERSION = null;
let comprobando = false;

async function publicada() {
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
    return r.ok ? (await r.json()).build : null;
  } catch { return null; }
}

/** Si hay versión nueva, recarga. manual = lo ha pedido el usuario (avisa si no hay nada). */
export async function comprobar({ manual = false } = {}) {
  if (comprobando) return false;
  comprobando = true;
  try {
    const v = await publicada();
    if (!VERSION) { VERSION = v; if (manual) toast(v ? "Ya tienes la última versión." : "No he podido comprobarlo: revisa la conexión."); return false; }
    if (!v || v === VERSION) { if (manual) toast(v ? "Ya tienes la última versión." : "No he podido comprobarlo: revisa la conexión."); return false; }
    // no recargar dos veces por la misma versión (por si la caché de GitHub tarda en soltarla)
    let intentada = ""; try { intentada = sessionStorage.getItem("tasca.upd") || ""; } catch {}
    if (intentada === v && !manual) return false;
    // no cortar lo que esté haciendo (una ficha abierta o escribiendo): se aplicará al volver
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if ((hayHoja() || escribiendo) && !manual) return false;
    try { sessionStorage.setItem("tasca.upd", v); } catch {}
    try { await (await navigator.serviceWorker?.getRegistration())?.update(); } catch {}
    const url = new URL(location.href);
    url.searchParams.set("v", v);
    location.replace(url.toString());
    return true;
  } finally { comprobando = false; }
}

export function empezar() {
  comprobar(); // guarda la versión con la que se ha abierto
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") comprobar(); });
  setInterval(() => comprobar(), 30 * 60 * 1000);
}
