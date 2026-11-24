// Eventos de Google Calendar (y cualquier calendario iCal: horarios de la UdG, exámenes…), solo lectura,
// como hace Todoist. El navegador no puede descargar los .ics directamente (CORS), así que se piden al
// Worker del Organizador, y aquí se expanden (repeticiones, excepciones, zonas horarias).
import { WORKER_URL } from "../../config.js";
import { expandir } from "../../src/ical.js";
import { S } from "./datos.js";
import { fechaDe, sumarDias, hoyISO } from "./fechas.js";
import { enlazar } from "./sesiones.js";

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

/** Al abrir la app (o volver a ella): siempre trae los eventos al día, salvo que se acaben de traer hace menos de un minuto */
export const alAbrir = () => recargar(Date.now() - cargado > 60 * 1000);

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
/** Sesiones del día: eventos enlazados con su tarea de estudio */
export const enlacesDia = f => enlazar(f, delDia(f), S.tareas, S.proyectos);
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

/** Avisos para los enlaces que no son la dirección iCal (los errores más típicos al copiarla) */
export function revisarEnlace(url) {
  const u = url.trim();
  if (!/^(https|webcal):\/\//i.test(u)) return "La dirección tiene que empezar por https://";
  if (/calendar\.google\.com/i.test(u) && !/\.ics(\?|$)/i.test(u))
    return "Ese es el enlace para compartir o ver el calendario, no la dirección iCal. En Configuración → tu calendario → «Integrar el calendario», copia la «Dirección secreta en formato iCal» (acaba en .ics).";
  return null;
}
const MOTIVOS = {
  "404": "Google dice que ese calendario no existe. Comprueba que has copiado la «Dirección secreta en formato iCal» entera (lleva «private-»).",
  "403": "Google no deja leer ese calendario. Usa la «Dirección secreta en formato iCal» (lleva «private-»).",
  "401": "Google no deja leer ese calendario. Usa la «Dirección secreta en formato iCal» (lleva «private-»).",
  "no es iCal": "Ese enlace abre una página web, no un calendario iCal. Copia la «Dirección secreta en formato iCal» (acaba en .ics).",
  "solo https": "La dirección tiene que empezar por https://",
};
/** Comprueba un enlace antes de guardarlo. Devuelve null si va bien, o el motivo explicado. */
export async function probar(url) {
  const aviso = revisarEnlace(url);
  if (aviso) return aviso;
  try {
    const t = await token?.();
    const r = await fetch(WORKER_URL.replace(/\/$/, "") + "/calendarios", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ urls: [url] }),
    });
    if (r.status === 401) return "El servidor de calendarios no reconoce tu cuenta. Cierra sesión y vuelve a entrar.";
    if (!r.ok) return `El servidor de calendarios ha fallado (error ${r.status}). Prueba en un rato.`;
    const j = await r.json();
    if (j.calendarios?.length) { try { expandir(j.calendarios[0].texto, new Date(), new Date(Date.now() + 864e5)); return null; } catch { return MOTIVOS["no es iCal"]; } }
    const m = j.motivos?.[url];
    if (/\/public\/basic\.ics/i.test(url) && /^(404|403|401)$/.test(m || ""))
      return "Esa es la «Dirección pública», que solo funciona si el calendario es público. Copia la de justo debajo: la «Dirección secreta en formato iCal» (lleva «private-» en el enlace).";
    return MOTIVOS[m] || (m ? `No he podido leerlo (${m}). Revisa que el enlace esté completo.` : "No he podido leerlo. Revisa que el enlace esté completo.");
  } catch {
    return navigator.onLine ? "No he podido conectar con el servidor de calendarios." : "No tienes conexión.";
  }
}
