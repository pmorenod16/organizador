// Convierte los eventos de los calendarios en bloques fijos del día (EventoFijo)
// y saca las entregas como tareas.
import { aMinutos, fechaLocal, sumarDias } from "./tiempo.js?v=202611150820";

export const normal = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const REGLAS = [
  ["trabajo", /\b(feina|treball|trabajo)\b/],
  ["practica", /\b(practica|practiques|laboratori|laboratorio|lab)\b/],
  ["examen", /\b(examen|examens|prova|parcial|final)\b/],
  ["entreno", /\b(entreno|entrenament|entrenamiento|handbol|balonmano)\b/],
  ["partido", /\b(partido|partit|futbol)\b/],
];
const OBLIGATORIOS = new Set(["practica", "examen", "trabajo"]);
const ENTREGA = /\b(entrega|lliurament|venciment|vence|due|tancament|termini)\b/;

// Lo que no se reconoce por el título es «clase» si coincide con una asignatura o se repite
// cada semana (así son los horarios de clase); si no, «otro» (una cena, una cita…).
function tipoDe(e, perfil) {
  const t = normal(e.titulo);
  for (const [tipo, re] of REGLAS) if (re.test(t)) return tipo;
  if (e.recurrente || (perfil.asignaturas || []).some(a => a.nombre && t.includes(normal(a.nombre)))) return "clase";
  return "otro";
}

const UNIVERSIDAD = new Set(["clase", "practica", "examen"]);
const TRABAJO = "trabajo";

function sitioDe(e, perfil, tipo) {
  const ub = normal(e.ubicacion);
  if (ub) for (const s of perfil.sitios || []) if (s.id !== perfil.casaId && ub.includes(normal(s.nombre))) return s.id;
  const t = normal(e.titulo);
  for (const a of perfil.asignaturas || []) if (a.nombre && t.includes(normal(a.nombre))) return a.sitioId || null;
  // clases, prácticas y exámenes de los calendarios: en el campus por defecto
  if (e.origen !== "manual" && UNIVERSIDAD.has(tipo)) return perfil.campusDefecto ?? perfil.asignaturas?.[0]?.sitioId ?? null;
  if (tipo === TRABAJO) return perfil.trabajoSitioId ?? null;
  return null;
}

const esMoodle = (e, perfil) => !!perfil.calendarios?.moodle && e.origen === perfil.calendarios.moodle;
// Avisos del Moodle que solo dicen que algo se abre (no son fechas límite)
const APERTURA = /(s'obre|\bobre\b|\bopens?\b|se abre|\bapertura\b|\bobertura\b)/;
const esEntrega = (e, perfil) => {
  if (e.tipoManual) return e.tipoManual === "entrega";
  const t = normal(e.titulo);
  if (esMoodle(e, perfil)) return !APERTURA.test(t);
  return ENTREGA.test(t);
};
// Lo que el Moodle publica (también la apertura) no es una clase ni un bloque fijo
const esDelMoodle = (e, perfil) => !e.tipoManual && esMoodle(e, perfil);

/**
 * @param {Array} eventos de /eventos
 * @param {string} fecha "YYYY-MM-DD"
 * @param {object} perfil
 * @param {{[idOUid: string]: {obligatorio?: boolean, tipo?: string, asistir?: boolean}}} marcas
 * @returns {import("./tipos.js?v=202611150820").EventoFijo[]}
 */
export function clasificar(eventos, fecha, perfil, marcas = {}) {
  const vistos = new Set();
  const salida = [];
  for (const e of eventos) {
    if (e.todoElDia || esEntrega(e, perfil) || esDelMoodle(e, perfil)) continue;
    let inicio = aMinutos(e.inicio, fecha);
    const fin = aMinutos(e.fin, fecha);
    if (fin <= 0 || inicio >= 1440) continue;
    // lo que empezó el día anterior: si acaba de madrugada no cuenta; si no, desde las 00:00
    if (inicio < 0) { if (fin <= 6 * 60) continue; inicio = 0; }
    const clave = `${normal(e.titulo)}|${e.inicio}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const id = `${e.uid}@${e.inicio}`;
    const m = { ...(marcas[e.uid] || {}), ...(marcas[id] || {}) };
    const tipo = m.tipo || tipoDe(e, perfil);
    salida.push({
      id, uid: e.uid, titulo: e.titulo, inicio, fin, tipo,
      obligatorio: m.obligatorio ?? OBLIGATORIOS.has(tipo),
      sitioId: sitioDe(e, perfil, tipo),
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
    let fechaLimite = e.todoElDia ? e.inicio : fechaLocal(new Date(e.inicio));
    let horaLimite = e.todoElDia ? null : aMinutos(e.inicio, fechaLimite);
    if (horaLimite === 0) { fechaLimite = sumarDias(fechaLimite, -1); horaLimite = 1440; }  // a las 00:00 = el día anterior
    salida.push({
      id, titulo: e.titulo, tipo: "entrega", fechaLimite, horaLimite, sitioId: null,
      pasos: [{ id: `${id}#1`, titulo: `Preparar: ${e.titulo}`, minutos: 60, hecho: false }],
    });
  }
  return salida;
}
