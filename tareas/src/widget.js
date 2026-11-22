// Widget de la pantalla de inicio (Android): la app le pasa la agenda de los próximos días (eventos y tareas
// por hora) y el widget la enseña sin abrir Tasca. Lo que marques como hecho en el widget se aplica aquí al volver.
import * as D from "./datos.js";
import { S } from "./datos.js";
import { esNativo, llamar } from "./nativo.js";
import * as Cal from "./calendarios.js";
import { deVista } from "./logica.js";
import { hoyISO, sumarDias } from "./fechas.js";
import { proyectoDe } from "./lista.js";

const DIAS = 7, MAX = 40;

function dia(f, h) {
  const enl = Cal.enlacesDia(f);
  const tareas = f === h ? deVista("hoy", S.tareas, h) : deVista("dia", S.tareas, h, { fecha: f }).filter(t => !t.hecha);
  const items = [
    ...Cal.delDia(f).filter(e => !enl.porEvento.has(e.id)).map(e => {
      const k = e.todoElDia ? "00:00 0" : e.ini.slice(0, 10) < f ? "00:00 1" : e.ini.slice(11);
      return { k, tipo: "e", titulo: e.titulo, color: e.color, sub: [Cal.horaDe(e, f), e.lugar].filter(Boolean).join(" · ") };
    }),
    ...tareas.map(t => {
      const s = enl.porTarea.get(t.id), p = proyectoDe(t.proyectoId);
      const hora = s ? `${s.ini.slice(11)}–${s.fin.slice(11)}` : t.hora || "";
      const sub = [t.fecha < f ? "Vencida" : "", hora, p?.nombre].filter(Boolean).join(" · ");
      return { k: s?.ini.slice(11) || t.hora || "99:99", tipo: "t", id: t.id, titulo: t.titulo, color: p?.color || "#9A9AA2", sub, prio: t.prioridad || 4, vencida: t.fecha < f };
    }),
  ].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.tipo === "e" ? -1 : 1));
  return items.slice(0, MAX).map(({ k, ...x }) => x);
}

let ultima = "", t = 0;
/** Manda la agenda al widget (si ha cambiado). Se llama después de cada repintado. */
export function actualizar() {
  if (!esNativo() || !S.listo) return;
  clearTimeout(t);
  t = setTimeout(() => {
    const h = hoyISO(), dias = {};
    for (let i = 0; i < DIAS; i++) { const f = sumarDias(h, i); dias[f] = dia(f, h); }
    const json = JSON.stringify({ dias, color: getComputedStyle(document.documentElement).getPropertyValue("--resalte-texto").trim() || "#6F61A8" });
    if (json === ultima) return;
    ultima = json;
    llamar("Widget", "guardar", { datos: json }).catch(() => {}); // APK antiguo: sin widget
  }, 800);
}

/** Tareas marcadas en el widget y acción pedida (el + del widget) */
export async function alVolver({ anadir } = {}) {
  if (!esNativo() || !S.listo) return;
  let r;
  try { r = await llamar("Widget", "pendientes"); } catch { return; }
  for (const id of r?.hechas || []) {
    const tarea = S.tareas.find(x => x.id === id);
    if (tarea && !tarea.hecha) await D.alternar(tarea).catch(() => {});
  }
  if (r?.hechas?.length) ultima = "";
  if (r?.accion === "anadir" && anadir) anadir();
}
