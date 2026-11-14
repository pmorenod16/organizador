// Worker del Organizador: lee calendarios iCal y habla con Gemini guardando la clave.
import { verificarToken } from "./auth.js";
import { expandir } from "./ical.js";

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

async function eventos(req, body, { fetchFn }) {
  const urls = (body.urls || []).filter(Boolean).map(u => u.trim().replace(/^webcal:\/\//i, "https://"));
  const desde = new Date(body.desde), hasta = new Date(body.hasta);
  const fallidos = [], todos = [];
  await Promise.all(urls.map(async url => {
    try {
      const r = await fetchFn(url);
      if (!r.ok) throw new Error(String(r.status));
      todos.push(...expandir(await r.text(), desde, hasta, url));
    } catch {
      fallidos.push(url);
    }
  }));
  todos.sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  return json(req, { eventos: todos, fallidos });
}

export function crearApp({ verificar, fetchFn = (u, o) => fetch(u, o), rutas = {} } = {}) {
  return {
    async fetch(req, env) {
      if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
      if (req.method !== "POST") return json(req, { error: "método" }, 405);
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
      const ok = verificar
        ? await verificar(token)
        : await verificarToken(token, { projectId: env.FIREBASE_PROJECT_ID, ownerUid: env.OWNER_UID });
      if (!ok) return json(req, { error: "no autorizado" }, 401);
      let body;
      try { body = await req.json(); } catch { return json(req, { error: "cuerpo no válido" }, 400); }
      const ruta = new URL(req.url).pathname;
      if (ruta === "/eventos") return eventos(req, body, { fetchFn });
      if (rutas[ruta]) return rutas[ruta](req, body, env, { json: (d, s) => json(req, d, s), fetchFn });
      return json(req, { error: "ruta" }, 404);
    },
  };
}

export default crearApp();
