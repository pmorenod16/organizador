// Importar los CSV de Todoist (TYPE, CONTENT, DESCRIPTION, PRIORITY, INDENT, …, DATE, DURATION…).
import { sumarDias, diaSemana, fechaDe, esFecha } from "./fechas.js";

/** CSV → filas (arrays). Comillas, saltos de línea dentro de comillas, BOM y separador , ; o tab. */
export function leerCSV(texto) {
  texto = texto.replace(/^﻿/, "");
  const primera = texto.split(/\r?\n/, 1)[0];
  const sep = [",", ";", "\t"].map(c => [c, primera.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const filas = []; let fila = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += c;
    } else if (c === '"' && campo === "") comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some(x => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some(x => x !== "")) filas.push(fila);
  return filas;
}

const MES = { jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12 };
const DIA = { monday: 0, mon: 0, lunes: 0, tuesday: 1, tue: 1, martes: 1, wednesday: 2, wed: 2, miercoles: 2, thursday: 3, thu: 3, jueves: 3, friday: 4, fri: 4, viernes: 4, saturday: 5, sat: 5, sabado: 5, sunday: 6, sun: 6, domingo: 6 };
const sinAcentos = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const hh = (h, m = "00", ap) => {
  let H = Number(h);
  if (ap) { ap = ap.toLowerCase(); if (ap === "pm" && H < 12) H += 12; if (ap === "am" && H === 12) H = 0; }
  return H <= 23 && Number(m) <= 59 ? `${String(H).padStart(2, "0")}:${String(m).padStart(2, "0")}` : null;
};

/** Fecha de Todoist (en/es): «2026-11-23 10:00», «23/11/2026», «Nov 23 2026 10am», «today», «every monday»… */
export function leerFechaTodoist(texto, hoy) {
  const r = { fecha: null, hora: null, repetir: null };
  let s = sinAcentos((texto || "").trim());
  if (!s) return r;
  // hora
  s = s.replace(/(?:\s|^)(?:at\s+|a las\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?(?=\s|$)/, (_, h, m, ap) => { r.hora = hh(h, m, ap); return " "; })
       .replace(/(?:\s|^)(?:at\s+)?(\d{1,2})\s*(am|pm)(?=\s|$)/, (_, h, ap) => { r.hora = hh(h, "00", ap); return " "; })
       .replace(/T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?Z?/i, (_, h, m) => { r.hora = hh(h, m); return " "; })
       .trim();
  // repetición
  let m;
  if ((m = s.match(/^(?:every|cada|todos los|todas las)\s+(?:(\d+)\s+)?(day|days|dia|dias|week|weeks|semana|semanas|month|months|mes|meses|year|years|ano|anos|workday|weekday|laborable|dia laborable)s?\b/))) {
    const u = m[2];
    const cada = /work|weekday|labor/.test(u) ? "laborables" : /^(day|dia)/.test(u) ? "dia" : /^(week|semana)/.test(u) ? "semana" : /^(month|mes)/.test(u) ? "mes" : "año";
    r.repetir = { cada, n: Number(m[1] || 1) };
    r.fecha = cada === "laborables" ? siguienteLaborable(hoy) : hoy;
    const desde = s.match(/(?:starting|desde|empezando)\s+(.*)$/);
    if (desde) { const f = leerFechaTodoist(desde[1], hoy).fecha; if (f) r.fecha = f; }
    return r;
  }
  if ((m = s.match(/^(?:every|cada|todos los)\s+([a-z]+)/)) && (DIA[m[1]] ?? DIA[m[1].replace(/s$/, "")]) !== undefined) {
    r.repetir = { cada: "semana", n: 1 };
    r.fecha = proximoDia(hoy, DIA[m[1]] ?? DIA[m[1].replace(/s$/, "")], true);
    return r;
  }
  if (/^(today|hoy|tod)$/.test(s)) r.fecha = hoy;
  else if (/^(tomorrow|manana|tom)$/.test(s)) r.fecha = sumarDias(hoy, 1);
  else if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) r.fecha = valida(m[1], m[2], m[3]);
  else if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) r.fecha = valida(m[3].length === 2 ? "20" + m[3] : m[3], m[2], m[1]); // dd/mm/aaaa (formato europeo)
  else if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})$/))) r.fecha = conAño(m[2], m[1], hoy);
  else if ((m = s.match(/^(?:[a-z]+,?\s+)?([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/)) && MES[m[1]]) r.fecha = m[3] ? valida(m[3], MES[m[1]], m[2]) : conAño(MES[m[1]], m[2], hoy);
  else if ((m = s.match(/^(?:[a-z]+,?\s+)?(\d{1,2})\s+(?:de\s+)?([a-z]{3})[a-z]*\.?(?:\s+(?:de\s+)?(\d{4}))?$/)) && MES[m[2]]) r.fecha = m[3] ? valida(m[3], MES[m[2]], m[1]) : conAño(MES[m[2]], m[1], hoy);
  else if (DIA[s] !== undefined) r.fecha = proximoDia(hoy, DIA[s]);
  if (!r.fecha && r.hora) r.fecha = hoy;
  return r;
}
function valida(a, m, d) { const x = new Date(Number(a), Number(m) - 1, Number(d)); return x.getMonth() === Number(m) - 1 ? fechaDe(x) : null; }
function conAño(m, d, hoy) { const a = Number(hoy.slice(0, 4)); let f = valida(a, m, d); if (f && f < sumarDias(hoy, -60)) f = valida(a + 1, m, d); return f; }
function proximoDia(hoy, ds, incluirHoy = false) { let f = incluirHoy ? hoy : sumarDias(hoy, 1); for (let i = 0; i < 7 && diaSemana(f) !== ds; i++) f = sumarDias(f, 1); return f; }
function siguienteLaborable(hoy) { let f = hoy; while (diaSemana(f) > 4) f = sumarDias(f, 1); return f; }

/**
 * Filas de un CSV de Todoist → tareas con su jerarquía.
 * Devuelve { tareas: [{ ref, padreRef, titulo, notas, prioridad, fecha, hora, repetir, duracion, seccion, etiquetas, orden }], avisos: [] }
 */
export function deTodoist(texto, hoy) {
  const filas = leerCSV(texto);
  if (!filas.length) return { tareas: [], avisos: ["El archivo está vacío."] };
  const cab = filas[0].map(c => c.trim().toUpperCase());
  const col = n => cab.indexOf(n);
  const iT = col("TYPE"), iC = col("CONTENT");
  if (iT < 0 || iC < 0) return { tareas: [], avisos: ["No parece un CSV de Todoist (faltan las columnas TYPE y CONTENT)."] };
  const iD = col("DESCRIPTION"), iP = col("PRIORITY"), iI = col("INDENT"), iF = col("DATE"), iDu = col("DURATION"), iDuU = col("DURATION_UNIT"), iDL = col("DEADLINE");
  const tareas = [], avisos = [], pila = []; // pila[nivel-1] = ref de la última tarea de ese nivel
  let seccion = null, n = 0;
  for (const f of filas.slice(1)) {
    const tipo = (f[iT] || "").trim().toLowerCase();
    const contenido = (f[iC] || "").trim();
    if (tipo === "section") { seccion = contenido || null; pila.length = 0; continue; }
    if (tipo === "note") { const ult = tareas[tareas.length - 1]; if (ult && contenido) ult.notas = (ult.notas ? ult.notas + "\n\n" : "") + contenido; continue; }
    if (tipo !== "task" || !contenido) continue;
    const nivel = Math.max(1, Number(f[iI]) || 1);
    const ref = "t" + (++n);
    const padreRef = nivel > 1 ? pila[Math.min(nivel - 1, pila.length) - 1] || null : null;
    pila.length = Math.min(pila.length, nivel - 1); pila[nivel - 1] = ref;
    const etiquetas = [];
    const titulo = contenido.replace(/(?:^|\s)@([\p{L}\d_-]+)/gu, (_, e) => { etiquetas.push(e); return ""; }).trim() || contenido;
    const p = Number(f[iP]);
    const fechaTxt = iF >= 0 ? f[iF] : "";
    const fx = leerFechaTodoist(fechaTxt, hoy);
    if (fechaTxt && !fx.fecha) avisos.push(`No he entendido la fecha «${fechaTxt}» de «${titulo}»: la dejo sin fecha.`);
    let duracion = iDu >= 0 ? Number(f[iDu]) || null : null;
    if (duracion && /day/i.test(f[iDuU] || "")) duracion *= 24 * 60;
    let notas = iD >= 0 ? (f[iD] || "").trim() : "";
    if (iDL >= 0 && f[iDL]) notas = (notas ? notas + "\n\n" : "") + "Fecha límite: " + f[iDL];
    tareas.push({ ref, padreRef, titulo, notas, prioridad: p >= 1 && p <= 4 ? p : 4, fecha: fx.fecha, hora: fx.hora, repetir: fx.repetir, duracion, seccion, etiquetas, orden: n });
  }
  return { tareas, avisos };
}

/** Nombre del proyecto a partir del archivo: «Teoria de Circuits.csv» → «Teoria de Circuits» */
export const nombreDeArchivo = nombre => nombre.replace(/\.csv$/i, "").replace(/[_]+/g, " ").replace(/\s*\(\d+\)$/, "").trim() || "Importado";
