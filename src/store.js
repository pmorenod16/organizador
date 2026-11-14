// Lectura y escritura en Firestore. Todo cuelga de usuarios/{uid}/…
let F, db, uid;
export function iniciarStore(firestore, baseDatos, usuarioId) { F = firestore; db = baseDatos; uid = usuarioId; }

const ref = (...ruta) => F.doc(db, "usuarios", uid, ...ruta);
const limpio = o => JSON.parse(JSON.stringify(o));   // Firestore no admite undefined

export async function cargarPerfil() {
  const s = await F.getDoc(ref("perfil", "actual"));
  return s.exists() ? s.data() : null;
}
export const guardarPerfil = p => F.setDoc(ref("perfil", "actual"), limpio(p));

export async function cargarTareas() {
  const s = await F.getDocs(F.collection(db, "usuarios", uid, "tareas"));
  return s.docs.map(d => d.data());
}
export const guardarTarea = t => F.setDoc(ref("tareas", t.id.replace(/\//g, "_")), limpio(t));
export const borrarTarea = id => F.deleteDoc(ref("tareas", id.replace(/\//g, "_")));

/** Días entre dos fechas (incluidas): {[fecha]: datos} */
export async function cargarDias(desde, hasta) {
  const q = F.query(F.collection(db, "usuarios", uid, "dias"), F.where(F.documentId(), ">=", desde), F.where(F.documentId(), "<=", hasta));
  const s = await F.getDocs(q);
  return Object.fromEntries(s.docs.map(d => [d.id, d.data()]));
}
export const guardarDia = (fecha, datos) => F.setDoc(ref("dias", fecha), limpio(datos));
