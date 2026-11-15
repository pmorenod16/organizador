// Llamadas al Worker (calendarios e IA). El token de Firebase demuestra que eres tú.
import { WORKER_URL } from "../config.js?v=202611150744";
import { expandir } from "./ical.js?v=202611150744";

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

/** Descarga los calendarios (vía Worker) y los expande aquí. @returns {Promise<{eventos: object[], fallidos: string[]}>} */
export async function eventos(urls, desde, hasta) {
  const r = await post("/calendarios", { urls });
  const fallidos = [...(r.fallidos || [])];
  const todos = [];
  for (const c of r.calendarios || []) {
    try { todos.push(...expandir(c.texto, new Date(desde + "T00:00:00"), new Date(hasta + "T23:59:59"), c.url)); }
    catch { fallidos.push(c.url); }
  }
  todos.sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  return { eventos: todos, fallidos };
}

/** @returns {Promise<object>} JSON crudo de la IA ({acciones}); validar con acciones.validar */
export const entrada = (texto, { fecha, fechaVista, ahora, contexto }) => post("/ia/entrada", { texto, fecha, fechaVista, ahora, contexto });
