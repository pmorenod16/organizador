// Convierte los eventos de los calendarios en bloques fijos del día (EventoFijo)
// y saca las entregas como tareas.
import { aMinutos, fechaLocal } from "./tiempo.js";

export const normal = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const REGLAS = [
  ["practica", /\b(practica|practiques|laboratori|laboratorio|lab)\b/],
  ["examen", /\b(examen|examens|prova|parcial|final)\b/],
  ["entreno", /\b(entreno|entrenament|entrenamiento|handbol|balonmano)\b/],
  ["partido", /\b(partido|partit|futbol)\b/],
];
const OBLIGATORIOS = new Set(["practica", "examen"]);
const ENTREGA = /\b(entrega|lliurament|venciment|vence|due|tancament|termini)\b/;

function tipoDe(titulo) {
  const t = normal(titulo);
  for (const [tipo, re] of REGLAS) if (re.test(t)) return tipo;
  return "clase";
}

function sitioDe(e, perfil) {
  const ub = normal(e.ubicacion);
  if (ub) for (const s of perfil.sitios || []) if (s.id !== perfil.casaId && ub.includes(normal(s.nombre))) return s.id;
  const t = normal(e.titulo);
  for (const a of perfil.asignaturas || []) if (a.nombre && t.includes(normal(a.nombre))) return a.sitioId || null;
  return null;
}

const esMoodle = (e, perfil) => !!perfil.calendarios?.moodle && e.origen === perfil.calendarios.moodle;
const esEntrega = (e, perfil) => esMoodle(e, perfil) || ENTREGA.test(normal(e.titulo));

/**
 * @param {Array} eventos de /eventos
 * @param {string} fecha "YYYY-MM-DD"
 * @param {object} perfil
 * @param {{[idOUid: string]: {obligatorio?: boolean, tipo?: string, asistir?: boolean}}} marcas
 * @returns {import("./tipos.js").EventoFijo[]}
 */
export function clasificar(eventos, fecha, perfil, marcas = {}) {
  const vistos = new Set();
  const salida = [];
  for (const e of eventos) {
    if (e.todoElDia || esEntrega(e, perfil)) continue;
    const inicio = aMinutos(e.inicio, fecha), fin = aMinutos(e.fin, fecha);
    if (fin <= 0 || inicio >= 1440) continue;
    const clave = `${normal(e.titulo)}|${e.inicio}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const id = `${e.uid}@${e.inicio}`;
    const m = { ...(marcas[e.uid] || {}), ...(marcas[id] || {}) };
    const tipo = m.tipo || tipoDe(e.titulo);
    salida.push({
      id, uid: e.uid, titulo: e.titulo, inicio, fin, tipo,
      obligatorio: m.obligatorio ?? OBLIGATORIOS.has(tipo),
      sitioId: sitioDe(e, perfil),
      asistir: m.asistir ?? true,
    });
  }
  return salida.sort((a, b) => a.inicio - b.inicio);
}

/** Entregas del Moodle (o con título de entrega) como tareas con fecha límite. */
export function entregas(eventos, perfil) {
  const vistos = new Set();
  const salida = [];
  for (const e of eventos) {
    if (!esEntrega(e, perfil)) continue;
    const id = `ical:${e.uid}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const fechaLimite = e.todoElDia ? e.inicio : fechaLocal(new Date(e.inicio));
    salida.push({
      id, titulo: e.titulo, tipo: "entrega", fechaLimite, sitioId: null,
      pasos: [{ id: `${id}#1`, titulo: `Preparar: ${e.titulo}`, minutos: 60, hecho: false }],
    });
  }
  return salida;
}
