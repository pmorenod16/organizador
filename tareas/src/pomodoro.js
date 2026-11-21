// Motor del Pomodoro: sigue contando aunque cierres la app (se guarda la hora de fin, no los segundos).
import * as D from "./datos.js";
import { S } from "./datos.js";
import { campana } from "./sonido.js";
import { esNativo, programarNativos, pantallaEncendida } from "./nativo.js";
import { notificarWeb } from "./avisos.js";

const LS = "tasca.pomodoro";
const base = { modo: "foco", estado: "parado", fin: 0, restante: 0, inicio: 0, tareaId: null, ciclos: 0, tipo: "pomodoro", acumulado: 0 };
let P = (() => { try { return { ...base, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return { ...base }; } })();
const subs = new Set();
const guardar = () => { try { localStorage.setItem(LS, JSON.stringify(P)); } catch {} subs.forEach(f => f(P)); };
export const suscribir = f => { subs.add(f); f(P); return () => subs.delete(f); };
export const estado = () => P;

export const NOMBRES = { foco: "Concentración", corto: "Descanso", largo: "Descanso largo" };
const duracion = modo => 60 * 1000 * (Number(S.ajustes[modo]) || { foco: 25, corto: 5, largo: 15 }[modo]);

/** Milisegundos que quedan (pomodoro) o que llevas (cronómetro) */
export function tiempo() {
  if (P.tipo === "crono") return P.estado === "corriendo" ? P.acumulado + Date.now() - P.inicio : P.acumulado;
  if (P.estado === "corriendo") return Math.max(0, P.fin - Date.now());
  if (P.estado === "pausa") return P.restante;
  return duracion(P.modo);
}
export const total = () => duracion(P.modo);

export function elegirTarea(id) { P.tareaId = id || null; guardar(); }
export function elegirTipo(tipo) { if (P.estado !== "parado") return; P.tipo = tipo; P.modo = "foco"; guardar(); }
export function elegirModo(modo) { if (P.estado !== "parado") return; P.modo = modo; guardar(); }

export function empezar(tareaId) {
  if (tareaId !== undefined) P.tareaId = tareaId;
  if (P.tipo === "crono") { P.modo = "foco"; P.inicio = Date.now(); P.acumulado = 0; P.estado = "corriendo"; P.empezado = Date.now(); }
  else { P.fin = Date.now() + duracion(P.modo); P.inicio = Date.now(); P.estado = "corriendo"; P.empezado = Date.now(); }
  programarFin(); pantallaEncendida(true); guardar();
}
export function pausar() {
  if (P.estado !== "corriendo") return;
  if (P.tipo === "crono") { P.acumulado += Date.now() - P.inicio; }
  else P.restante = Math.max(0, P.fin - Date.now());
  P.estado = "pausa"; programarFin(); pantallaEncendida(false); guardar();
}
export function reanudar() {
  if (P.estado !== "pausa") return;
  if (P.tipo === "crono") P.inicio = Date.now(); else P.fin = Date.now() + P.restante;
  P.estado = "corriendo"; programarFin(); pantallaEncendida(true); guardar();
}
/** Parar. En cronómetro, o si ya llevabas 5+ min de un pomodoro, se guarda lo hecho. */
export function parar() {
  if (P.modo === "foco" && P.estado !== "parado") {
    const ms = P.tipo === "crono" ? tiempo() : duracion("foco") - tiempo();
    if (ms >= 5 * 60000) registrar(Math.round(ms / 60000), P.tipo === "crono" ? "crono" : "parcial");
  }
  Object.assign(P, { estado: "parado", fin: 0, restante: 0, acumulado: 0, modo: "foco" });
  programarFin(); pantallaEncendida(false); guardar();
}
export function saltar() { // saltar el descanso
  Object.assign(P, { estado: "parado", modo: "foco" }); programarFin(); guardar();
}

function registrar(minutos, tipo = "pomodoro") {
  const t = P.tareaId && S.tareas.find(x => x.id === P.tareaId);
  D.guardarFoco({ inicio: P.empezado || Date.now() - minutos * 60000, minutos, tipo, tareaId: t?.id || null, proyectoId: t?.proyectoId || null, titulo: t?.titulo || null });
  if (t && tipo === "pomodoro") D.cambiarTarea(t.id, { pomos: (t.pomos || 0) + 1 });
}

/** Comprueba si ha terminado (se llama cada segundo y al volver a la app). */
export function comprobar({ silencioso = false } = {}) {
  if (P.tipo !== "pomodoro" || P.estado !== "corriendo" || Date.now() < P.fin) return false;
  const eraFoco = P.modo === "foco";
  if (eraFoco) {
    registrar(Math.round(duracion("foco") / 60000));
    P.ciclos++;
    P.modo = P.ciclos % (Number(S.ajustes.cadaLargo) || 4) === 0 ? "largo" : "corto";
  } else P.modo = "foco";
  const auto = eraFoco ? S.ajustes.autoDescanso : S.ajustes.autoFoco;
  // si la app estaba cerrada y ya ha pasado también el descanso, no se encadena nada
  const tarde = Date.now() - P.fin > 60000;
  P.estado = "parado"; P.fin = 0;
  if (auto && !tarde) { P.fin = Date.now() + duracion(P.modo); P.inicio = Date.now(); P.estado = "corriendo"; P.empezado = Date.now(); }
  else pantallaEncendida(false);
  programarFin(); guardar();
  if (!silencioso && !tarde) {
    if (S.ajustes.sonidoFin !== false) campana(eraFoco ? 3 : 2);
    try { navigator.vibrate?.([200, 100, 200]); } catch {}
    if (document.hidden && !esNativo()) notificarWeb(eraFoco ? "¡Pomodoro terminado!" : "Se acabó el descanso", eraFoco ? "Toca descansar un poco." : "Vuelta a concentrarse.", "pomodoro");
  }
  return { eraFoco };
}

// aviso del sistema al acabar (APK), aunque la app esté en segundo plano
function programarFin() {
  if (!esNativo()) return;
  const avisos = P.tipo === "pomodoro" && P.estado === "corriendo" ? [{
    id: 3000, at: new Date(P.fin),
    titulo: P.modo === "foco" ? "¡Pomodoro terminado!" : "Se acabó el descanso",
    texto: P.modo === "foco" ? "Toca descansar un poco." : "Vuelta a concentrarse.",
    extra: { vista: "enfoque" },
  }] : [];
  programarNativos(3000, 3010, avisos, "pomodoro").catch(e => console.warn(e));
}

// focos de hoy y racha
export const formato = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(x).padStart(2, "0"); };
