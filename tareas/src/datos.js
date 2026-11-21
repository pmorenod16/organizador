// Datos en Firestore, en tiempo real y con caché sin conexión: usuarios/{uid}/tasca_*
// Cada cambio llega a todos los dispositivos abiertos (móvil y web) al momento.
import { siguienteFecha, hijosPorPadre, descendientes } from "./logica.js";
import { hoyISO } from "./fechas.js";

let F, db, uid;
export const S = { proyectos: [], tareas: [], focos: [], ajustes: {}, listo: false };
const oyentes = new Set();
export const alCambiar = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };
let aviso = null;
const avisar = () => { clearTimeout(aviso); aviso = setTimeout(() => oyentes.forEach(fn => fn(S)), 16); };

const col = n => F.collection(db, "usuarios", uid, "tasca_" + n);
const doc = (n, id) => F.doc(db, "usuarios", uid, "tasca_" + n, id);
const limpio = o => JSON.parse(JSON.stringify(o)); // Firestore no admite undefined
export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const AJUSTES_BASE = {
  foco: 25, corto: 5, largo: 15, cadaLargo: 4, autoDescanso: true, autoFoco: false,
  objetivo: 8, sonidoFin: true, aviso: 10, semanaEmpieza: 1, tema: "auto",
};

export function iniciar(firestore, baseDatos, usuario) {
  F = firestore; db = baseDatos; uid = usuario;
  let pendientes = 4;
  const hecho = () => { if (--pendientes === 0) { S.listo = true; avisar(); } };
  const una = fn => { let primera = true; return snap => { fn(snap); if (primera) { primera = false; hecho(); } avisar(); }; };
  const err = e => { console.error(e); oyentes.forEach(fn => fn(S, e)); };
  F.onSnapshot(col("proyectos"), una(s => { S.proyectos = s.docs.map(d => d.data()).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)); }), err);
  F.onSnapshot(col("tareas"), una(s => { S.tareas = s.docs.map(d => d.data()); }), err);
  // focos de los últimos 120 días (para estadísticas)
  const desde = Date.now() - 120 * 864e5;
  F.onSnapshot(F.query(col("focos"), F.where("inicio", ">=", desde)), una(s => { S.focos = s.docs.map(d => d.data()); }), err);
  F.onSnapshot(doc("config", "ajustes"), una(s => { S.ajustes = { ...AJUSTES_BASE, ...(s.exists() ? s.data() : {}) }; }), err);
}

// ---------- proyectos ----------
export const COLORES = ["#C4625A", "#C98A5B", "#C8A65A", "#7E9E6B", "#5E9A8C", "#5F93A6", "#6F8DB4", "#7C80B8", "#957BB0", "#B07A9E", "#B76E7E", "#8A8D93"];
export function guardarProyecto(p) {
  const x = { id: p.id || nuevoId(), nombre: p.nombre.trim(), color: p.color || COLORES[S.proyectos.length % COLORES.length], orden: p.orden ?? S.proyectos.length, archivado: !!p.archivado, secciones: p.secciones || [], creado: p.creado || Date.now() };
  F.setDoc(doc("proyectos", x.id), limpio(x));
  return x;
}
export async function borrarProyecto(id) {
  const lote = F.writeBatch(db);
  for (const t of S.tareas.filter(t => t.proyectoId === id)) lote.delete(doc("tareas", t.id));
  lote.delete(doc("proyectos", id));
  await lote.commit();
}

// ---------- tareas ----------
export function nuevaTarea(datos) {
  const hermanos = S.tareas.filter(t => (t.padreId || null) === (datos.padreId || null) && (t.proyectoId || null) === (datos.proyectoId || null));
  return {
    id: nuevoId(), titulo: "", notas: "", proyectoId: null, padreId: null, seccion: null,
    fecha: null, hora: null, duracion: null, prioridad: 4, etiquetas: [], recordatorios: null, repetir: null,
    hecha: false, hechaEn: null, pomos: 0, pomosEstimados: null,
    orden: hermanos.reduce((m, t) => Math.max(m, t.orden ?? 0), 0) + 1, creado: Date.now(),
    ...datos,
  };
}
export function guardarTarea(t) { t.editado = Date.now(); F.setDoc(doc("tareas", t.id), limpio(t)); return t; }
export const cambiarTarea = (id, cambios) => F.updateDoc(doc("tareas", id), limpio({ ...cambios, editado: Date.now() }));

export async function borrarTarea(id) {
  const hijos = hijosPorPadre(S.tareas);
  const lote = F.writeBatch(db);
  for (const t of [{ id }, ...descendientes(id, hijos)]) lote.delete(doc("tareas", t.id));
  await lote.commit();
}

/** Marcar o desmarcar. Si se repite, salta a la siguiente fecha y reabre sus pasos. Devuelve un «deshacer». */
export async function alternar(t) {
  const antes = S.tareas.filter(x => x.id === t.id || x.padreId === t.id).map(x => ({ ...x }));
  if (!t.hecha && t.repetir && t.fecha) {
    const sig = siguienteFecha(t.fecha, t.repetir, hoyISO());
    const lote = F.writeBatch(db);
    lote.update(doc("tareas", t.id), { fecha: sig, hechaVeces: (t.hechaVeces || 0) + 1, ultimaVez: Date.now(), editado: Date.now() });
    for (const h of S.tareas.filter(x => x.padreId === t.id && x.hecha)) lote.update(doc("tareas", h.id), { hecha: false, hechaEn: null });
    await lote.commit();
    return { texto: `Hecha · vuelve el ${sig.split("-").reverse().slice(0, 2).join("/")}`, deshacer: () => restaurar(antes) };
  }
  await cambiarTarea(t.id, { hecha: !t.hecha, hechaEn: t.hecha ? null : Date.now() });
  return { texto: t.hecha ? "Pendiente otra vez" : "¡Hecha!", deshacer: () => restaurar(antes) };
}
async function restaurar(copias) {
  const lote = F.writeBatch(db);
  for (const c of copias) lote.set(doc("tareas", c.id), limpio(c));
  await lote.commit();
}

/** Guarda muchas tareas de golpe (importación). Firestore admite 500 por lote. */
export async function guardarMuchas(tareas, alAvanzar) {
  for (let i = 0; i < tareas.length; i += 400) {
    const lote = F.writeBatch(db);
    for (const t of tareas.slice(i, i + 400)) lote.set(doc("tareas", t.id), limpio(t));
    await lote.commit();
    alAvanzar?.(Math.min(tareas.length, i + 400), tareas.length);
  }
}

// ---------- pomodoro ----------
export function guardarFoco(f) { const x = { id: nuevoId(), ...f }; F.setDoc(doc("focos", x.id), limpio(x)); return x; }
export const borrarFoco = id => F.deleteDoc(doc("focos", id));

// ---------- ajustes ----------
export function guardarAjustes(cambios) { S.ajustes = { ...S.ajustes, ...cambios }; avisar(); return F.setDoc(doc("config", "ajustes"), limpio(S.ajustes)); }

// ---------- copia de seguridad ----------
export const exportar = () => ({ app: "tasca", version: 1, fecha: new Date().toISOString(), proyectos: S.proyectos, tareas: S.tareas, focos: S.focos, ajustes: S.ajustes });
