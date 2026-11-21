// Añadido rápido: «Problemas 1-3 mañana 18:00 #TC !1 cada semana» → tarea.
import { sumarDias, diaSemana, fechaDe, esFecha } from "./fechas.js";
import { normal } from "./logica.js";

const DIAS = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6, lun: 0, mar: 1, mie: 2, jue: 3, vie: 4, sab: 5, dom: 6 };
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

/** Proyecto que encaja con «#tc», «#teoria» o «#circuits»: nombre que empieza igual, iniciales o palabra. */
export function buscarProyecto(texto, proyectos) {
  const q = normal(texto.replace(/^#/, "")).replace(/[_-]/g, " ").trim();
  if (!q) return null;
  const cands = proyectos.filter(p => !p.archivado);
  const ini = p => normal(p.nombre).split(/\s+/).filter(w => w.length > 2 || /^[A-Z]/.test(w)).map(w => w[0]).join("");
  return cands.find(p => normal(p.nombre) === q)
    || cands.find(p => ini(p) === q.replace(/\s/g, ""))
    || cands.find(p => normal(p.nombre).startsWith(q))
    || cands.find(p => normal(p.nombre).split(/\s+/).some(w => w.startsWith(q)))
    || null;
}

/**
 * Lee fecha, hora, proyecto, prioridad, etiquetas y repetición del texto.
 * Devuelve { titulo, fecha, hora, proyectoId, prioridad, etiquetas, repetir, trozos } (trozos = lo reconocido, para enseñarlo).
 */
export function analizar(texto, { hoy, proyectos = [] }) {
  let s = " " + texto.trim() + " ";
  const r = { fecha: null, hora: null, proyectoId: null, prioridad: 4, etiquetas: [], repetir: null, trozos: [] };
  const quitar = (re, fn) => {
    s = s.replace(re, (...m) => { const ok = fn(...m); if (ok === false) return m[0]; r.trozos.push(m[0].trim()); return " "; });
  };

  // proyecto (#nombre, admite #"nombre con espacios")
  quitar(/\s#"([^"]+)"(?=\s)|\s#([\p{L}\d_-]+)(?=\s)/u, (_, a, b) => { const p = buscarProyecto(a || b, proyectos); if (!p) return false; r.proyectoId = p.id; });
  // prioridad !1..!4 o p1..p4
  quitar(/\s(?:!|p)([1-4])(?=\s)/i, (_, n) => { r.prioridad = Number(n); });
  // etiquetas @algo
  quitar(/\s@([\p{L}\d_-]+)(?=\s)/gu, (_, e) => { r.etiquetas.push(e); });
  // repetición
  quitar(/\s(?:cada|todos los|todas las)\s+(\d+\s+)?(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?|laborables|d[ií]as laborables)(?=\s)/i, (_, n, u) => {
    const un = normal(u);
    const cada = un.startsWith("labor") || un.includes("laborables") ? "laborables" : un.startsWith("dia") ? "dia" : un.startsWith("semana") ? "semana" : un.startsWith("mes") ? "mes" : "año";
    r.repetir = { cada, n: n ? Number(n) : 1 };
  });
  quitar(/\s(?:cada\s+|todos los\s+)(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)(?=\s)/i, (_, d) => {
    r.repetir = { cada: "semana", n: 1 };
    const ds = DIAS[normal(d)] ?? DIAS[normal(d).replace(/s$/, "")];
    let f = hoy; for (let i = 0; i < 7 && diaSemana(f) !== ds; i++) f = sumarDias(f, 1);
    r.fecha = f;
  });
  quitar(/\s(?:a diario|diariamente)(?=\s)/i, () => { r.repetir = { cada: "dia", n: 1 }; });

  // hora: 18:00, 18h, 18h30, a las 6, 6pm («3.2» o «1-3» no son horas ni fechas: son apartados y problemas)
  quitar(/\s(?:a las\s+)?([01]?\d|2[0-3])(?::|h)([0-5]\d)(?=\s)/i, (_, h, m) => { r.hora = `${h.padStart(2, "0")}:${m}`; });
  if (!r.hora) quitar(/\s(?:a las\s+([01]?\d|2[0-3])|([01]?\d|2[0-3])h|(\d{1,2})\s?(am|pm))(?=\s)/i, (_, a, b, c, ap) => {
    let h = Number(a ?? b ?? c);
    if (ap) { if (h > 12) return false; if (ap.toLowerCase() === "pm" && h < 12) h += 12; if (ap.toLowerCase() === "am" && h === 12) h = 0; }
    else if (a && h < 8) h += 12;          // «a las 6» por la tarde
    r.hora = `${String(h).padStart(2, "0")}:00`;
  });

  // fecha
  if (!r.fecha) {
    const hoyN = Number(hoy.slice(0, 4));
    quitar(/\s(pasado ma[ñn]ana)(?=\s)/i, () => { r.fecha = sumarDias(hoy, 2); });
    if (!r.fecha) quitar(/\s(hoy|esta (?:tarde|noche))(?=\s)/i, () => { r.fecha = hoy; });
    if (!r.fecha) quitar(/\s(ma[ñn]ana)(?=\s)/i, () => { r.fecha = sumarDias(hoy, 1); });
    if (!r.fecha) quitar(/\sen\s+(\d+)\s+(d[ií]as?|semanas?)(?=\s)/i, (_, n, u) => { r.fecha = sumarDias(hoy, Number(n) * (normal(u).startsWith("sem") ? 7 : 1)); });
    if (!r.fecha) quitar(/\s(?:el\s+|este\s+|próximo\s+|proximo\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?=\s)/i, (_, d) => {
      const ds = DIAS[normal(d)];
      let f = sumarDias(hoy, 1); for (let i = 0; i < 7 && diaSemana(f) !== ds; i++) f = sumarDias(f, 1);
      r.fecha = f;
    });
    if (!r.fecha) quitar(/\s(\d{4}-\d{2}-\d{2})(?=\s)/, (_, f) => { if (!esFecha(f)) return false; r.fecha = f; });
    if (!r.fecha) quitar(/\s(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (_, d, m, a) => {
      const f = fechaValida(d, m, a, hoy, hoyN); if (!f) return false; r.fecha = f;
    });
    if (!r.fecha) quitar(/\s(?:el\s+)?(\d{1,2})\s+(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?(?:\s+(?:de\s+)?(\d{4}))?(?=\s)/i, (_, d, m, a) => {
      const f = fechaValida(d, MESES[m.toLowerCase().slice(0, 3)], a, hoy, hoyN); if (!f) return false; r.fecha = f;
    });
  }
  if (r.hora && !r.fecha) r.fecha = hoy;
  if (r.repetir && !r.fecha) r.fecha = hoy;
  r.titulo = s.replace(/\s+/g, " ").trim();
  return r;
}

function fechaValida(d, m, a, hoy, hoyN) {
  d = Number(d); m = Number(m);
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  let año = a ? Number(a.length === 2 ? "20" + a : a) : hoyN;
  const x = new Date(año, m - 1, d);
  if (x.getMonth() !== m - 1) return null;
  let f = fechaDe(x);
  if (!a && f < sumarDias(hoy, -60)) f = fechaDe(new Date(año + 1, m - 1, d)); // «10/01» en noviembre = enero que viene
  return f;
}
