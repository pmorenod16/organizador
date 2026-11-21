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

// ---------- frases dichas (dictado por voz) ----------
const NUM = { cero: 0, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, "treinta y uno": 31 };
const PAL_NUM = "treinta y uno|" + Object.keys(NUM).filter(k => k !== "treinta y uno").sort((a, b) => b.length - a.length).join("|");
const aNum = w => NUM[normal(w)] ?? Number(w);

/** Deja el texto dictado listo para leerlo: números en letra tras «a las», «en», «cada»…, «hashtag», puntos y comas */
export function prepararHablado(texto) {
  let s = " " + texto.replace(/[.,;!?¡¿]+(?=\s|$)/g, " ").replace(/\s+/g, " ") + " ";
  s = s.replace(/\s(?:hashtag|almohadilla)\s+(?=[\p{L}\d])/giu, " #").replace(/\s(?:arroba)\s+(?=[\p{L}\d])/giu, " @");
  const reNum = new RegExp(`\\s(a las?|a la|en|dentro de|cada|prioridad|el d[ií]a|d[ií]a)\\s+(${PAL_NUM})(?=\\s)`, "giu");
  s = s.replace(reNum, (m, ante, w) => ` ${ante} ${aNum(w)}`);
  return s.trim();
}

/** Asignatura dicha sin «#»: «… de teoría de circuitos», «para fonaments», «proyecto equips» */
const VACIAS = new Set(["de", "del", "d", "i", "y", "la", "el", "les", "los", "las", "l", "a"]);
const CONECTOR = /^(de|del|en|para|proyecto|asignatura|a)$/;
const parecidas = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
export function proyectoDicho(s, proyectos) {
  const toks = [...s.matchAll(/[\p{L}\d'’]+/gu)].map(m => ({ t: normal(m[0]).replace(/['’]/g, ""), i: m.index, f: m.index + m[0].length }));
  let mejor = null;
  for (const p of proyectos.filter(p => !p.archivado)) {
    const W = normal(p.nombre).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !VACIAS.has(w));
    if (!W.length) continue;
    for (let k = 0; k < toks.length; k++) {
      let j = k, w = 0;
      while (j < toks.length && w < W.length) {
        if (w > 0 && VACIAS.has(toks[j].t)) { j++; continue; }
        if (!parecidas(toks[j].t, W[w])) break;
        w++; j++;
      }
      if (!w) continue;
      let c = k - 1;
      while (c >= 0 && VACIAS.has(toks[c].t) && !CONECTOR.test(toks[c].t)) c--;
      const conector = c >= 0 && CONECTOR.test(toks[c].t);
      // todo el nombre, o una palabra larga si va detrás de «de», «para», «proyecto»…
      if (!(w === W.length || (conector && toks[k].t.length >= 6))) continue;
      const desde = conector ? toks[c].i : toks[k].i, hasta = toks[j - 1].f;
      if (!mejor || w > mejor.w) mejor = { p, w, desde, hasta };
    }
  }
  return mejor;
}

/**
 * Lee fecha, hora, proyecto, prioridad, etiquetas y repetición del texto.
 * Devuelve { titulo, fecha, hora, proyectoId, prioridad, etiquetas, repetir, trozos } (trozos = lo reconocido, para enseñarlo).
 */
export function analizar(texto, { hoy, proyectos = [] }) {
  let s = " " + prepararHablado(texto.trim()) + " ";
  const r = { fecha: null, hora: null, proyectoId: null, prioridad: 4, etiquetas: [], repetir: null, trozos: [] };
  const quitar = (re, fn) => {
    s = s.replace(re, (...m) => { const ok = fn(...m); if (ok === false) return m[0]; r.trozos.push(m[0].trim()); return " "; });
  };

  // proyecto (#nombre, admite #"nombre con espacios")
  quitar(/\s#"([^"]+)"(?=\s)|\s#([\p{L}\d_-]+)(?=\s)/u, (_, a, b) => { const p = buscarProyecto(a || b, proyectos); if (!p) return false; r.proyectoId = p.id; });
  // asignatura dicha sin # («de teoría de circuitos»)
  if (!r.proyectoId) { const m = proyectoDicho(s, proyectos); if (m) { r.proyectoId = m.p.id; r.trozos.push(s.slice(m.desde, m.hasta)); s = s.slice(0, m.desde) + " " + s.slice(m.hasta); } }
  // prioridad dicha: «prioridad alta», «prioridad 1», «urgente»
  quitar(/\s(?:con\s+)?prioridad\s+(1|2|3|4|m[aá]xima|urgente|muy alta|alta|media|normal|baja|ninguna)(?=\s)/i, (_, v) => {
    const n = normal(v);
    r.prioridad = /^\d$/.test(n) ? Number(n) : /maxima|urgente|muy alta/.test(n) ? 1 : n === "alta" ? 2 : n === "media" ? 3 : 4;
  });
  quitar(/\s(?:es\s+)?urgente(?=\s)/i, () => { r.prioridad = 1; });
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

  // hora dicha: «a las seis y media de la tarde», «a las 6:00 de la mañana», «a mediodía»
  quitar(/\s(?:a\s+)?mediod[ií]a(?=\s)/i, () => { r.hora = "12:00"; });
  if (!r.hora) quitar(/\s(?:sobre\s+|hacia\s+)?a\s+las?\s+(\d{1,2})(?::([0-5]\d))?(\s+y\s+media|\s+y\s+cuarto|\s+menos\s+cuarto|\s+en\s+punto)?(?:\s+de\s+la\s+(ma[ñn]ana|tarde|noche|madrugada))?(?=\s)/i, (_, h, mm, extra, parte) => {
    let H = Number(h), M = Number(mm || 0);
    if (H > 23 || (parte && H > 12)) return false;
    const e = normal(extra || "").trim();
    if (e === "y media") M = 30; else if (e === "y cuarto") M = 15; else if (e === "menos cuarto") { M = 45; H = (H + 23) % 24; }
    const pt = normal(parte || "");
    if (pt === "tarde" || pt === "noche") { if (H < 12) H += 12; if (pt === "noche" && H === 24) H = 0; }
    else if (pt === "manana" || pt === "madrugada") { if (H === 12) H = 0; }
    else if (H >= 1 && H < 8) H += 12;          // «a las 6» sin más: por la tarde
    r.hora = `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
  });
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
    if (!r.fecha) quitar(/\s(?:la\s+)?(?:semana\s+que\s+viene|pr[oó]xima\s+semana)(?=\s)/i, () => { let f = sumarDias(hoy, 1); while (diaSemana(f) !== 0) f = sumarDias(f, 1); r.fecha = f; });
    if (!r.fecha) quitar(/\s(?:este|el)\s+fin\s+de\s+semana(?=\s)/i, () => { let f = hoy; while (diaSemana(f) !== 5) f = sumarDias(f, 1); r.fecha = f; });
    if (!r.fecha) quitar(/\sdentro\s+de\s+(\d+)\s+(d[ií]as?|semanas?)(?=\s)/i, (_, n, u) => { r.fecha = sumarDias(hoy, Number(n) * (normal(u).startsWith("sem") ? 7 : 1)); });
    if (!r.fecha) quitar(/\s(?:el\s+)?d[ií]a\s+(\d{1,2})(?=\s)(?!\s+de\s+\p{L})/iu, (_, d) => {
      const [a, m] = hoy.split("-").map(Number);
      let f = fechaValida(d, m, String(a), hoy, a); if (f && f < hoy) f = fechaValida(d, m === 12 ? 1 : m + 1, String(m === 12 ? a + 1 : a), hoy, a);
      if (!f) return false; r.fecha = f;
    });
    if (!r.fecha) quitar(/\s(hoy|esta (?:tarde|noche))(?=\s)/i, () => { r.fecha = hoy; });
    if (!r.fecha) quitar(/\s(ma[ñn]ana)(?=\s)/i, () => { r.fecha = sumarDias(hoy, 1); });
    if (!r.fecha) quitar(/\sen\s+(\d+)\s+(d[ií]as?|semanas?)(?=\s)/i, (_, n, u) => { r.fecha = sumarDias(hoy, Number(n) * (normal(u).startsWith("sem") ? 7 : 1)); });
    if (!r.fecha) quitar(/\s(?:el\s+|este\s+|próximo\s+|proximo\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?:\s+que\s+viene)?(?=\s)/i, (_, d) => {
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
  // lo que sobra al quitar trozos dichos («Comprar pan para», «… de»)
  r.titulo = s.replace(/\s+/g, " ").trim().replace(/(\s+(de|del|para|en|a|el|la|y|que|con|por))+$/i, "").trim();
  if (r.titulo) r.titulo = r.titulo[0].toUpperCase() + r.titulo.slice(1);
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
