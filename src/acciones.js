// Acciones que propone la IA a partir de lo que escribes o dices.
// Nada se aplica sin confirmar: validar() → describir() en la tarjeta → aplicar() al pulsar «Aplicar».
import { hhmm } from "./tiempo.js?v=202611150839";

const TIPOS = new Set(["tarea", "evento", "retraso", "no-ir", "hecho", "aplazar", "trabajo-horario", "trabajo-dia"]);
const TIPOS_TAREA = new Set(["entrega", "examen", "estudio", "otro"]);
const TIPOS_EVENTO = new Set(["entreno", "partido", "entrega", "examen", "clase", "practica", "otro"]);
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const aMin = v => {
  if (typeof v === "number" && v >= 0 && v <= 1440) return v;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || "");
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`hora no válida: ${v}`);
  return +m[1] * 60 + +m[2];
};
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** "2026-11-20" → "viernes 20" */
export const diaFecha = f => { const d = new Date(f + "T12:00:00Z"); return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()}`; };
const fecha = v => (v && FECHA.test(v) ? v : null);
const exigirRef = (ref, refs) => {
  if (!ref) throw new Error("falta refId");
  if (refs && !refs.includes(ref)) throw new Error(`no existe ${ref}`);
  return ref;
};

function normalizar(a, refs) {
  if (!a || !TIPOS.has(a.tipo)) throw new Error(`tipo desconocido: ${a?.tipo}`);
  switch (a.tipo) {
    case "tarea": {
      const titulo = String(a.titulo || a.tarea?.titulo || "").trim();
      if (!titulo) throw new Error("tarea sin título");
      const pasos = (a.pasos || a.tarea?.pasos || []).map(p => ({ titulo: String(p.titulo || "").trim(), minutos: Math.max(5, Math.round(+p.minutos || 30)) })).filter(p => p.titulo);
      const tipo = TIPOS_TAREA.has(a.tipoTarea) ? a.tipoTarea : "otro";
      return { tipo: "tarea", tarea: { titulo, tipo, fechaLimite: fecha(a.fechaLimite), sitioId: a.sitioId || null, pasos: pasos.length ? pasos : [{ titulo, minutos: 60 }] } };
    }
    case "evento": {
      const titulo = String(a.titulo || "").trim();
      if (!titulo || !fecha(a.fecha)) throw new Error("evento sin título o fecha");
      const ev = { titulo, tipo: TIPOS_EVENTO.has(a.tipoEvento) ? a.tipoEvento : "otro", fecha: a.fecha, inicio: aMin(a.inicio), fin: aMin(a.fin) };
      if (ev.fin <= ev.inicio) throw new Error("el evento acaba antes de empezar");
      if (Array.isArray(a.diasSemana) && a.diasSemana.length) {
        if (a.diasSemana.some(d => !(d >= 0 && d <= 6))) throw new Error("día de la semana no válido");
        ev.repetir = { diasSemana: [...new Set(a.diasSemana)] };
      }
      return { tipo: "evento", evento: ev };
    }
    case "retraso": {
      const minutos = Math.round(+a.minutos);
      if (!(minutos > 0 && minutos <= 600)) throw new Error("retraso no válido");
      return { tipo: "retraso", minutos };
    }
    case "no-ir":
    case "hecho":
      return { tipo: a.tipo, refId: exigirRef(a.refId, refs) };
    case "aplazar":
      if (!fecha(a.fecha)) throw new Error("aplazar sin fecha");
      return { tipo: "aplazar", refId: exigirRef(a.refId, refs), fecha: a.fecha };
    case "trabajo-dia": {
      if (!fecha(a.fecha)) throw new Error("falta la fecha");
      if (!a.inicio && !a.fin) return { tipo: "trabajo-dia", fecha: a.fecha, libre: true };
      const inicio = aMin(a.inicio), fin = aMin(a.fin);
      if (fin <= inicio) throw new Error("horario no válido");
      return { tipo: "trabajo-dia", fecha: a.fecha, libre: false, inicio, fin };
    }
    case "trabajo-horario": {
      const d = +a.diaSemana;
      if (!(d >= 0 && d <= 6)) throw new Error("día no válido");
      const inicio = aMin(a.inicio), fin = aMin(a.fin);
      if (fin <= inicio) throw new Error("horario no válido");
      return { tipo: "trabajo-horario", diaSemana: d, inicio, fin };
    }
  }
}

/**
 * @param {string|object} json respuesta de la IA
 * @param {string[]} [refs] ids que existen ahora (tareas, pasos, eventos del día)
 * @returns {{ok: true, acciones: object[]} | {ok: false, error: string}}
 */
export function validar(json, refs) {
  try {
    const datos = typeof json === "string" ? JSON.parse(json) : json;
    if (!datos || !Array.isArray(datos.acciones)) throw new Error("respuesta sin acciones");
    return { ok: true, acciones: datos.acciones.map(a => normalizar(a, refs)) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Texto para la tarjeta de confirmación. */
export function describir(a, nombres = {}) {
  const n = id => nombres[id] || id;
  switch (a.tipo) {
    case "tarea": {
      const t = a.tarea;
      const total = t.pasos.reduce((s, p) => s + p.minutos, 0);
      return `Nueva tarea: ${t.titulo}${t.fechaLimite ? ` (para el ${diaFecha(t.fechaLimite)})` : ""} · ${t.pasos.length} pasos, ${total} min`;
    }
    case "evento": {
      const e = a.evento;
      const rep = e.repetir ? ` cada ${e.repetir.diasSemana.map(d => DIAS[d]).join(" y ")}` : ` el ${diaFecha(e.fecha)}`;
      return `Apuntar ${e.titulo}${rep} de ${hhmm(e.inicio)} a ${hhmm(e.fin)}`;
    }
    case "retraso": return `Retrasar el resto del día ${a.minutos} min`;
    case "no-ir": return `No ir a ${n(a.refId)}`;
    case "hecho": return `Marcar como hecho: ${n(a.refId)}`;
    case "aplazar": return `Aplazar ${n(a.refId)} al ${diaFecha(a.fecha)}`;
    case "trabajo-dia": return a.libre ? `No trabajas el ${diaFecha(a.fecha)}` : `El ${diaFecha(a.fecha)} trabajas de ${hhmm(a.inicio)} a ${hhmm(a.fin)} (solo ese día)`;
    case "trabajo-horario": return `Cambiar el horario de trabajo del ${DIAS[a.diaSemana]}: de ${hhmm(a.inicio)} a ${hhmm(a.fin)}`;
  }
  return a.tipo;
}

const nuevoId = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Aplica acciones ya validadas. Puro: devuelve un estado nuevo.
 * @param {{perfil, tareas, dia: {fecha, retrasos, marcas, hechosObjetivo}}} estado
 * @param {object[]} acciones
 * @param {{ahora?: number}} ctx minutos locales actuales
 */
export function aplicar(estado, acciones, { ahora = 0 } = {}) {
  const e = structuredClone(estado);
  e.dia.retrasos ||= []; e.dia.marcas ||= {};
  for (const a of acciones) {
    switch (a.tipo) {
      case "tarea": {
        const id = nuevoId();
        e.tareas.push({ id, ...a.tarea, pasos: a.tarea.pasos.map((p, i) => ({ id: `${id}.${i + 1}`, ...p, hecho: false })) });
        break;
      }
      case "evento":
        e.perfil.eventosManuales = [...(e.perfil.eventosManuales || []), { id: nuevoId(), ...a.evento }];
        break;
      case "retraso":
        e.dia.retrasos.push({ desde: ahora, minutos: a.minutos });
        break;
      case "no-ir":
        if ((e.perfil.objetivos || []).some(o => o.id === a.refId)) e.dia.objetivosNo = [...new Set([...(e.dia.objetivosNo || []), a.refId])];
        else e.dia.marcas[a.refId] = { ...(e.dia.marcas[a.refId] || {}), asistir: false };
        break;
      case "hecho":
        if ((e.perfil.objetivos || []).some(o => o.id === a.refId)) e.dia.hechosObjetivo = { ...(e.dia.hechosObjetivo || {}), [a.refId]: true };
        for (const t of e.tareas) {
          if (t.id === a.refId) t.pasos.forEach(p => (p.hecho = true));
          for (const p of t.pasos) if (p.id === a.refId) p.hecho = true;
        }
        break;
      case "aplazar":
        for (const t of e.tareas) if (t.id === a.refId) t.aplazadaHasta = a.fecha;
        break;
      case "trabajo-dia":
        e.perfil.trabajoExcepciones = { ...(e.perfil.trabajoExcepciones || {}), [a.fecha]: a.libre ? null : { inicio: a.inicio, fin: a.fin } };
        break;
      case "trabajo-horario":
        e.perfil.trabajo = [...(e.perfil.trabajo || []).filter(t => t.diaSemana !== a.diaSemana), { diaSemana: a.diaSemana, inicio: a.inicio, fin: a.fin }]
          .sort((x, y) => x.diaSemana - y.diaSemana);
        break;
    }
  }
  return e;
}
