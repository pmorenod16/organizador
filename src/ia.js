// Llamadas al Worker (calendarios e IA). El token de Firebase demuestra que eres tú.
import { WORKER_URL } from "../config.js";

let obtenerToken = async () => "";
export const usarToken = fn => { obtenerToken = fn; };

async function post(ruta, body) {
  let r;
  try {
    r = await fetch(WORKER_URL.replace(/\/$/, "") + ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await obtenerToken()}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Sin conexión con el servidor. ¿Tienes internet?");
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || `Error ${r.status}`);
  return datos;
}

/** @returns {Promise<{eventos: object[], fallidos: string[]}>} */
export const eventos = (urls, desde, hasta) => post("/eventos", { urls, desde, hasta });

/** @returns {Promise<object>} JSON crudo de la IA ({acciones}); validar con acciones.validar */
export const entrada = (texto, { fecha, ahora, contexto }) => post("/ia/entrada", { texto, fecha, ahora, contexto });
