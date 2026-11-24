// Datos en Firestore, en tiempo real y con caché sin conexión: usuarios/{uid}/tasca_*
// Los proyectos compartidos viven aparte, en compartidos/{id} (con sus tareas en compartidos/{id}/tareas),
// y los ven y editan todos sus miembros. Para el resto de la app son proyectos y tareas normales.
// Cada cambio llega a todos los dispositivos abiertos (móvil y web) al momento.
import { siguienteFecha, hijosPorPadre, descendientes } from "./logica.js";
import { hoyISO } from "./fechas.js";

let F, db, uid, yo = {};
export const S = { proyectos: [], tareas: [], focos: [], ajustes: {}, invitaciones: [], listo: false };
export const usuario = () => yo;
const personales = { proyectos: [], tareas: [] };
const comp = new Map();      // id del proyecto compartido → { p, tareas, fuera }
const lugar = new Map();     // id de tarea → id del proyecto compartido donde vive (o null si es personal)
function recomponer() {
  const cs = [...comp.values()].filter(c => c.p);
  S.proyectos = [...personales.proyectos, ...cs.map(c => ({ ...c.p, compartido: true })).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))];
  S.tareas = [...personales.tareas, ...cs.flatMap(c => c.tareas)];
  lugar.clear();
  for (const t of personales.tareas) lugar.set(t.id, null);
  for (const c of cs) for (const t of c.tareas) lugar.set(t.id, c.p.id);
}
export const esCompartido = pid => !!pid && comp.has(pid);
const compartidoDe = pid => (esCompartido(pid) ? pid : null);
const refComp = pid => F.doc(db, "compartidos", pid);
const refTarea = (id, pid = lugar.get(id) ?? null) => (pid ? F.doc(db, "compartidos", pid, "tareas", id) : doc("tareas", id));
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

export function iniciar(firestore, baseDatos, user) {
  F = firestore; db = baseDatos; uid = user.uid;
  yo = { uid, email: (user.email || "").toLowerCase(), nombre: user.displayName || user.email || "" };
  let pendientes = 5;
  const hecho = () => { if (--pendientes === 0) { S.listo = true; avisar(); } };
  const una = fn => { let primera = true; return snap => { fn(snap); if (primera) { primera = false; hecho(); } avisar(); }; };
  const err = e => { console.error(e); oyentes.forEach(fn => fn(S, e)); };
  F.onSnapshot(col("proyectos"), una(s => { personales.proyectos = s.docs.map(d => d.data()).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)); recomponer(); }), err);
  F.onSnapshot(col("tareas"), una(s => { personales.tareas = s.docs.map(d => d.data()); recomponer(); }), err);
  // proyectos compartidos en los que estoy, cada uno con sus tareas
  let primeraComp = true;
  const finComp = () => { if (primeraComp) { primeraComp = false; hecho(); } };
  F.onSnapshot(F.query(F.collection(db, "compartidos"), F.where("miembros", "array-contains", uid)), s => {
    const vistos = new Set();
    for (const d of s.docs) {
      vistos.add(d.id);
      let c = comp.get(d.id);
      if (!c) {
        c = { p: null, tareas: [] };
        comp.set(d.id, c);
        c.fuera = F.onSnapshot(F.collection(db, "compartidos", d.id, "tareas"), st => { c.tareas = st.docs.map(x => x.data()); recomponer(); avisar(); }, e => console.warn("compartido", d.id, e));
      }
      c.p = { ...d.data(), id: d.id };
    }
    for (const [id, c] of comp) if (!vistos.has(id)) { c.fuera?.(); comp.delete(id); }
    recomponer(); finComp(); avisar();
  }, e => { console.warn("compartidos", e); finComp(); });
  // invitaciones a proyectos de otros
  if (yo.email) F.onSnapshot(F.query(F.collection(db, "compartidos"), F.where("invitados", "array-contains", yo.email)), s => {
    S.invitaciones = s.docs.map(d => ({ ...d.data(), id: d.id })); avisar();
  }, e => console.warn("invitaciones", e));
  // focos de los últimos 120 días (para estadísticas)
  const desde = Date.now() - 120 * 864e5;
  F.onSnapshot(F.query(col("focos"), F.where("inicio", ">=", desde)), una(s => { S.focos = s.docs.map(d => d.data()); }), err);
  F.onSnapshot(doc("config", "ajustes"), una(s => { S.ajustes = { ...AJUSTES_BASE, ...(s.exists() ? s.data() : {}) }; }), err);
}

// ---------- proyectos ----------
export const COLORES = ["#C4625A", "#C98A5B", "#C8A65A", "#7E9E6B", "#5E9A8C", "#5F93A6", "#6F8DB4", "#7C80B8", "#957BB0", "#B07A9E", "#B76E7E", "#8A8D93"];
export function guardarProyecto(p) {
  if (esCompartido(p.id)) {
    const { nombre, color, orden, archivado, secciones } = p;
    F.updateDoc(refComp(p.id), limpio({ nombre: nombre.trim(), color, orden: orden ?? 0, archivado: !!archivado, secciones: secciones || [] }));
    return p;
  }
  const x = { id: p.id || nuevoId(), nombre: p.nombre.trim(), color: p.color || COLORES[S.proyectos.length % COLORES.length], orden: p.orden ?? S.proyectos.length, archivado: !!p.archivado, secciones: p.secciones || [], creado: p.creado || Date.now() };
  F.setDoc(doc("proyectos", x.id), limpio(x));
  return x;
}
export async function borrarProyecto(id) {
  if (esCompartido(id)) {
    const c = comp.get(id);
    if (c.p.dueno !== uid && (c.p.miembros || []).length > 1) return salirDe(id); // no es tuyo: solo sales tú
    const ts = c.tareas;
    for (let i = 0; i < ts.length; i += 400) { const l = F.writeBatch(db); for (const t of ts.slice(i, i + 400)) l.delete(refTarea(t.id, id)); await l.commit(); }
    await F.deleteDoc(refComp(id));
    return;
  }
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
export function guardarTarea(t) {
  t.editado = Date.now();
  const destino = compartidoDe(t.proyectoId), actual = lugar.has(t.id) ? lugar.get(t.id) : destino;
  if (actual !== destino) { const l = F.writeBatch(db); l.delete(refTarea(t.id, actual)); l.set(refTarea(t.id, destino), limpio(t)); l.commit(); }
  else F.setDoc(refTarea(t.id, destino), limpio(t));
  lugar.set(t.id, destino);
  return t;
}
/** Cambia campos. Si pasa de un proyecto personal a uno compartido (o al revés), la tarea se mueve de sitio. */
export function cambiarTarea(id, cambios) {
  const c = limpio({ ...cambios, editado: Date.now() });
  const actual = lugar.get(id) ?? null;
  if ("proyectoId" in cambios) {
    const destino = compartidoDe(cambios.proyectoId);
    if (destino !== actual) {
      const t = S.tareas.find(x => x.id === id); if (!t) return Promise.resolve();
      const l = F.writeBatch(db);
      l.delete(refTarea(id, actual)); l.set(refTarea(id, destino), limpio({ ...t, ...c }));
      lugar.set(id, destino);
      return l.commit();
    }
  }
  return F.updateDoc(refTarea(id, actual), c);
}

export async function borrarTarea(id) {
  const hijos = hijosPorPadre(S.tareas);
  const lote = F.writeBatch(db);
  for (const t of [{ id }, ...descendientes(id, hijos)]) lote.delete(refTarea(t.id));
  await lote.commit();
}

/** Marcar o desmarcar. Si se repite, salta a la siguiente fecha y reabre sus pasos. Devuelve un «deshacer». */
export async function alternar(t) {
  const antes = S.tareas.filter(x => x.id === t.id || x.padreId === t.id).map(x => ({ ...x }));
  if (!t.hecha && t.repetir && t.fecha) {
    const sig = siguienteFecha(t.fecha, t.repetir, hoyISO());
    const lote = F.writeBatch(db);
    lote.update(refTarea(t.id), { fecha: sig, hechaVeces: (t.hechaVeces || 0) + 1, ultimaVez: Date.now(), editado: Date.now() });
    for (const h of S.tareas.filter(x => x.padreId === t.id && x.hecha)) lote.update(refTarea(h.id), { hecha: false, hechaEn: null });
    await lote.commit();
    return { texto: `Hecha · vuelve el ${sig.split("-").reverse().slice(0, 2).join("/")}`, deshacer: () => restaurar(antes) };
  }
  await cambiarTarea(t.id, { hecha: !t.hecha, hechaEn: t.hecha ? null : Date.now() });
  return { texto: t.hecha ? "Pendiente otra vez" : "¡Hecha!", deshacer: () => restaurar(antes) };
}
async function restaurar(copias) {
  const lote = F.writeBatch(db);
  for (const c of copias) lote.set(refTarea(c.id), limpio(c));
  await lote.commit();
}

/** Guarda muchas tareas de golpe (importación). Firestore admite 500 por lote. */
export async function guardarMuchas(tareas, alAvanzar) {
  for (let i = 0; i < tareas.length; i += 400) {
    const lote = F.writeBatch(db);
    for (const t of tareas.slice(i, i + 400)) lote.set(refTarea(t.id, compartidoDe(t.proyectoId)), limpio(t));
    await lote.commit();
    alAvanzar?.(Math.min(tareas.length, i + 400), tareas.length);
  }
}

/** Cambia muchas tareas de golpe: [[id, cambios], …] (para actualizar un proyecto desde un CSV) */
export async function cambiarMuchas(lista) {
  for (let i = 0; i < lista.length; i += 400) {
    const lote = F.writeBatch(db);
    for (const [id, c] of lista.slice(i, i + 400)) lote.update(refTarea(id), limpio({ ...c, editado: Date.now() }));
    await lote.commit();
  }
}

// ---------- pomodoro ----------
export function guardarFoco(f) { const x = { id: nuevoId(), ...f }; F.setDoc(doc("focos", x.id), limpio(x)); return x; }
export const borrarFoco = id => F.deleteDoc(doc("focos", id));

// ---------- ajustes ----------
export function guardarAjustes(cambios) { S.ajustes = { ...S.ajustes, ...cambios }; avisar(); return F.setDoc(doc("config", "ajustes"), limpio(S.ajustes)); }

// ---------- copia de seguridad ----------
export const exportar = () => ({ app: "tasca", version: 1, fecha: new Date().toISOString(), proyectos: S.proyectos, tareas: S.tareas, focos: S.focos, ajustes: S.ajustes });

// ---------- proyectos compartidos ----------
export const correoValido = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/** Invita a alguien (por su correo de Google). Si el proyecto aún era solo tuyo, pasa a ser compartido con sus tareas. */
export async function compartir(pid, correo) {
  correo = correo.trim().toLowerCase();
  if (esCompartido(pid)) return F.updateDoc(refComp(pid), { invitados: F.arrayUnion(correo) });
  const p = personales.proyectos.find(x => x.id === pid); if (!p) return;
  await F.setDoc(refComp(pid), limpio({ ...p, dueno: uid, miembros: [uid], invitados: [correo], nombres: { [uid]: yo.nombre }, correos: { [uid]: yo.email } }));
  const ts = personales.tareas.filter(t => t.proyectoId === pid);
  for (let i = 0; i < ts.length; i += 200) {
    const l = F.writeBatch(db);
    for (const t of ts.slice(i, i + 200)) { l.set(F.doc(db, "compartidos", pid, "tareas", t.id), limpio(t)); l.delete(doc("tareas", t.id)); }
    await l.commit();
  }
  await F.deleteDoc(doc("proyectos", pid));
}
export const quitarInvitacion = (pid, correo) => F.updateDoc(refComp(pid), { invitados: F.arrayRemove(correo) });
export const quitarMiembro = (pid, otro) => F.updateDoc(refComp(pid), { miembros: F.arrayRemove(otro) });
export function aceptar(pid) {
  return F.updateDoc(refComp(pid), { miembros: F.arrayUnion(uid), invitados: F.arrayRemove(yo.email), [`nombres.${uid}`]: yo.nombre, [`correos.${uid}`]: yo.email });
}
export const rechazar = pid => F.updateDoc(refComp(pid), { invitados: F.arrayRemove(yo.email) });
/** Salir de un proyecto compartido (si eras quien lo creó, pasa a otro miembro) */
export function salirDe(pid) {
  const c = comp.get(pid); if (!c) return;
  const otros = (c.p.miembros || []).filter(x => x !== uid);
  const cambios = { miembros: F.arrayRemove(uid) };
  if (c.p.dueno === uid && otros.length) cambios.dueno = otros[0];
  return F.updateDoc(refComp(pid), cambios);
}
