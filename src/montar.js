// Junta calendarios, eventos apuntados a mano, tareas y lo hecho en la semana
// en la entrada que necesita planDay().
import { clasificar, entregas, normal } from "./clasificar.js?v=202611150744";
import { deMinutos, diaSemana, sumarDias, fechaLocal } from "./tiempo.js?v=202611150744";
import { diaFecha } from "./acciones.js?v=202611150744";

const EXAMEN = /\b(examen|examens|prova|parcial|final)\b/;
const BLOQUE = 45;
const PASOS_ESTUDIO = [
  a => `Repasar la teoría de ${a} y apuntar dudas`,
  a => `Problemas de ${a}: de los fáciles a los difíciles`,
  a => `Problemas tipo examen de ${a} (los más difíciles)`,
];
const slug = s => normal(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Estudio para examen de cada día, aunque no hayas dictado tareas (spec §3-4: «estudio general
 * para examen»). Se reparte entre las asignaturas; la que tiene examen antes va primero y se lleva
 * más tiempo. Con examen, la tarea es de tipo «examen» con su fecha (cuenta como urgente la víspera).
 */
export function estudioDelDia(perfil, fecha, eventos) {
  const total = perfil.estudio?.minutosDia ?? 180;
  if (!total) return [];
  const asignaturas = (perfil.asignaturas || []).map(a => a.nombre).filter(Boolean);
  const trozos = (titulo, min, id) => {
    const pasos = [];
    for (let i = 0, quedan = min; quedan > 0; i++, quedan -= BLOQUE) {
      const m = Math.min(BLOQUE, quedan);
      // un resto de menos de 30 min se suma al paso anterior
      if (m < 30 && pasos.length) { pasos[pasos.length - 1].minutos += m; break; }
      pasos.push({ id: `${id}#${i + 1}`, titulo: PASOS_ESTUDIO[i % PASOS_ESTUDIO.length](titulo), minutos: m, hecho: false });
    }
    return pasos;
  };
  if (!asignaturas.length) {
    const id = `auto:${fecha}:estudio`;
    return [{ id, titulo: "Estudiar (añade tus asignaturas en ⚙️)", tipo: "estudio", fechaLimite: null, sitioId: null,
      pasos: trozos("tus asignaturas", total, id) }];
  }
  // examen más cercano de cada asignatura (desde hoy, 30 días)
  const limite = sumarDias(fecha, 30);
  const examenDe = {};
  for (const e of eventos) {
    const t = normal(e.titulo);
    if (!EXAMEN.test(t)) continue;
    const f = e.todoElDia ? e.inicio : fechaLocal(new Date(e.inicio));
    if (f < fecha || f > limite) continue;
    for (const a of asignaturas) if (t.includes(normal(a)) && (!examenDe[a] || f < examenDe[a])) examenDe[a] = f;
  }
  const dias = f => Math.round((new Date(f + "T12:00:00Z") - new Date(fecha + "T12:00:00Z")) / 864e5);
  const peso = a => (!examenDe[a] ? 1 : dias(examenDe[a]) <= 7 ? 3 : dias(examenDe[a]) <= 14 ? 2 : 1);
  // orden: exámenes por fecha; el resto rota cada día para no empezar siempre por la misma
  const giro = (Math.round(new Date(fecha + "T12:00:00Z") / 864e5)) % asignaturas.length;
  const orden = asignaturas
    .map((a, i) => ({ a, i: (i - giro + asignaturas.length) % asignaturas.length }))
    .sort((x, y) => (examenDe[x.a] || "9999").localeCompare(examenDe[y.a] || "9999") || x.i - y.i)
    .map(x => x.a);
  const sumaPesos = orden.reduce((s, a) => s + peso(a), 0);
  let resto = total;
  return orden.map((a, i) => {
    const min = i === orden.length - 1 ? resto : Math.round((total * peso(a)) / sumaPesos / 15) * 15;
    resto -= min;
    const id = `auto:${fecha}:${slug(a)}`;
    const ex = examenDe[a];
    return { id, titulo: `Estudiar ${a}${ex ? ` (examen el ${diaFecha(ex)})` : ""}`, tipo: ex ? "examen" : "estudio",
      fechaLimite: ex || null, sitioId: null, pasos: trozos(a, min, id) };
  }).filter(t => t.pasos.length);
}

/** Eventos apuntados a mano (por voz/texto) que caen en una fecha, con el formato de /eventos. */
export function eventosManualesDelDia(perfil, fecha) {
  return (perfil.eventosManuales || [])
    .filter(e => (e.repetir ? e.fecha <= fecha && e.repetir.diasSemana.includes(diaSemana(fecha)) : e.fecha === fecha))
    .map(e => ({
      uid: `manual:${e.id}`, titulo: e.titulo, desc: "", ubicacion: "", todoElDia: false, origen: "manual", tipoManual: e.tipo,
      inicio: deMinutos(e.inicio, fecha).toISOString(), fin: deMinutos(e.fin, fecha).toISOString(),
    }));
}

/** Entregas apuntadas a mano (con su fecha y hora), en el formato de /eventos. */
export const entregasManuales = perfil => (perfil.eventosManuales || [])
  .filter(e => e.tipo === "entrega" && !e.repetir)
  .flatMap(e => eventosManualesDelDia(perfil, e.fecha).filter(x => x.uid === `manual:${e.id}`));

/** Entregas generadas del calendario + tareas guardadas (la guardada gana si tienen el mismo id). */
export function combinarTareas(generadas, guardadas) {
  const ids = new Set(guardadas.map(t => t.id));
  return [...guardadas, ...generadas.filter(t => !ids.has(t.id))];
}

/** Veces que se ha hecho cada objetivo esta semana (de lunes a la fecha; sin incluirla si incluirHoy = false). */
export function contarSemana(dias, fecha, incluirHoy = true) {
  const cuenta = {};
  for (let f = sumarDias(fecha, -diaSemana(fecha)); incluirHoy ? f <= fecha : f < fecha; f = sumarDias(f, 1)) {
    for (const [id, hecho] of Object.entries(dias[f]?.hechosObjetivo || {})) if (hecho) cuenta[id] = (cuenta[id] || 0) + 1;
  }
  return cuenta;
}

/**
 * @param {{fecha, eventos, perfil, tareas, dias: {[fecha]: {retrasos, marcas, hechosObjetivo, horaLevantarse}}}} datos
 * @returns entrada para planDay
 */
export function montarDia({ fecha, eventos, perfil, tareas, dias }) {
  const dia = dias[fecha] || {};
  const manuales = eventosManualesDelDia(perfil, fecha);
  const marcas = { ...(perfil.marcas || {}) };
  for (const m of manuales) marcas[m.uid] = { tipo: m.tipoManual, ...(marcas[m.uid] || {}) };
  Object.assign(marcas, dia.marcas || {});
  const todos = [...eventos, ...manuales];
  return {
    fecha,
    fijos: clasificar(todos, fecha, perfil, marcas),
    tareas: combinarTareas([...entregas([...eventos, ...entregasManuales(perfil)], perfil), ...estudioDelDia(perfil, fecha, eventos)], tareas),
    perfil,
    // la primera semana de uso no se sabe lo hecho antes: no se avisa de objetivos imposibles
    semana: { hechosObjetivo: contarSemana(dias, fecha, false), completa: !!perfil.creadoEl && perfil.creadoEl <= sumarDias(fecha, -diaSemana(fecha)) },
    overrides: { retrasos: dia.retrasos || [], ...(dia.horaLevantarse != null ? { horaLevantarse: dia.horaLevantarse } : {}) },
  };
}
