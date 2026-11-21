// Sesiones de estudio: enlaza cada evento del calendario («TC – Conceptes bàsics», 15:45–17:45) con su tarea
// del CSV («Conceptes bàsics», con sus pasos) del mismo día. Puro: se puede probar sin navegador.
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SEP = /\s+[–—-]\s+|:\s+/;
const cola = s => { const p = (s || "").split(SEP); return p.length > 1 ? p.slice(1).join(" ") : s; };
const iniciales = n => norm(n).split(" ").filter(w => w.length > 2).map(w => w[0]).join("");

/** Puntos de parecido entre un evento y una tarea (0 = nada que ver) */
export function parecido(e, t, proyecto) {
  const et = norm(e.titulo), fin = norm(cola(e.titulo)), tt = norm(t.titulo);
  if (tt.length < 4) return 0;
  let p = 0;
  if (tt === fin || tt === et) p = 3;
  else if (fin.length >= 5 && (tt.includes(fin) || fin.includes(tt))) p = 2;
  else if (tt.length >= 6 && et.includes(tt)) p = 2;
  if (!p) return 0;
  const pref = norm((e.titulo || "").split(SEP)[0]).replace(/ /g, "");
  if (proyecto && pref && pref !== et.replace(/ /g, "")) {
    const ini = iniciales(proyecto.nombre), nom = norm(proyecto.nombre).replace(/ /g, "");
    if (pref === ini || ini.startsWith(pref) || pref.startsWith(ini) || nom.startsWith(pref)) p += 1;
  }
  return p;
}

/**
 * Enlaces de un día. Primero los puestos a mano (tarea.enlace = id del evento); luego, para cada evento con hora,
 * la tarea del mismo día que más se le parece. Devuelve { porEvento: Map(idEvento → tarea), porTarea: Map(idTarea → evento) }.
 */
export function enlazar(fecha, eventos, tareas, proyectos) {
  const evs = eventos.filter(e => !e.todoElDia);
  const cand = tareas.filter(t => !t.padreId);
  const porEvento = new Map(), porTarea = new Map();
  for (const t of cand) if (t.enlace) { const e = evs.find(x => x.id === t.enlace); if (e) { porEvento.set(e.id, t); porTarea.set(t.id, e); } }
  for (const e of evs) {
    if (porEvento.has(e.id)) continue;
    let mejor = null, max = 0;
    for (const t of cand) {
      if (porTarea.has(t.id) || t.fecha !== fecha || t.enlace) continue;
      const p = parecido(e, t, proyectos.find(x => x.id === t.proyectoId));
      if (p > max) { max = p; mejor = t; }
    }
    if (mejor) { porEvento.set(e.id, mejor); porTarea.set(mejor.id, e); }
  }
  return { porEvento, porTarea };
}

/** Minutos entre «AAAA-MM-DDTHH:MM» y otro */
export const minutosEntre = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
