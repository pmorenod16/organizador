// Planificador del día: puro y determinista. La IA propone tareas, pasos y duraciones;
// aquí se decide a qué hora va cada cosa.
//
// Reglas (spec §4): el trabajo y las prácticas no se tocan; prioridad estudios → entrenos/partidos
// → gym y objetivos; si una entrega urgente no cabe se recorta, en este orden, objetivos → descanso
// → sueño (hasta minSleepHours). Entrenos/partidos y clases solo se proponen saltar, nunca se quitan.
import { diaSemana } from "./tiempo.js";

const MAX_BLOQUE = 90;
const MIN_TROZO = 30;
const TARDE = 14 * 60;
const ORDEN_TIPO = { entrega: 0, examen: 1, estudio: 2, otro: 2 };

/** Minutos de trayecto entre dos sitios (null = no se mueve). */
export function trayecto(perfil, a, b) {
  if (!a || !b || a === b) return 0;
  const t = perfil.trayectos?.[`${a}|${b}`] ?? perfil.trayectos?.[`${b}|${a}`];
  return t ?? 15;
}
const conocido = (perfil, a, b) => !a || !b || a === b || perfil.trayectos?.[`${a}|${b}`] != null || perfil.trayectos?.[`${b}|${a}`] != null;

const nombreSitio = (perfil, id) => perfil.sitios?.find(s => s.id === id)?.nombre || id;
const duracion = bs => bs.reduce((s, b) => s + b.fin - b.inicio, 0);

/** Fijos del día: eventos a los que se asiste + trabajo del perfil + retrasos. */
function fijosDelDia({ fecha, fijos, perfil, overrides }) {
  const dia = diaSemana(fecha);
  const trabajo = (perfil.trabajo || []).filter(t => t.diaSemana === dia).map((t, i) => ({
    id: `trabajo-${fecha}-${i}`, titulo: "Trabajo", inicio: t.inicio, fin: t.fin, tipo: "trabajo",
    obligatorio: true, sitioId: t.sitioId || perfil.trabajoSitioId || null, asistir: true,
  }));
  const retrasos = (overrides.retrasos || []).map((r, i) => ({
    id: `retraso-${i}`, titulo: "Imprevisto", inicio: r.desde, fin: r.desde + r.minutos, tipo: "retraso",
    obligatorio: true, sitioId: null, asistir: true,
  }));
  const base = [...fijos.filter(f => f.asistir !== false), ...trabajo, ...retrasos].sort((a, b) => a.inicio - b.inicio);
  // comidas: a su hora; si chocan con algo fijo, justo después (máx. 90 min tarde)
  const margen = perfil.margen ?? 10;
  const comidas = [];
  for (const [i, c] of (perfil.comidas || []).entries()) {
    let ini = c.hora;
    for (const f of base) if (ini < f.fin && ini + c.minutos > f.inicio) ini = f.fin + margen;
    if (ini - c.hora > 90 || base.some(f => ini < f.fin && ini + c.minutos > f.inicio)) continue;
    comidas.push({ id: `comida-${i}`, titulo: c.titulo, inicio: ini, fin: ini + c.minutos, tipo: "comida", obligatorio: false, sitioId: null, asistir: true });
  }
  return [...base, ...comidas].sort((a, b) => a.inicio - b.inicio);
}

/** Parte fija: rutina, hora de levantarse, trayectos, bloques fijos y huecos libres. */
function parteFija(entrada, extraNoche) {
  const { perfil, overrides } = entrada;
  const margen = perfil.margen ?? 10;
  const casa = perfil.casaId;
  const fijos = fijosDelDia(entrada);
  const avisos = [], propuestas = [], bloques = [], huecos = [];
  const rutina = (perfil.rutinaManana || []).reduce((s, r) => s + r.minutos, 0);

  const primero = fijos.find(f => f.tipo !== "retraso" && f.tipo !== "comida");
  let levantarse = perfil.levantarseDefecto;
  if (primero) {
    const salir = primero.inicio - margen - trayecto(perfil, casa, primero.sitioId);
    levantarse = Math.min(levantarse, salir - rutina);
  }
  if (overrides.horaLevantarse != null) levantarse = overrides.horaLevantarse;

  // sueño de la noche anterior
  const h = overrides.horaDormirAnterior ?? perfil.horaDormir;
  const acostarse = h < 12 * 60 ? h : h - 1440;
  const sueno = levantarse - acostarse;
  const minSueno = (perfil.minSleepHours ?? 4) * 60;
  if (sueno < (perfil.horasSueno ?? 8) * 60) {
    avisos.push({ tipo: "sueno-recortado", texto: `Esta noche duermes ${Math.floor(sueno / 60)} h ${sueno % 60} min.` });
  }
  if (sueno <= minSueno && primero && primero.tipo === "clase" && !primero.obligatorio) {
    propuestas.push({ tipo: "saltar-clase", refId: primero.id, motivo: "sueno" });
  }

  let cursor = levantarse;
  for (const r of perfil.rutinaManana || []) {
    bloques.push({ inicio: cursor, fin: cursor + r.minutos, tipo: "rutina", titulo: r.titulo, refId: null, sitioId: casa });
    cursor += r.minutos;
  }

  let sitio = casa;
  for (const f of fijos) {
    const destino = f.sitioId ?? sitio;
    const t = trayecto(perfil, sitio, destino);
    if (!conocido(perfil, sitio, destino)) {
      avisos.push({ tipo: "trayecto-desconocido", texto: `No sé cuánto tardas de ${nombreSitio(perfil, sitio)} a ${nombreSitio(perfil, destino)}; cuento 15 min.` });
    }
    const listo = f.tipo === "retraso" || f.tipo === "comida" ? f.inicio : f.inicio - margen;
    const salida = Math.max(cursor, listo - t);
    if (salida > cursor) huecos.push({ inicio: cursor, fin: salida, sitio });
    if (t > 0) {
      bloques.push({ inicio: salida, fin: salida + t, tipo: "trayecto", titulo: `Ir a ${nombreSitio(perfil, destino)}`, refId: null, sitioId: destino });
      if (salida + t > listo) avisos.push({ tipo: "llegas-tarde", texto: `No llegas con margen a ${f.titulo}.` });
    }
    bloques.push({ inicio: f.inicio, fin: f.fin, tipo: f.tipo, titulo: f.titulo, refId: f.id, sitioId: f.sitioId });
    cursor = Math.max(cursor, salida + t, f.fin);
    sitio = destino;
  }

  if (sitio !== casa) {
    const t = trayecto(perfil, sitio, casa);
    const inicio = cursor + margen;
    bloques.push({ inicio, fin: inicio + t, tipo: "trayecto", titulo: `Volver a ${nombreSitio(perfil, casa)}`, refId: null, sitioId: casa });
    cursor = inicio + t;
  }
  const dormir = perfil.horaDormir + extraNoche;
  if (dormir > cursor) huecos.push({ inicio: cursor, fin: dormir, sitio: casa, ultimo: true });

  return { levantarse, bloques, huecos, avisos, propuestas, fijos };
}

/** Coloca pasos de tareas en los huecos. Devuelve minutos sin colocar por tarea. */
function colocarTareas(tareas, huecos, bloques, margen) {
  const sinColocar = [];
  for (const t of tareas) {
    let pendientes = t.pasos.filter(p => !p.hecho).map(p => ({ id: p.id, min: p.minutos }));
    for (const h of huecos) {
      while (pendientes.length) {
        const ini = h.inicio + margen;
        const libre = Math.min(MAX_BLOQUE, h.fin - ini);
        if (libre <= 0) break;
        const ids = [];
        let usado = 0;
        while (pendientes.length) {
          const p = pendientes[0];
          if (usado + p.min <= libre) { usado += p.min; ids.push(p.id); pendientes.shift(); continue; }
          // paso que no cabe entero: se parte si el bloque está vacío (o es más largo que un bloque)
          if (usado === 0 && (libre >= MIN_TROZO || p.min > MAX_BLOQUE) && libre >= Math.min(MIN_TROZO, p.min)) {
            usado = libre; ids.push(p.id); p.min -= libre;
          }
          break;
        }
        if (!usado) break;
        bloques.push({ inicio: ini, fin: ini + usado, tipo: "estudio", subtipo: t.tipo, titulo: t.titulo, refId: t.id, pasoIds: ids, sitioId: h.sitio });
        h.inicio = ini + usado;
      }
      if (!pendientes.length) break;
    }
    const resto = pendientes.reduce((s, p) => s + p.min, 0);
    if (resto > 0) sinColocar.push({ refId: t.id, minutos: resto, urgente: !!t.urgente });
  }
  return sinColocar;
}

function reservarDescanso(huecos, bloques, minutos, completo) {
  if (!minutos) return 0;
  const tarde = huecos.filter(h => h.fin > TARDE && h.fin - Math.max(h.inicio, TARDE) > 0);
  if (!tarde.length) return 0;
  const h = tarde.reduce((a, b) => (b.fin - b.inicio >= a.fin - a.inicio ? b : a));
  const dur = Math.min(minutos, h.fin - h.inicio);
  if (dur <= 0 || (!completo && dur < minutos && dur < MIN_TROZO)) return 0;
  bloques.push({ inicio: h.fin - dur, fin: h.fin, tipo: "descanso", titulo: "Descanso", refId: null, sitioId: h.sitio });
  h.fin -= dur;
  return dur;
}

function colocarObjetivos(entrada, huecos, bloques, avisos) {
  const { perfil, fecha, semana } = entrada;
  const margen = perfil.margen ?? 10;
  const diasQuedan = 7 - diaSemana(fecha);
  const sinColocar = [];
  for (const o of perfil.objetivos || []) {
    const faltan = o.vecesSemana - (semana?.hechosObjetivo?.[o.id] || 0);
    if (faltan <= 0) continue;
    let puesto = false;
    for (const h of huecos) {
      const ida = trayecto(perfil, h.sitio, o.sitioId), vuelta = ida;
      const ini = h.inicio + margen;
      if (ini + ida + o.minutos + vuelta > h.fin) continue;
      if (ida) bloques.push({ inicio: ini, fin: ini + ida, tipo: "trayecto", titulo: `Ir a ${nombreSitio(perfil, o.sitioId)}`, refId: null, sitioId: o.sitioId });
      bloques.push({ inicio: ini + ida, fin: ini + ida + o.minutos, tipo: o.tipo, titulo: o.titulo, refId: o.id, sitioId: o.sitioId || h.sitio });
      if (vuelta) bloques.push({ inicio: ini + ida + o.minutos, fin: ini + ida + o.minutos + vuelta, tipo: "trayecto", titulo: `Volver a ${nombreSitio(perfil, h.sitio)}`, refId: null, sitioId: h.sitio });
      h.inicio = ini + ida + o.minutos + vuelta;
      puesto = true;
      break;
    }
    if (!puesto) sinColocar.push({ refId: o.id, minutos: o.minutos });
    const restantes = faltan - (puesto ? 1 : 0);
    if (restantes > diasQuedan - 1) {
      avisos.push({ tipo: "objetivo-incumplible", texto: `Esta semana no llegas a ${o.titulo} ${o.vecesSemana} veces (faltan ${faltan}).` });
    }
  }
  return sinColocar;
}

function ordenarTareas(tareas, fecha) {
  const manana = new Date(fecha + "T12:00:00Z"); manana.setUTCDate(manana.getUTCDate() + 1);
  const limiteUrgente = manana.toISOString().slice(0, 10);
  return tareas
    .filter(t => t.pasos?.some(p => !p.hecho) && (!t.fechaLimite || t.fechaLimite >= fecha) && t.tipo !== "gym" && t.tipo !== "flexible")
    .map(t => ({ ...t, urgente: !!t.fechaLimite && t.fechaLimite <= limiteUrgente && (t.tipo === "entrega" || t.tipo === "examen") }))
    .sort((a, b) => (ORDEN_TIPO[a.tipo] ?? 2) - (ORDEN_TIPO[b.tipo] ?? 2)
      || (a.fechaLimite || "9999").localeCompare(b.fechaLimite || "9999"));
}

/** Una pasada completa con unas opciones de recorte. */
function pasada(entrada, { descanso, objetivos, extraNoche }) {
  const { perfil } = entrada;
  const margen = perfil.margen ?? 10;
  const fija = parteFija(entrada, extraNoche);
  const bloques = [...fija.bloques], huecos = fija.huecos, avisos = [...fija.avisos];
  const minDescanso = perfil.descansoMinDia ?? 0;
  // descanso: "reservar" (antes que las tareas), "sobrante" (lo que quede), "nada" (se está recortando sueño)
  let descansado = descanso === "reservar" ? reservarDescanso(huecos, bloques, minDescanso, true) : 0;
  const sinColocar = colocarTareas(ordenarTareas(entrada.tareas || [], entrada.fecha), huecos, bloques, margen);
  if (descanso === "sobrante") descansado = reservarDescanso(huecos, bloques, minDescanso, false);
  if (descansado < minDescanso) {
    avisos.push({ tipo: "descanso-recortado", texto: `Hoy solo tienes ${descansado} min de descanso (quieres ${minDescanso}).` });
  }
  if (objetivos) sinColocar.push(...colocarObjetivos(entrada, huecos, bloques, avisos));
  return { fija, bloques, avisos, sinColocar, propuestas: [...fija.propuestas] };
}

/**
 * @param {{fecha: string, fijos: object[], tareas: object[], perfil: object,
 *   semana?: {hechosObjetivo: object}, overrides?: {retrasos?: {desde:number, minutos:number}[],
 *   horaLevantarse?: number, horaDormirAnterior?: number}}} entrada
 * @returns {{fecha, horaLevantarse, bloques, avisos, propuestas, sinColocar}}
 */
export function planDay(entrada) {
  entrada = { semana: { hechosObjetivo: {} }, overrides: {}, tareas: [], ...entrada };
  entrada.overrides ||= {};
  const { perfil } = entrada;
  const urgenteFuera = r => r.sinColocar.some(s => s.urgente);

  let r = pasada(entrada, { descanso: "reservar", objetivos: true, extraNoche: 0 });
  if (urgenteFuera(r)) {
    r = pasada(entrada, { descanso: "reservar", objetivos: false, extraNoche: 0 });
    if (urgenteFuera(r)) r = pasada(entrada, { descanso: "sobrante", objetivos: false, extraNoche: 0 });
    if (urgenteFuera(r)) {
      const extra = Math.max(0, ((perfil.horasSueno ?? 8) - (perfil.minSleepHours ?? 4)) * 60);
      const antes = r;
      r = pasada(entrada, { descanso: "nada", objetivos: false, extraNoche: extra });
      for (const f of antes.fija.fijos) {
        if (f.tipo === "entreno" || f.tipo === "partido") r.propuestas.push({ tipo: "no-ir", refId: f.id, motivo: "entrega" });
      }
      const fin = Math.max(...r.bloques.filter(b => b.tipo === "estudio").map(b => b.fin), 0);
      if (fin > perfil.horaDormir) {
        r.avisos.push({ tipo: "sueno-recortado", texto: `Para acabar la entrega te acuestas más tarde de lo normal.` });
      }
      if (urgenteFuera(r)) r.avisos.push({ tipo: "entrega-no-cabe", texto: "Hay una entrega urgente que no cabe hoy ni recortando sueño." });
    }
    for (const o of perfil.objetivos || []) {
      if (!r.bloques.some(b => b.refId === o.id) && !r.sinColocar.some(s => s.refId === o.id)) r.sinColocar.push({ refId: o.id, minutos: o.minutos });
    }
  }

  const bloques = r.bloques.sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
  const vistos = new Set();
  const avisos = r.avisos.filter(a => (vistos.has(a.tipo + a.texto) ? false : vistos.add(a.tipo + a.texto)));
  return {
    fecha: entrada.fecha,
    horaLevantarse: r.fija.levantarse,
    bloques,
    avisos,
    propuestas: r.propuestas,
    sinColocar: r.sinColocar.map(({ refId, minutos }) => ({ refId, minutos })),
    descansoMin: duracion(bloques.filter(b => b.tipo === "descanso")),
  };
}
