// Junta calendarios, eventos apuntados a mano, tareas y lo hecho en la semana
// en la entrada que necesita planDay().
import { clasificar, entregas } from "./clasificar.js";
import { deMinutos, diaSemana, sumarDias } from "./tiempo.js";

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
    tareas: combinarTareas(entregas([...eventos, ...entregasManuales(perfil)], perfil), tareas),
    perfil,
    semana: { hechosObjetivo: contarSemana(dias, fecha, false) },
    overrides: { retrasos: dia.retrasos || [], ...(dia.horaLevantarse != null ? { horaLevantarse: dia.horaLevantarse } : {}) },
  };
}
