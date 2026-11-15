// Arranque: login, carga de datos, plan del día y entrada por texto/voz.
import { firebaseConfig, OWNER_UID } from "../config.js";
import * as store from "./store.js";
import * as ia from "./ia.js";
import { planDay } from "./planificador.js";
import { montarDia, combinarTareas } from "./montar.js";
import { entregas } from "./clasificar.js";
import { validar, describir, aplicar } from "./acciones.js";
import { completarPerfil, urlsCalendario } from "./perfil.js";
import { fechaLocal, sumarDias, aMinutos, diaSemana, hhmm } from "./tiempo.js";
import { pintarDia, esc } from "./vistas/dia.js";
import { pintarConfiguracion } from "./vistas/configuracion.js";
import { esNativo, programarAvisos, ponerAlarma, escucharVoz } from "./nativo.js";

export const APP_VERSION = "2026-11-15-4";

const $ = s => document.querySelector(s);
const PANTALLAS = ["carga", "login", "sinAcceso", "app"];
const mostrar = id => PANTALLAS.forEach(p => ($("#" + p).hidden = p !== id));
let toastT;
function toast(t, ms = 2800) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), ms); }
const fallo = m => { $("#cargaError").textContent = String(m).slice(0, 240); };
window.addEventListener("unhandledrejection", e => { console.error(e.reason); if (!$("#carga").hidden) fallo(e.reason?.message || e.reason); else toast(e.reason?.message || "Algo ha fallado"); });

// ---------- actualizarse sola ----------
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const APK_URL = "https://github.com/pmorenod16/organizador/releases/latest/download/organizador.apk";
{ const q = new URLSearchParams(location.search).get("apk"); if (q) ls.set("apkVer", q); }
let ultimaApk = 0;
async function comprobarVersion() {
  if (!navigator.onLine) return;
  try {
    const r = await fetch("./src/main.js?v=" + Date.now(), { cache: "no-store" });
    const m = r.ok && (await r.text()).match(/APP_VERSION = "([^"]+)"/);
    const ocupado = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if (m && m[1] !== APP_VERSION && ss.get("intentoVersion") !== m[1] && !ocupado) {
      ss.set("intentoVersion", m[1]);
      try { await (await navigator.serviceWorker?.getRegistration())?.update(); } catch {}
      const u = new URL(location.href); u.searchParams.set("v", Date.now()); location.replace(u.toString());
      return;
    }
  } catch {}
  if (esNativo() && Date.now() - ultimaApk > 30 * 60 * 1000) {
    ultimaApk = Date.now();
    try {
      const r = await fetch("https://api.github.com/repos/pmorenod16/organizador/releases/latest", { cache: "no-store" });
      const n = r.ok ? Number(((await r.json()).tag_name || "").split(".").pop()) : 0;
      if (n && n > (Number(ls.get("apkVer")) || 0) && ls.get("apkOfrecido") !== String(n)) {
        ls.set("apkOfrecido", String(n));
        toast("Hay una versión nueva de la app: ábrela e instálala encima.", 5000);
        setTimeout(() => { location.href = APK_URL; }, 1500);
      }
    } catch {}
  }
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
comprobarVersion();

// ---------- Firebase ----------
if (!firebaseConfig.apiKey) { fallo("Falta pegar la configuración de Firebase en config.js (GUIA.md, paso 1)."); throw new Error("config"); }
const V = "10.12.2";
const [{ initializeApp }, A, F] = await Promise.all([
  import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
  import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
]);
const app = initializeApp(firebaseConfig);
// En el WebView de Android getAuth() se queda esperando un iframe: allí se usa initializeAuth.
const auth = esNativo() ? A.initializeAuth(app, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] }) : A.getAuth(app);
auth.languageCode = "es";
let db;
try { db = esNativo() ? F.getFirestore(app) : F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
catch { db = F.getFirestore(app); }

let _core;
const pluginAuth = async () => {
  const reg = typeof window.Capacitor?.registerPlugin === "function" ? window.Capacitor.registerPlugin : (_core ||= await import("../capacitor-core.js")).registerPlugin;
  return { p: reg("FirebaseAuthentication") };
};
$("#btnGoogle").onclick = async () => {
  $("#loginError").textContent = "";
  try {
    if (esNativo()) {
      $("#loginError").textContent = "Abriendo tu cuenta de Google…";
      const r = await (await pluginAuth()).p.signInWithGoogle();
      const idToken = r?.credential?.idToken;
      if (!idToken) throw new Error("Google no ha devuelto la cuenta.");
      await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(idToken));
    } else {
      const prov = new A.GoogleAuthProvider(); prov.setCustomParameters({ prompt: "select_account" });
      await A.signInWithPopup(auth, prov);
    }
  } catch (e) {
    $("#loginError").textContent = /cancel|closed-by-user/i.test(e?.code || e?.message || "") ? "Has cancelado el inicio de sesión." : `No se ha podido entrar (${e?.code || e?.message || e}).`;
  }
};
$("#btnSalir").onclick = () => A.signOut(auth);
$("#btnCopiarUid").onclick = () => navigator.clipboard?.writeText($("#uidTexto").textContent).then(() => toast("Copiado"));

// ---------- estado ----------
const S = { perfil: null, tareas: [], dias: {}, eventos: [], vista: "hoy", plan: null, cargadoEventos: 0 };
const hoy = () => fechaLocal(new Date());
const ahora = () => aMinutos(new Date().toISOString(), hoy());
const fechaVista = () => (S.vista === "hoy" ? hoy() : sumarDias(hoy(), 1));

A.onAuthStateChanged(auth, async user => {
  if (!user) { mostrar("login"); return; }
  if (!OWNER_UID || user.uid !== OWNER_UID) {
    $("#sinAccesoTexto").innerHTML = OWNER_UID
      ? "Esta cuenta no tiene acceso a este organizador."
      : "Copia este identificador y pásaselo a Claude (o pégalo en <code>config.js</code> y en las reglas de Firestore, GUIA.md paso 4):";
    $("#uidTexto").textContent = user.uid;
    mostrar("sinAcceso");
    return;
  }
  $("#cargaTexto").textContent = "Cargando tus datos…";
  mostrar("carga");
  store.iniciarStore(F, db, user.uid);
  ia.usarToken(() => user.getIdToken());
  await recargarDatos();
  mostrar("app");
  if (!S.perfil) abrirConfiguracion(); else { await cargarEventos(); pintar(); }
});

// Se recarga al entrar y cada vez que vuelves a la app: así el móvil y el ordenador no se pisan
// los cambios y, pasada la medianoche, se leen los días nuevos.
async function recargarDatos() {
  const lunes = sumarDias(hoy(), -diaSemana(hoy()));
  const [perfil, tareas, dias] = await Promise.all([store.cargarPerfil(), store.cargarTareas(), store.cargarDias(lunes, sumarDias(hoy(), 1))]);
  Object.assign(S, { perfil: perfil && completarPerfil(perfil), tareas, dias, cargadoDia: hoy() });
  if (S.perfil && !S.perfil.creadoEl) { S.perfil.creadoEl = hoy(); await store.guardarPerfil(S.perfil); }
}

async function cargarEventos(forzar = false) {
  const urls = urlsCalendario(S.perfil);
  const cache = (() => { try { return JSON.parse(ls.get("eventos") || "null"); } catch { return null; } })();
  if (cache && cache.urls === urls.join("|")) { S.eventos = cache.eventos; S.cargadoEventos = cache.t; }
  if (!urls.length || (!forzar && Date.now() - S.cargadoEventos < 30 * 60 * 1000)) return;
  try {
    const r = await ia.eventos(urls, sumarDias(hoy(), -1), sumarDias(hoy(), 21));
    S.eventos = r.eventos; S.cargadoEventos = Date.now();
    ls.set("eventos", JSON.stringify({ urls: urls.join("|"), eventos: r.eventos, t: S.cargadoEventos }));
    if (r.fallidos?.length) toast(`No he podido leer ${r.fallidos.length} calendario(s). Revisa el enlace en ⚙️.`, 5000);
  } catch (e) {
    toast(`Calendarios: ${e.message}`, 5000);
  }
}

// ---------- plan ----------
// Hoy se planifica desde ahora y sabiendo a qué hora hay que levantarse mañana (para no recortar
// sueño por debajo del mínimo). Mañana se planifica sabiendo a qué hora acaba hoy (sueño real).
function calcular(fecha) {
  const entrada = montarDia({ fecha, eventos: S.eventos, perfil: S.perfil, tareas: S.tareas, dias: S.dias });
  if (fecha === hoy()) {
    entrada.ahora = ahora();
    const manana = montarDia({ fecha: sumarDias(fecha, 1), eventos: S.eventos, perfil: S.perfil, tareas: [], dias: S.dias });
    entrada.levantarseManana = planDay(manana).horaLevantarse;
  } else {
    const deHoy = calcular(sumarDias(fecha, -1)).plan;
    const fin = Math.max(...deHoy.bloques.filter(b => b.tipo !== "trayecto").map(b => b.fin), 0);
    entrada.overrides.horaDormirAnterior = Math.max(S.perfil.horaDormir, fin) % 1440;
  }
  const plan = planDay(entrada);
  const descartadas = new Set(S.dias[fecha]?.propuestasNo || []);
  plan.propuestas = plan.propuestas.filter(p => !descartadas.has(`${p.tipo}:${p.refId}`));
  return { plan, tareas: entrada.tareas };
}

function pintar() {
  const fecha = fechaVista();
  const { plan, tareas } = calcular(fecha);
  S.plan = plan; S.tareasVista = tareas;
  document.querySelectorAll("[data-vista]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.vista === S.vista)));
  const pasosHechos = (S.dias[fecha]?.pasosHechos || []).filter(id => tareas.some(t => t.pasos.some(p => p.id === id && p.hecho)));
  pintarDia($("#vista"), { plan, esHoy: S.vista === "hoy", ahora: ahora(), tareas, perfil: S.perfil, hechosHoy: S.dias[fecha]?.hechosObjetivo, pasosHechos, nativo: esNativo() }, {
    paso: (id, hecho) => cambiarPaso(fecha, id, hecho),
    objetivo: (id, hecho) => guardarDia(fecha, { hechosObjetivo: { ...(S.dias[fecha]?.hechosObjetivo || {}), [id]: hecho } }),
    propuesta: (p, acepta) => acepta ? aplicarAcciones([{ tipo: "no-ir", refId: p.refId }, ...(p.tipo === "saltar-clase" ? [recuperar(plan, p.refId)] : [])], fecha)
      : guardarDia(fecha, { propuestasNo: [...(S.dias[fecha]?.propuestasNo || []), `${p.tipo}:${p.refId}`] }),
    menuBloque: b => menuBloque(b, fecha),
    alarma: async () => { await ponerAlarma(plan.horaLevantarse); toast(`Alarma puesta a las ${hhmm(plan.horaLevantarse)}`); },
  });
  // avisos de hoy y de mañana (por si mañana no abres la app)
  const otro = S.vista === "hoy" ? calcular(sumarDias(fecha, 1)).plan : calcular(hoy()).plan;
  programarAvisos(S.vista === "hoy" ? [plan, otro] : [otro, plan]);
  alarmaAutomatica(S.vista === "hoy" ? otro : plan);
}

// Al saltarse una clase queda apuntado qué recuperar para el examen.
function recuperar(plan, refId) {
  const titulo = plan.bloques.find(b => b.refId === refId)?.titulo || "la clase";
  return { tipo: "tarea", tarea: { titulo: `Recuperar: ${titulo} (${plan.fecha})`, tipo: "estudio", fechaLimite: null, sitioId: null,
    pasos: [{ titulo: `Conseguir los apuntes o diapositivas de ${titulo} del ${plan.fecha}`, minutos: 15 }, { titulo: `Repasar lo que se dio y anotar dudas`, minutos: 45 }] } };
}

async function alarmaAutomatica(plan) {
  if (!esNativo()) return;
  const clave = `${plan.fecha}@${plan.horaLevantarse}`;
  if (ls.get("alarmaPuesta") === clave) return;
  try { await ponerAlarma(plan.horaLevantarse); ls.set("alarmaPuesta", clave); toast(`Alarma de mañana: ${hhmm(plan.horaLevantarse)}`); } catch (e) { console.warn(e); }
}

async function guardarDia(fecha, cambios) {
  S.dias[fecha] = { ...(S.dias[fecha] || {}), ...cambios };
  pintar();
  await store.guardarDia(fecha, S.dias[fecha]);
}

async function cambiarPaso(fecha, pasoId, hecho) {
  const t = structuredClone(S.tareasVista.find(x => x.pasos.some(p => p.id === pasoId)));
  if (!t) return;
  t.pasos.find(p => p.id === pasoId).hecho = hecho;
  S.tareas = [...S.tareas.filter(x => x.id !== t.id), t];
  // lo hecho hoy se queda a la vista (y se puede desmarcar)
  const lista = new Set(S.dias[fecha]?.pasosHechos || []);
  hecho ? lista.add(pasoId) : lista.delete(pasoId);
  S.dias[fecha] = { ...(S.dias[fecha] || {}), pasosHechos: [...lista] };
  pintar();
  await Promise.all([store.guardarTarea(t), store.guardarDia(fecha, S.dias[fecha])]);
}

function menuBloque(b, fecha) {
  const marca = (S.perfil.marcas || {})[b.refId?.split("@")[0]] || {};
  const obligatorio = b.tipo === "practica" || b.tipo === "examen";
  modal(`<h2>${esc(b.titulo)}</h2><p class="suave">${hhmm(b.inicio)}–${hhmm(b.fin)}</p>
    <div class="botones" style="flex-direction:column;align-items:stretch">
      <button class="btn" data-op="noir">No voy esta vez</button>
      <button class="btn" data-op="oblig">${obligatorio ? "No es obligatoria" : "Es obligatoria (no se puede saltar)"}</button>
      <button class="btn" data-op="cerrar">Cerrar</button></div>`, async op => {
    if (op === "noir") await aplicarAcciones([{ tipo: "no-ir", refId: b.refId }], fecha);
    if (op === "oblig") {
      const uid = b.refId.split("@")[0];
      S.perfil.marcas = { ...(S.perfil.marcas || {}), [uid]: { ...marca, obligatorio: !obligatorio, tipo: !obligatorio ? "practica" : "clase" } };
      pintar(); await store.guardarPerfil(S.perfil);
    }
  });
}

// ---------- acciones (IA o botones) ----------
async function aplicarAcciones(acciones, fecha = fechaVista()) {
  const antes = { perfil: S.perfil, tareas: combinarTareas(entregas(S.eventos, S.perfil), S.tareas), dia: { fecha, ...(S.dias[fecha] || {}) } };
  const despues = aplicar(antes, acciones, { ahora: fecha === hoy() ? ahora() : 0 });
  const cambiadas = despues.tareas.filter(t => JSON.stringify(t) !== JSON.stringify(antes.tareas.find(x => x.id === t.id)));
  const perfilCambia = JSON.stringify(despues.perfil) !== JSON.stringify(S.perfil);
  S.perfil = despues.perfil;
  S.tareas = [...S.tareas.filter(t => !cambiadas.some(c => c.id === t.id)), ...cambiadas];
  const { fecha: _f, ...dia } = despues.dia;
  S.dias[fecha] = dia;
  pintar();
  await Promise.all([
    ...cambiadas.map(t => store.guardarTarea(t)),
    perfilCambia ? store.guardarPerfil(S.perfil) : null,
    store.guardarDia(fecha, dia),
  ]);
}

function contextoIA() {
  const tareas = combinarTareas(entregas(S.eventos, S.perfil), S.tareas).filter(t => t.pasos.some(p => !p.hecho)).slice(0, 40);
  return {
    asignaturas: S.perfil.asignaturas.map(a => a.nombre),
    sitios: S.perfil.sitios.map(s => s.nombre),
    tareas: tareas.map(t => ({ id: t.id, titulo: t.titulo, fechaLimite: t.fechaLimite, pasos: t.pasos.filter(p => !p.hecho).map(p => ({ id: p.id, titulo: p.titulo })) })),
    bloques: (S.plan?.bloques || []).filter(b => b.refId).map(b => ({ refId: b.refId, titulo: b.titulo, tipo: b.tipo, inicio: hhmm(b.inicio) })),
    objetivos: S.perfil.objetivos.map(o => ({ refId: o.id, titulo: o.titulo })),
  };
}
// El trabajo no se puede «no ir»: solo cambia con trabajo-dia o trabajo-horario.
const refsValidas = () => {
  const c = contextoIA();
  return [...c.tareas.flatMap(t => [t.id, ...t.pasos.map(p => p.id)]), ...c.bloques.filter(b => b.tipo !== "trabajo").map(b => b.refId), ...c.objetivos.map(o => o.refId)];
};

async function enviar(texto) {
  if (!texto.trim()) return;
  const form = $("#entrada");
  form.classList.add("ocupada");
  try {
    const fecha = fechaVista();
    const r = await ia.entrada(texto, { fecha: hoy(), fechaVista: fecha, ahora: ahora(), contexto: contextoIA() });
    const v = validar(r, refsValidas());
    if (!v.ok) { toast(`No lo he entendido bien (${v.error}). Prueba a decirlo de otra forma.`, 5000); return; }
    if (!v.acciones.length) { toast("No he visto nada que cambiar. Prueba a decirlo de otra forma."); return; }
    const nombres = Object.fromEntries([...(S.plan?.bloques || []).map(b => [b.refId, b.titulo]), ...contextoIA().tareas.flatMap(t => [[t.id, t.titulo], ...t.pasos.map(p => [p.id, p.titulo])])]);
    modal(`<h2>¿Lo aplico?</h2><p class="suave">«${esc(texto)}»</p><ul>${v.acciones.map(a => `<li>${esc(describir(a, nombres))}${a.tipo === "tarea" ? `<ul>${a.tarea.pasos.map(p => `<li>${esc(p.titulo)} · ${p.minutos} min</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>
      <div class="botones"><button class="btn" data-op="cerrar">Cancelar</button><button class="btn primario" data-op="aplicar">Aplicar</button></div>`, async op => {
      if (op === "aplicar") { await aplicarAcciones(v.acciones, fecha); $("#entradaTexto").value = ""; toast("Hecho. He reorganizado el día."); }
    });
  } catch (e) {
    toast(e.message, 5000);
  } finally {
    form.classList.remove("ocupada");
  }
}

function modal(html, alElegir) {
  $("#modalContenido").innerHTML = html;
  $("#modal").hidden = false;
  $("#modal").onclick = async e => {
    const op = e.target.dataset?.op || (e.target === $("#modal") ? "cerrar" : null);
    if (!op) return;
    $("#modal").hidden = true;
    if (op !== "cerrar") await alElegir(op);
  };
}

function abrirConfiguracion() {
  $("#entrada").hidden = true;
  pintarConfiguracion($("#vista"), S.perfil, {
    probarCalendario: async url => {
      const r = await ia.eventos([url], hoy(), sumarDias(hoy(), 14));
      if (r.fallidos?.length) throw new Error("No he podido leer ese enlace. ¿Está bien copiado y es la dirección secreta?");
      return `${r.eventos.length} eventos en las próximas 2 semanas`;
    },
    guardar: async p => {
      p.creadoEl ||= hoy();
      S.perfil = p;
      await store.guardarPerfil(p);
      $("#entrada").hidden = false;
      await cargarEventos(true);
      pintar();
      toast("Guardado");
    },
    cancelar: () => { $("#entrada").hidden = false; pintar(); },
  });
}

// ---------- eventos de la interfaz ----------
document.querySelectorAll("[data-vista]").forEach(b => (b.onclick = () => { S.vista = b.dataset.vista; pintar(); window.scrollTo(0, 0); }));
$("#btnAjustes").onclick = () => abrirConfiguracion();
$("#entrada").onsubmit = e => { e.preventDefault(); enviar($("#entradaTexto").value); };
$("#btnVoz").onclick = async () => {
  try {
    toast("Te escucho…", 8000);
    const t = await escucharVoz();
    $("#toast").hidden = true;
    if (t) { $("#entradaTexto").value = t; enviar(t); }
  } catch (e) { toast(e.message); }
};
setInterval(() => { if (S.perfil && !$("#app").hidden && $("#modal").hidden && !$("#entrada").hidden) pintar(); }, 5 * 60 * 1000);
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !S.perfil || $("#entrada").hidden) return;
  comprobarVersion();
  try { await recargarDatos(); } catch (e) { console.warn(e); }
  await cargarEventos();
  pintar();
});
