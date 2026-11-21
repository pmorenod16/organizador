// Eventos de Google Calendar (y cualquier calendario iCal: horarios de la UdG, exámenes…), solo lectura,
// como hace Todoist. El navegador no puede descargar los .ics directamente (CORS), así que se piden al
// Worker del Organizador, y aquí se expanden (repeticiones, excepciones, zonas horarias).
import { WORKER_URL } from "../../config.js";
import { expandir } from "../../src/ical.js";
import { S } from "./datos.js";
import { fechaDe, sumarDias, hoyISO } from "./fechas.js";

const LS = "tasca.eventos";
const DIAS_ATRAS = 7, DIAS_DELANTE = 70, CADA = 30 * 60 * 1000;
export const COLORES_CAL = ["#039BE5", "#7986CB", "#33B679", "#8E24AA", "#E67C73", "#F6BF26", "#F4511E", "#0B8043", "#3F51B5", "#616161"];

let eventos = [], cargado = 0, cargando = null, ultimoError = null;
try { const c = JSON.parse(localStorage.getItem(LS) || "null"); if (c) { eventos = c.eventos; cargado = c.t; } } catch {}
const oyentes = new Set();
export const alCambiarEventos = fn => oyentes.add(fn);
export const error = () => ultimoError;
export const cargadoEn = () => cargado;

let token = null;
export const usarToken = fn => { token = fn; };

export const lista = () => (S.ajustes.calendarios || []).filter(c => c.url);
const activos = () => (S.ajustes.verEventos === false ? [] : lista().filter(c => c.activo !== false));
const firma = () => activos().map(c => c.url).join("|");

/** Descarga y expande los calendarios (si hace falta o si se fuerza) */
export function recargar(forzar = false) {
  const cals = activos();
  if (!cals.length) { if (eventos.length) { eventos = []; oyentes.forEach(f => f()); } return Promise.resolve(); }
  if (!forzar && Date.now() - cargado < CADA && cargadoFirma === firma()) return Promise.resolve();
  return (cargando ||= (async () => {
    try {
      const t = await token?.();
      const r = await fetch(WORKER_URL.replace(/\/$/, "") + "/calendarios", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
        body: JSON.stringify({ urls: cals.map(c => c.url) }),
      });
      if (!r.ok) throw new Error(r.status === 401 ? "sin permiso" : "error " + r.status);
      const { calendarios, fallidos } = await r.json();
      const desde = new Date(Date.now() - DIAS_ATRAS * 864e5), hasta = new Date(Date.now() + DIAS_DELANTE * 864e5);
      const nuevos = [];
      for (const c of calendarios) {
        const cfg = cals.find(x => x.url === c.url);
        try { for (const e of expandir(c.texto, desde, hasta, c.url)) nuevos.push(simplificar(e, cfg)); }
        catch (e) { console.warn("calendario", c.url, e); fallidos.push(c.url); }
      }
      eventos = nuevos; cargado = Date.now(); cargadoFirma = firma();
      ultimoError = fallidos.length ? `No he podido leer ${fallidos.length === 1 ? "un calendario" : fallidos.length + " calendarios"}: revisa el enlace en Ajustes.` : null;
      try { localStorage.setItem(LS, JSON.stringify({ eventos, t: cargado, firma: cargadoFirma })); } catch {}
    } catch (e) {
      ultimoError = navigator.onLine ? `No se han podido cargar los calendarios (${e.message}).` : null;
    } finally { cargando = null; oyentes.forEach(f => f()); }
  })());
}
let cargadoFirma = (() => { try { return JSON.parse(localStorage.getItem(LS) || "{}").firma || ""; } catch { return ""; } })();

function simplificar(e, cfg) {
  const ini = e.todoElDia ? e.inicio : fechaDe(new Date(e.inicio)) + "T" + new Date(e.inicio).toTimeString().slice(0, 5);
  let fin;
  if (e.todoElDia) fin = sumarDias(e.fin.slice(0, 10), -1); // en iCal el fin de un evento de todo el día no se incluye
  else fin = fechaDe(new Date(e.fin)) + "T" + new Date(e.fin).toTimeString().slice(0, 5);
  return { id: e.uid + "|" + e.inicio, titulo: e.titulo || "(Sin título)", desc: e.desc, lugar: e.ubicacion, todoElDia: e.todoElDia, ini, fin, url: cfg?.url || e.origen };
}

/** Eventos de un día, ordenados (los de todo el día primero) */
export function delDia(f) {
  if (S.ajustes.verEventos === false) return [];
  const cfg = new Map(activos().map(c => [c.url, c]));
  return eventos.filter(e => cfg.has(e.url) && e.ini.slice(0, 10) <= f && e.fin.slice(0, 10) >= f)
    .map(e => ({ ...e, cal: cfg.get(e.url).nombre || "Calendario", color: cfg.get(e.url).color || COLORES_CAL[0] }))
    .sort((a, b) => Number(b.todoElDia) - Number(a.todoElDia) || (a.ini < b.ini ? -1 : 1));
}
export const horaDe = (e, f) => (e.todoElDia ? "Todo el día" : `${e.ini.slice(0, 10) === f ? e.ini.slice(11) : "…"}–${e.fin.slice(0, 10) === f ? e.fin.slice(11) : "…"}`);

/** Primera vez: copia los calendarios que ya tenías puestos en el Organizador */
export async function importarDelOrganizador(F, db, uid) {
  try {
    const s = await F.getDoc(F.doc(db, "usuarios", uid, "perfil", "actual"));
    const c = s.exists() ? s.data().calendarios || {} : {};
    const nombres = { google: "Google Calendar", google2: "Google Calendar (otra cuenta)", examenes: "Exámenes", moodle: "Moodle" };
    return Object.entries(c).filter(([, u]) => u && u.trim()).map(([k, u], i) => ({ url: u.trim(), nombre: nombres[k] || k, color: COLORES_CAL[i % COLORES_CAL.length], activo: true }));
  } catch { return []; }
}
export const hoy = hoyISO;
