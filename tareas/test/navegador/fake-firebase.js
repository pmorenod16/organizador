// Firebase de mentira para probar la interfaz en local (solo tests).
const UID = localStorage.getItem("__uid") || "muiVgEMaG1UfYOjXx3lSNF4kZ3U2";
const EMAIL = localStorage.getItem("__email") || "polete@example.com";
const store = window.__fakeStore ||= new Map(JSON.parse(localStorage.getItem("__fake") || "[]"));
const listeners = window.__fakeL ||= new Set();
const persist = () => localStorage.setItem("__fake", JSON.stringify([...store]));
const notify = () => { persist(); for (const l of listeners) l(); };
export const initializeApp = () => ({});
// auth
export const getAuth = () => ({}); export const initializeAuth = () => ({});
export const indexedDBLocalPersistence = 1, browserLocalPersistence = 2;
export class GoogleAuthProvider { setCustomParameters() {} static credential() {} }
export const onAuthStateChanged = (a, fn) => setTimeout(() => fn({ uid: UID, email: EMAIL, displayName: localStorage.getItem("__nombre") || "Polete", getIdToken: async () => "x" }), 10);
export const signInWithPopup = async () => {}; export const signOut = async () => {}; export const signInWithCredential = async () => {};
// firestore
export const initializeFirestore = () => ({}); export const getFirestore = () => ({});
export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({});
export const collection = (db, ...p) => ({ path: p.join("/"), tipo: "col" });
export const doc = (db, ...p) => ({ path: p.join("/"), tipo: "doc", id: p[p.length - 1] });
export const where = (campo, op, valor) => ({ campo, op, valor });
export const query = (c, ...f) => ({ ...c, f });
const enCol = c => [...store].filter(([k]) => k.startsWith(c.path + "/") && !k.slice(c.path.length + 1).includes("/"))
  .filter(([, v]) => (c.f || []).every(w => w.op === ">=" ? v[w.campo] >= w.valor : w.op === "array-contains" ? (v[w.campo] || []).includes(w.valor) : true))
  .map(([k, v]) => ({ id: k.split("/").pop(), data: () => structuredClone(v) }));
export function onSnapshot(ref, next) {
  const run = () => ref.tipo === "doc" ? next({ exists: () => store.has(ref.path), data: () => structuredClone(store.get(ref.path)) }) : next({ docs: enCol(ref) });
  listeners.add(run); setTimeout(run, 5); return () => listeners.delete(run);
}
export const getDoc = async ref => ({ exists: () => store.has(ref.path), data: () => store.get(ref.path) });
export const setDoc = async (ref, v) => { store.set(ref.path, structuredClone(v)); notify(); };
export const arrayUnion = (...x) => ({ __union: x });
export const arrayRemove = (...x) => ({ __remove: x });
const aplicar = (orig, v) => {
  const o = structuredClone(orig || {});
  for (const [k, val] of Object.entries(v)) {
    const partes = k.split("."); let t = o; for (const p of partes.slice(0, -1)) t = t[p] ||= {};
    const u = partes.at(-1);
    if (val && val.__union) t[u] = [...new Set([...(t[u] || []), ...val.__union])];
    else if (val && val.__remove) t[u] = (t[u] || []).filter(x => !val.__remove.includes(x));
    else t[u] = structuredClone(val);
  }
  return o;
};
export const updateDoc = async (ref, v) => { store.set(ref.path, aplicar(store.get(ref.path), v)); notify(); };
export const deleteDoc = async ref => { store.delete(ref.path); notify(); };
export function writeBatch() {
  const ops = [];
  return { set: (r, v) => ops.push(() => store.set(r.path, structuredClone(v))), update: (r, v) => ops.push(() => store.set(r.path, { ...(store.get(r.path) || {}), ...structuredClone(v) })), delete: r => ops.push(() => store.delete(r.path)), commit: async () => { ops.forEach(f => f()); notify(); } };
}
