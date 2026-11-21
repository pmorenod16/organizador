// Recordatorios de las tareas.
// · En el APK: avisos del sistema a su hora exacta, aunque la app esté cerrada.
// · En la web: avisos del navegador mientras la pestaña esté abierta (los navegadores no permiten
//   programar avisos con la web cerrada sin un servidor).
import { S } from "./datos.js";
import { aDate, hoyISO, sumarDias } from "./fechas.js";
import { esNativo, programarNativos } from "./nativo.js";
import { proyectoDe } from "./lista.js";

const HORA_SIN_HORA = "09:00";
const DIAS = 21, MAX = 60;

/** Avisos que tocan desde ahora: [{ at: Date, tarea, min }] */
export function proximos(ahora = Date.now()) {
  const hoy = hoyISO(), fin = sumarDias(hoy, DIAS);
  const out = [];
  for (const t of S.tareas) {
    if (t.hecha || !t.fecha || !t.recordatorios?.length || t.fecha > fin || t.fecha < sumarDias(hoy, -1)) continue;
    for (const min of t.recordatorios) {
      const at = new Date(aDate(t.fecha, t.hora || HORA_SIN_HORA).getTime() - min * 60000);
      if (at.getTime() > ahora + 5000) out.push({ at, tarea: t, min });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX);
}
const texto = (t, min) => {
  const p = proyectoDe(t.proyectoId);
  const cuando = min === 0 ? (t.hora ? `Ahora · ${t.hora}` : "Hoy") : min >= 1440 ? `Mañana${t.hora ? " a las " + t.hora : ""}` : `En ${min} min · ${t.hora}`;
  return [cuando, p?.nombre].filter(Boolean).join(" · ");
};

let espera = null, timers = [];
export function reprogramar() {
  clearTimeout(espera);
  espera = setTimeout(async () => {
    const lista = proximos();
    if (esNativo()) {
      try {
        await programarNativos(2000, 3000, lista.map((a, i) => ({ id: 2000 + i, titulo: a.tarea.titulo, texto: texto(a.tarea, a.min), at: a.at, extra: { tarea: a.tarea.id } })), "recordatorios");
      } catch (e) { console.warn("avisos", e); }
      return;
    }
    // web: temporizadores para las próximas 24 h
    timers.forEach(clearTimeout); timers = [];
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    for (const a of lista) {
      const ms = a.at - Date.now();
      if (ms > 864e5) break;
      timers.push(setTimeout(() => notificarWeb(a.tarea.titulo, texto(a.tarea, a.min), "t-" + a.tarea.id + a.min, { tarea: a.tarea.id }), ms));
    }
  }, 1500);
}

export async function notificarWeb(titulo, cuerpo, tag, data = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const op = { body: cuerpo, tag, icon: "icon-192.png", badge: "icon-192.png", data, vibrate: [120, 60, 120] };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return reg.showNotification(titulo, op); } catch {}
  try { new Notification(titulo, op); } catch {}
}

export async function pedirPermiso() {
  if (esNativo()) { reprogramar(); return true; }
  if (!("Notification" in window)) return false;
  const r = await Notification.requestPermission();
  reprogramar();
  return r === "granted";
}
export const permisoWeb = () => ("Notification" in window ? Notification.permission : "unsupported");
