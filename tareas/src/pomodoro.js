// Motor de Enfoque: Pomodoro y otras metodologías. Sigue contando aunque cierres la app
// (se guarda la hora de fin o de inicio, no los segundos). P.tipo = la metodología elegida.
import * as D from "./datos.js";
import { S } from "./datos.js";
import { campana } from "./sonido.js";
import { esNativo, programarNativos, pantallaEncendida, llamar } from "./nativo.js";
import { notificarWeb } from "./avisos.js";

const LS = "tasca.pomodoro";
const base = { modo: "foco", estado: "parado", fin: 0, restante: 0, inicio: 0, tareaId: null, proyectoId: null, etiqueta: "", ciclos: 0, tipo: "pomodoro", acumulado: 0, minutos: 45, descansoFlow: 5, plan: null, hechos: 0 };
let P = (() => { try { return { ...base, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return { ...base }; } })();
const subs = new Set();
const guardar = () => { try { localStorage.setItem(LS, JSON.stringify(P)); } catch {} subs.forEach(f => f(P)); reloj(); };
export const suscribir = f => { subs.add(f); f(P); return () => subs.delete(f); };
export const estado = () => P;

const aj = k => Number(S.ajustes[k]) || { foco: 25, corto: 5, largo: 15, cadaLargo: 4 }[k];
/**
 * Metodologías. foco/descanso/largo en minutos; libre = el tiempo cuenta hacia arriba (sin final fijo).
 * flow = el descanso sale de lo estudiado (una quinta parte); sinDescanso = un solo bloque.
 */
export const METODOS = {
  pomodoro: { nombre: "Pomodoro", get corto() { return `${aj("foco")}/${aj("corto")}`; }, desc: "Bloques de concentración con descansos; cada pocos bloques, uno largo. La duración la eliges tú (25/5 es el clásico).", foco: () => aj("foco"), descanso: () => aj("corto"), largo: () => aj("largo"), cada: () => aj("cadaLargo") },
  "52-17": { nombre: "52/17", corto: "52/17", desc: "52 minutos a fondo y 17 de descanso de verdad. Va bien para tandas de problemas.", foco: () => 52, descanso: () => 17 },
  "90-20": { nombre: "Bloque profundo", corto: "90/20", desc: "Un bloque largo (el ritmo natural de la concentración, unos 90 min) y 20 de descanso. Para temas difíciles o repasos largos.", foco: () => 90, descanso: () => 20 },
  flow: { nombre: "Flowtime", corto: "Flow", desc: "Estudias sin reloj hasta que notes que bajas el ritmo. Al parar, descansas una quinta parte de lo que has estudiado.", libre: true, flow: true },
  cuenta: { nombre: "Temporizador", corto: "Tiempo", desc: "Un bloque de tiempo fijo que eliges tú, sin descansos. Para un examen de prueba o una entrega.", foco: () => Number(P.minutos) || 45, sinDescanso: true },
  crono: { nombre: "Cronómetro", corto: "Crono", desc: "Solo cuenta el tiempo que estudias, sin límites ni descansos.", libre: true, sinDescanso: true },
};
const met = () => METODOS[P.tipo] || METODOS.pomodoro;
export const metodo = met;
export const NOMBRES = { foco: "Concentración", corto: "Descanso", largo: "Descanso largo" };
/** ¿El reloj cuenta hacia arriba ahora? (cronómetro, o Flowtime mientras estudias) */
export const subiendo = () => !!met().libre && P.modo === "foco";
const duracion = modo => 60000 * (modo === "foco" ? met().foco?.() ?? 25 : modo === "largo" ? met().largo?.() ?? met().descanso?.() ?? 5 : met().flow ? P.descansoFlow || 5 : met().descanso?.() ?? 5);

/** Milisegundos que quedan (cuenta atrás) o que llevas (cuenta hacia arriba) */
export function tiempo() {
  if (subiendo()) return P.estado === "corriendo" ? P.acumulado + Date.now() - P.inicio : P.acumulado;
  if (P.estado === "corriendo") return Math.max(0, P.fin - Date.now());
  if (P.estado === "pausa") return P.restante;
  return duracion(P.modo);
}
export const total = () => duracion(P.modo);

export function elegirTarea(id) { P.tareaId = id || null; if (id) { P.proyectoId = null; P.etiqueta = ""; } guardar(); }
/** Sesión sin tarea: solo la asignatura y, si quieres, qué vas a hacer */
export function elegirLibre(proyectoId, etiqueta = "") { P.tareaId = null; P.proyectoId = proyectoId || null; P.etiqueta = (etiqueta || "").trim(); guardar(); }
export function elegirTipo(tipo) { if (P.estado !== "parado" || !METODOS[tipo]) return; P.tipo = tipo; P.modo = "foco"; P.ciclos = 0; guardar(); }
export function elegirModo(modo) { if (P.estado !== "parado") return; P.modo = modo; guardar(); }
/** Sesión de varios bloques seguidos (p. ej. 2 h = 4 pomodoros): se encadenan solos con sus descansos */
export function planificar(n) { P.plan = n && n > 1 ? n : null; P.hechos = 0; guardar(); }
export function elegirMinutos(n) { if (P.estado !== "parado") return; P.minutos = Math.max(1, Math.min(600, Number(n) || 45)); guardar(); }

export function empezar(tareaId) {
  if (tareaId !== undefined) elegirTarea(tareaId);
  if (P.plan && P.hechos >= P.plan) { P.plan = null; P.hechos = 0; } // la sesión anterior ya acabó
  P.inicio = Date.now(); P.empezado = Date.now(); P.estado = "corriendo"; P.acumulado = 0;
  if (!subiendo()) P.fin = Date.now() + duracion(P.modo);
  programarFin(); pantallaEncendida(true); guardar();
}
export function pausar() {
  if (P.estado !== "corriendo") return;
  if (subiendo()) P.acumulado += Date.now() - P.inicio; else P.restante = Math.max(0, P.fin - Date.now());
  P.estado = "pausa"; programarFin(); pantallaEncendida(false); guardar();
}
export function reanudar() {
  if (P.estado !== "pausa") return;
  if (subiendo()) P.inicio = Date.now(); else P.fin = Date.now() + P.restante;
  P.estado = "corriendo"; programarFin(); pantallaEncendida(true); guardar();
}
/** Minutos estudiados del bloque en marcha */
const estudiado = () => Math.round((subiendo() ? tiempo() : duracion("foco") - tiempo()) / 60000);
/** Parar. Si llevabas 5 min o más estudiando, se guarda lo hecho. */
export function parar() {
  if (P.modo === "foco" && P.estado !== "parado") { const m = estudiado(); if (m >= 5) registrar(m, met().libre ? P.tipo : "parcial"); }
  Object.assign(P, { estado: "parado", fin: 0, restante: 0, acumulado: 0, modo: "foco", plan: null, hechos: 0 });
  programarFin(); pantallaEncendida(false); guardar();
}
/** Flowtime: dejar de estudiar y empezar el descanso (una quinta parte de lo estudiado) */
export function descansar() {
  if (!met().flow || P.modo !== "foco" || P.estado === "parado") return;
  const m = estudiado();
  if (m >= 1) registrar(m, "flow");
  P.descansoFlow = Math.max(2, Math.min(30, Math.round(m / 5)));
  P.modo = "corto"; P.inicio = Date.now(); P.empezado = Date.now(); P.fin = Date.now() + duracion("corto"); P.estado = "corriendo"; P.acumulado = 0;
  programarFin(); guardar();
}
export function saltar() { Object.assign(P, { estado: "parado", modo: "foco", acumulado: 0 }); programarFin(); guardar(); }

function registrar(minutos, tipo = P.tipo, inicio = P.empezado) {
  const t = P.tareaId && S.tareas.find(x => x.id === P.tareaId);
  D.guardarFoco({ inicio: inicio || Date.now() - minutos * 60000, minutos, tipo, metodo: P.tipo, tareaId: t?.id || null, proyectoId: t?.proyectoId || P.proyectoId || null, titulo: t?.titulo || P.etiqueta || null });
  if (t && tipo === "pomodoro") D.cambiarTarea(t.id, { pomos: (t.pomos || 0) + 1 });
}

/** Pasa al siguiente tramo (bloque → descanso → bloque…) a la hora en que terminó el anterior. */
function avanzar() {
  const finAnt = P.fin, eraFoco = P.modo === "foco", m = met();
  let terminada = false;
  if (eraFoco) {
    registrar(Math.round(duracion("foco") / 60000), P.tipo, finAnt - duracion("foco"));
    P.ciclos++;
    if (P.plan) P.hechos++;
    terminada = !!m.sinDescanso || (P.plan && P.hechos >= P.plan);
    P.modo = terminada ? "foco" : m.cada && P.ciclos % m.cada() === 0 ? "largo" : "corto";
  } else P.modo = "foco";
  // en una sesión planificada el descanso empieza solo; el siguiente bloque, solo si lo tienes activado
  const auto = !terminada && !m.libre && (eraFoco ? P.plan || S.ajustes.autoDescanso : S.ajustes.autoFoco);
  P.estado = "parado"; P.acumulado = 0; P.fin = 0;
  if (auto) { P.inicio = finAnt; P.empezado = finAnt; P.fin = finAnt + duracion(P.modo); P.estado = "corriendo"; }
  return { eraFoco, terminada, finAnt };
}
/** Comprueba si ha terminado una cuenta atrás (cada medio segundo y al volver a la app). Si la app estaba
 *  cerrada, se pone al día tramo a tramo, como si hubiera seguido contando. */
export function comprobar({ silencioso = false } = {}) {
  if (subiendo() || P.estado !== "corriendo" || Date.now() < P.fin) return false;
  let r = null;
  for (let i = 0; i < 20 && P.estado === "corriendo" && !subiendo() && Date.now() >= P.fin; i++) r = avanzar();
  if (P.estado !== "corriendo") pantallaEncendida(false);
  programarFin(); guardar();
  const m = met(), reciente = Date.now() - r.finAnt < 60000;
  const texto = r.terminada && P.plan ? "¡Sesión terminada!" : textoFin(r.eraFoco, m)[0];
  if (!silencioso && reciente) {
    if (S.ajustes.sonidoFin !== false) campana(r.eraFoco ? 3 : 2);
    try { navigator.vibrate?.([200, 100, 200]); } catch {}
    if (document.hidden && !esNativo()) notificarWeb(texto, r.eraFoco ? (r.terminada ? "Buen trabajo." : `Descanso hasta las ${hora(P.fin)}.`) : siguienteTexto(), "pomodoro");
  }
  return { eraFoco: r.eraFoco, sinDescanso: m.sinDescanso, terminada: r.terminada, texto };
}
const hora = ms => new Date(ms).toTimeString().slice(0, 5);
const siguienteTexto = () => (P.plan ? `Toca para empezar el bloque ${Math.min(P.hechos + 1, P.plan)} de ${P.plan}.` : "Vuelta a concentrarse.");
const textoFin = (eraFoco, m = met()) => eraFoco ? (m.sinDescanso ? ["¡Tiempo!", "Has terminado el bloque."] : ["¡Bloque terminado!", "Toca descansar un poco."]) : ["Se acabó el descanso", "Vuelta a concentrarse."];

// avisos del sistema (APK), aunque la app esté en segundo plano: fin del bloque y fin del descanso,
// este con el botón «Empezar el siguiente bloque»
function programarFin() {
  if (!esNativo()) return;
  const avisos = [];
  if (!subiendo() && P.estado === "corriendo") {
    const m = met();
    if (P.modo === "foco") {
      const ultimo = m.sinDescanso || (P.plan && P.hechos + 1 >= P.plan);
      const conDescanso = !ultimo && !m.libre && (P.plan || S.ajustes.autoDescanso);
      const modoD = m.cada && (P.ciclos + 1) % m.cada() === 0 ? "largo" : "corto";
      const finD = P.fin + duracion(modoD);
      avisos.push({ id: 3000, at: new Date(P.fin), titulo: ultimo && P.plan ? "¡Sesión terminada!" : textoFin(true, m)[0], texto: ultimo ? "Buen trabajo." : conDescanso ? `Descanso hasta las ${hora(finD)}.` : "Toca descansar un poco.", extra: { vista: "enfoque" } });
      if (conDescanso) avisos.push({ id: 3001, at: new Date(finD), titulo: "Se acabó el descanso", texto: P.plan ? `Bloque ${P.hechos + 2} de ${P.plan}: pulsa «Empezar» para seguir.` : "Pulsa «Empezar» para el siguiente bloque.", extra: { vista: "enfoque", accion: "siguiente" }, tipoAccion: "SIGUIENTE" });
    } else {
      avisos.push({ id: 3001, at: new Date(P.fin), titulo: "Se acabó el descanso", texto: P.plan ? `Bloque ${P.hechos + 1} de ${P.plan}: pulsa «Empezar» para seguir.` : "Pulsa «Empezar» para el siguiente bloque.", extra: { vista: "enfoque", accion: "siguiente" }, tipoAccion: "SIGUIENTE" });
    }
  }
  programarNativos(3000, 3010, avisos, "pomodoro").catch(e => console.warn(e));
}

/** Notificación fija con el reloj mientras haya algo en marcha (APK: lo cuenta Android). */
let ultimoReloj = "";
function reloj() {
  if (!esNativo()) return;
  const t = P.tareaId && S.tareas.find(x => x.id === P.tareaId);
  const que = t?.titulo || P.etiqueta || "Estudio libre";
  const bloque = P.plan ? ` · bloque ${Math.min(P.hechos + (P.modo === "foco" ? 1 : 0), P.plan)} de ${P.plan}` : "";
  const nombre = P.modo === "foco" ? met().nombre : NOMBRES[P.modo];
  let args = null;
  if (P.estado === "corriendo") args = subiendo() ? { titulo: nombre + bloque, texto: que, base: P.inicio - P.acumulado, cuentaAtras: false } : { titulo: nombre + bloque, texto: P.modo === "foco" ? `${que} · hasta las ${hora(P.fin)}` : `Hasta las ${hora(P.fin)}`, base: P.fin, cuentaAtras: true };
  else if (P.estado === "pausa") args = { titulo: `En pausa · ${nombre}${bloque}`, texto: `${que} · ${subiendo() ? "llevas" : "quedan"} ${formato(tiempo())}`, base: Date.now(), pausa: true };
  const clave = JSON.stringify(args);
  if (clave === ultimoReloj) return;
  ultimoReloj = clave;
  (args ? llamar("Temporizador", "mostrar", args) : llamar("Temporizador", "ocultar")).catch(() => {}); // APK antiguo: sin el plugin
}

export const formato = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(x).padStart(2, "0"); };
