// Worker del Organizador: descarga los calendarios iCal (el móvil no puede por CORS) y habla
// con Gemini guardando la clave. Los calendarios se expanden en el móvil (src/ical.js).
import { usuarioDe } from "./auth.js";

const ORIGENES = ["https://pmorenod16.github.io", "capacitor://localhost", "https://localhost", "http://localhost:8080"];

function cors(req) {
  const o = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.includes(o) ? o : ORIGENES[0],
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req, datos, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { "Content-Type": "application/json", ...cors(req) } });

const MAX_BYTES = 5 * 1024 * 1024;

async function calendarios(req, body, { fetchFn }) {
  const urls = (body.urls || []).filter(Boolean).map(u => String(u).trim()).slice(0, 10);
  const fallidos = [], salida = [], motivos = {};
  await Promise.all(urls.map(async original => {
    const url = original.replace(/^webcal:\/\//i, "https://");
    try {
      if (!/^https:\/\//i.test(url)) throw new Error("solo https");
      const r = await fetchFn(url, { headers: { Accept: "text/calendar" } });
      if (!r.ok) throw new Error(String(r.status));
      if (+(r.headers.get("Content-Length") || 0) > MAX_BYTES) throw new Error("demasiado grande");
      const texto = await r.text();
      if (texto.length > MAX_BYTES) throw new Error("demasiado grande");
      if (!/BEGIN:VCALENDAR/i.test(texto.slice(0, 2000))) throw new Error("no es iCal");
      salida.push({ url: original, texto });
    } catch (e) {
      fallidos.push(original);
      motivos[original] = e.message;
    }
  }));
  return json(req, { calendarios: urls.map(u => salida.find(c => c.url === u)).filter(Boolean), fallidos: urls.filter(u => fallidos.includes(u)), motivos });
}

export function crearApp({ verificar, fetchFn = (u, o) => fetch(u, o), rutas = {} } = {}) {
  return {
    async fetch(req, env) {
      if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
      if (req.method !== "POST") return json(req, { error: "método" }, 405);
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
      // cualquier cuenta que haya entrado en Tasca puede leer sus calendarios; la IA, solo el dueño
      let uid, dueno;
      if (verificar) { dueno = await verificar(token); uid = dueno ? "prueba" : null; }
      else { uid = await usuarioDe(token, { projectId: env.FIREBASE_PROJECT_ID }); dueno = !!uid && uid === env.OWNER_UID; }
      if (!uid) return json(req, { error: "no autorizado" }, 401);
      let body;
      try { body = await req.json(); } catch { return json(req, { error: "cuerpo no válido" }, 400); }
      const ruta = new URL(req.url).pathname;
      if (ruta === "/calendarios") return calendarios(req, body, { fetchFn });
      if (!dueno) return json(req, { error: "no autorizado" }, 403);
      if (rutas[ruta]) return rutas[ruta](req, body, env, { json: (d, s) => json(req, d, s), fetchFn });
      return json(req, { error: "ruta" }, 404);
    },
  };
}

import { rutasIA } from "./gemini.js";
export default crearApp({ rutas: rutasIA });
