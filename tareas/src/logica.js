// Reglas de las tareas: orden, árbol de subtareas, vistas, repeticiones. Puro (sin DOM ni Firebase).
import { sumarDias, sumarMeses, diaSemana, diasEntre } from "./fechas.js";

export const PRIORIDADES = { 1: "Urgente", 2: "Alta", 3: "Media", 4: "Sin prioridad" };

/** Orden de una lista: fecha (sin fecha al final) → hora → prioridad → orden manual → creación */
export function comparar(a, b) {
  if ((a.fecha || "9") !== (b.fecha || "9")) return (a.fecha || "9") < (b.fecha || "9") ? -1 : 1;
  if ((a.hora || "99") !== (b.hora || "99")) return (a.hora || "99") < (b.hora || "99") ? -1 : 1;
  if ((a.prioridad || 4) !== (b.prioridad || 4)) return (a.prioridad || 4) - (b.prioridad || 4);
  if ((a.orden ?? 0) !== (b.orden ?? 0)) return (a.orden ?? 0) - (b.orden ?? 0);
  return (a.creado || 0) - (b.creado || 0);
}
/** Orden dentro de un proyecto o de las subtareas: el manual manda (así se respeta el orden del temario). */
export const compararManual = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.creado || 0) - (b.creado || 0);

export function hijosPorPadre(tareas) {
  const m = new Map();
  for (const t of tareas) if (t.padreId) { if (!m.has(t.padreId)) m.set(t.padreId, []); m.get(t.padreId).push(t); }
  for (const l of m.values()) l.sort(compararManual);
  return m;
}
/** Todas las subtareas (a cualquier nivel) de una tarea */
export function descendientes(id, hijos) {
  const out = [], pila = [...(hijos.get(id) || [])];
  while (pila.length) { const t = pila.shift(); out.push(t); pila.push(...(hijos.get(t.id) || [])); }
  return out;
}
export function progreso(id, hijos) {
  const d = descendientes(id, hijos);
  return { hechas: d.filter(t => t.hecha).length, total: d.length };
}

export const vencida = (t, hoy) => !t.hecha && t.fecha && t.fecha < hoy;

/** Tareas de primer nivel para una vista. Las subtareas solo salen sueltas si tienen fecha propia distinta de la del padre. */
export function deVista(vista, tareas, hoy, extra = {}) {
  const porId = new Map(tareas.map(t => [t.id, t]));
  const visibleSuelta = t => !t.padreId || !porId.has(t.padreId) || (t.fecha && t.fecha !== porId.get(t.padreId).fecha);
  const pend = tareas.filter(t => !t.hecha);
  switch (vista) {
    case "hoy": return pend.filter(t => t.fecha && t.fecha <= hoy && visibleSuelta(t)).sort(comparar);
    case "proximos": { const fin = sumarDias(hoy, extra.dias || 7); return pend.filter(t => t.fecha && t.fecha <= fin && visibleSuelta(t)).sort(comparar); }
    case "bandeja": return pend.filter(t => !t.proyectoId && !t.padreId).sort(compararManual);
    case "proyecto": return pend.filter(t => t.proyectoId === extra.proyectoId && !t.padreId).sort(compararManual);
    case "dia": return tareas.filter(t => t.fecha === extra.fecha && visibleSuelta(t)).sort(comparar);
    case "hechas": return tareas.filter(t => t.hecha).sort((a, b) => (b.hechaEn || 0) - (a.hechaEn || 0));
    case "buscar": {
      const q = normal(extra.q || "");
      if (!q) return [];
      return tareas.filter(t => normal(t.titulo + " " + (t.notas || "")).includes(q)).sort((a, b) => Number(a.hecha) - Number(b.hecha) || comparar(a, b));
    }
    default: return [];
  }
}
export const normal = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Siguiente fecha de una tarea que se repite. repetir = { cada: "dia"|"semana"|"mes"|"año"|"laborables", n } */
export function siguienteFecha(fecha, repetir, hoy) {
  if (!repetir || !fecha) return null;
  const n = Math.max(1, repetir.n || 1);
  const paso = f => {
    switch (repetir.cada) {
      case "dia": return sumarDias(f, n);
      case "semana": return sumarDias(f, 7 * n);
      case "mes": return sumarMeses(f, n);
      case "año": return sumarMeses(f, 12 * n);
      case "laborables": { let x = sumarDias(f, 1); while (diaSemana(x) > 4) x = sumarDias(x, 1); return x; }
      default: return null;
    }
  };
  let f = paso(fecha);
  // si estaba muy atrasada, saltar hasta hoy o después (como Todoist)
  for (let i = 0; f && f < hoy && i < 1000; i++) f = paso(f);
  return f;
}
export function textoRepetir(r) {
  if (!r) return "";
  if (r.cada === "laborables") return "Cada día laborable";
  const n = r.n || 1;
  const nombres = { dia: ["Cada día", "días"], semana: ["Cada semana", "semanas"], mes: ["Cada mes", "meses"], año: ["Cada año", "años"] }[r.cada];
  return n === 1 ? nombres[0] : `Cada ${n} ${nombres[1]}`;
}

/** Racha de días seguidos (acabando hoy o ayer) con al menos un pomodoro o una tarea hecha */
export function racha(diasActivos, hoy) {
  const s = new Set(diasActivos);
  let f = s.has(hoy) ? hoy : sumarDias(hoy, -1), n = 0;
  while (s.has(f)) { n++; f = sumarDias(f, -1); }
  return n;
}

/** Agrupa una lista de tareas ordenadas por fecha para «Próximos»: [{fecha, tareas}] (vencidas en una sola) */
export function agruparPorDia(lista, hoy) {
  const g = new Map();
  for (const t of lista) { const k = t.fecha < hoy ? "vencidas" : t.fecha; if (!g.has(k)) g.set(k, []); g.get(k).push(t); }
  return [...g].map(([fecha, tareas]) => ({ fecha, tareas }));
}

/** Sugerencia «¿qué hago ahora?»: vencida o de hoy, más urgente y que antes toque. */
export function siguienteTarea(tareas, hoy, horaAhora = "00:00") {
  const l = deVista("hoy", tareas, hoy);
  // prioridad primero; dentro de la misma, lo atrasado y lo que ya tenía que haber empezado
  const puntua = t => (t.prioridad || 4) * 10 + (diasEntre(t.fecha, hoy) > 0 || (t.hora && t.hora <= horaAhora) ? 0 : 5);
  return l.sort((a, b) => puntua(a) - puntua(b) || comparar(a, b))[0] || null;
}
