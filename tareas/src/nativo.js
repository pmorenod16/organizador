// Puente con Android (Capacitor). En la web estas funciones no hacen nada o usan el navegador.
export const esNativo = () => !!(window.Capacitor?.isNativePlatform?.());

// El APK carga esta web desde internet; el puente nativo no trae registerPlugin, así que se usa la
// copia local de @capacitor/core del Organizador. Un plugin responde a cualquier método (también a
// «then»), por eso nunca se devuelve directamente desde una promesa: se guarda dentro de { p }.
const plugins = {};
function plug(nombre) {
  return plugins[nombre] ||= (async () => {
    const reg = typeof window.Capacitor?.registerPlugin === "function" ? window.Capacitor.registerPlugin : (await import("../../capacitor-core.js")).registerPlugin;
    return { p: reg(nombre) };
  })();
}
export const llamar = async (nombre, metodo, ...args) => (await plug(nombre)).p[metodo](...args);

let canal = null;
async function preparar() {
  return canal ||= (async () => {
    const perm = await llamar("LocalNotifications", "checkPermissions");
    if (perm.display !== "granted") await llamar("LocalNotifications", "requestPermissions");
    await llamar("LocalNotifications", "createChannel", { id: "recordatorios", name: "Recordatorios", description: "Avisos de tus tareas", importance: 5, vibration: true });
    await llamar("LocalNotifications", "createChannel", { id: "pomodoro", name: "Pomodoro", description: "Fin del pomodoro o del descanso", importance: 5, vibration: true });
    return true;
  })().catch(e => { canal = null; throw e; });
}

/** Sustituye todos los avisos de un tipo (rango de ids) por los nuevos. avisos = [{ id, titulo, texto, at: Date, extra }] */
export async function programarNativos(desde, hasta, avisos, canalId) {
  if (!esNativo()) return;
  await preparar();
  const pend = (await llamar("LocalNotifications", "getPending")).notifications || [];
  const viejos = pend.filter(n => n.id >= desde && n.id < hasta);
  if (viejos.length) await llamar("LocalNotifications", "cancel", { notifications: viejos.map(n => ({ id: n.id })) });
  if (!avisos.length) return;
  await llamar("LocalNotifications", "schedule", {
    notifications: avisos.map(a => ({ id: a.id, channelId: canalId, title: a.titulo, body: a.texto, extra: a.extra || null, schedule: { at: a.at, allowWhileIdle: true } })),
  });
}

/** Al tocar un aviso del sistema */
export async function alTocarAviso(fn) {
  if (!esNativo()) return;
  try { await llamar("LocalNotifications", "addListener", "localNotificationActionPerformed", e => fn(e?.notification?.extra || {})); } catch (e) { console.warn(e); }
}

/** Mantener la pantalla encendida durante el pomodoro (web: Wake Lock) */
let bloqueo = null;
export async function pantallaEncendida(si) {
  try {
    if (si && !bloqueo && "wakeLock" in navigator) { bloqueo = await navigator.wakeLock.request("screen"); bloqueo.addEventListener("release", () => (bloqueo = null)); }
    if (!si && bloqueo) { await bloqueo.release(); bloqueo = null; }
  } catch {}
}
