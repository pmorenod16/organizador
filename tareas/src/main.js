// Tasca: arranque, inicio de sesión, navegación y eventos.
import { firebaseConfig, OWNER_UID } from "../../config.js";
import * as D from "./datos.js";
import { S } from "./datos.js";
import { $, $$, esc, toast, hoja, hayHoja, vibrar } from "./ui.js";
import * as V from "./vistas.js";
import { enfoque, tic, elegirTareaHtml, estadisticas } from "./enfoque.js";
import * as A from "./ajustes.js";
import * as P from "./pomodoro.js";
import { anadir, abrirTarea } from "./editor.js";
import { alternarAbierta, icono } from "./lista.js";
import { reprogramar } from "./avisos.js";
import { ruido, volumenRuido } from "./sonido.js";
import { esNativo, alTocarAviso } from "./nativo.js";
import { hoyISO, sumarDias } from "./fechas.js";
import { deVista } from "./logica.js";
import * as Act from "./actualizar.js";

const PANTALLAS = ["carga", "login", "sinAcceso", "app"];
const mostrar = id => PANTALLAS.forEach(p => ($("#" + p).hidden = p !== id));
const fallo = m => { $("#cargaError").textContent = String(m).slice(0, 300); };
window.addEventListener("unhandledrejection", e => { console.error(e.reason); if (!$("#carga").hidden) fallo(e.reason?.message || e.reason); else toast(e.reason?.message || "Algo ha fallado"); });

// ---------- tema ----------
const tema = t => { document.documentElement.dataset.tema = t === "claro" || t === "oscuro" ? t : ""; };
try { tema(localStorage.getItem("tasca.tema") || "auto"); } catch {}

// ---------- service worker y actualizaciones ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
navigator.serviceWorker?.addEventListener("message", e => { if (e.data?.tarea) abrirTarea(e.data.tarea, { alFoco }); });
// actualizarse sola (como el Armario)
Act.empezar();

// ---------- Firebase ----------
const FV = "10.12.2";
const [{ initializeApp }, Au, F] = await Promise.all([
  import(`https://www.gstatic.com/firebasejs/${FV}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${FV}/firebase-auth.js`),
  import(`https://www.gstatic.com/firebasejs/${FV}/firebase-firestore.js`),
]);
const app = initializeApp(firebaseConfig, "tasca");
// En el WebView de Android getAuth() se queda esperando un iframe: allí se usa initializeAuth.
const auth = esNativo() ? Au.initializeAuth(app, { persistence: [Au.indexedDBLocalPersistence, Au.browserLocalPersistence] }) : Au.getAuth(app);
auth.languageCode = "es";
let db;
try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
catch { db = F.getFirestore(app); }

const pluginAuth = async () => {
  const reg = typeof window.Capacitor?.registerPlugin === "function" ? window.Capacitor.registerPlugin : (await import("../../capacitor-core.js")).registerPlugin;
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
      await Au.signInWithCredential(auth, Au.GoogleAuthProvider.credential(idToken));
    } else {
      const prov = new Au.GoogleAuthProvider(); prov.setCustomParameters({ prompt: "select_account" });
      await Au.signInWithPopup(auth, prov);
    }
  } catch (e) {
    $("#loginError").textContent = /cancel|closed-by-user/i.test(e?.code || e?.message || "") ? "Has cancelado el inicio de sesión." : `No se ha podido entrar (${e?.code || e?.message || e}).`;
  }
};
const salir = async () => { try { if (esNativo()) await (await pluginAuth()).p.signOut(); } catch {} await Au.signOut(auth); };
$("#btnSalir").onclick = salir;

let usuario = null;
Au.onAuthStateChanged(auth, user => {
  if (!user) { mostrar("login"); return; }
  if (user.uid !== OWNER_UID) {
    $("#uidTexto").textContent = user.uid;
    mostrar("sinAcceso");
    return;
  }
  if (usuario) return;
  usuario = user;
  $("#cargaTexto").textContent = "Cargando tus tareas…";
  mostrar("carga");
  D.iniciar(F, db, user.uid);
});

// ---------- estado de la interfaz ----------
const UI = { ruta: "hoy", arg: null, cal: {}, verHechas: {}, q: "", ruido: "", volumen: 0.5, pantallaCompleta: false };
try { Object.assign(UI, JSON.parse(localStorage.getItem("tasca.ui") || "{}"), { ruido: "", pantallaCompleta: false }); } catch {}
const guardarUI = () => { try { localStorage.setItem("tasca.ui", JSON.stringify({ cal: UI.cal, verHechas: UI.verHechas, volumen: UI.volumen })); } catch {} };

function leerRuta() {
  const [r, arg] = (location.hash.replace(/^#\/?/, "") || "hoy").split("/");
  UI.ruta = r || "hoy"; UI.arg = arg ? decodeURIComponent(arg) : null;
}
window.addEventListener("hashchange", () => { leerRuta(); pintar(); $("#vista").scrollTop = 0; window.scrollTo(0, 0); cerrarMenu(); });

D.alCambiar((s, err) => {
  if (err) { if (!s.listo) fallo("No se pueden leer los datos: " + (err.code || err.message)); else toast("Sin permiso o sin conexión con la base de datos"); return; }
  if (!s.listo) return;
  if (!$("#carga").hidden) mostrar("app");
  tema(s.ajustes.tema); try { localStorage.setItem("tasca.tema", s.ajustes.tema || "auto"); } catch {}
  pintar();
  reprogramar();
});

// ---------- pintar ----------
const RUTAS = { hoy: "Hoy", proximos: "Próximos", calendario: "Calendario", enfoque: "Enfoque", estadisticas: "Estadísticas", bandeja: "Bandeja", buscar: "Buscar", ajustes: "Ajustes", hechas: "Hechas" };
function pintar() {
  if (!S.listo) return;
  const v = $("#vista");
  // no repintar mientras se escribe en el buscador
  const buscando = document.activeElement?.dataset?.buscar !== undefined;
  let html;
  switch (UI.ruta) {
    case "proximos": html = V.proximos(); break;
    case "calendario": html = V.calendario(UI.cal); break;
    case "bandeja": html = V.bandeja(); break;
    case "proyecto": html = V.proyecto(UI.arg, { verHechas: !!UI.verHechas[UI.arg] }); break;
    case "buscar": if (buscando && $("#resultados")) { $("#resultados").innerHTML = V.resultados(UI.q); pintarMenu(); return; } html = V.buscar(UI.q); break;
    case "hechas": html = V.hechas(); break;
    case "enfoque": html = enfoque(UI); break;
    case "estadisticas": html = estadisticas(); break;
    case "ajustes": html = A.ajustes({ email: usuario?.email, version: Act.VERSION || "—" }); break;
    default: UI.ruta = "hoy"; html = V.hoy();
  }
  v.innerHTML = html;
  v.dataset.ruta = UI.ruta;
  $("#btnAnadir").hidden = ["enfoque", "estadisticas", "ajustes"].includes(UI.ruta);
  if (UI.ruta === "buscar") { const i = $("[data-buscar]", v); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  if (UI.ruta === "enfoque") tic(v);
  pintarMenu();
  pintarMiniFoco();
}

function contar(vista, extra) { return deVista(vista, S.tareas, hoyISO(), extra).length; }
function pintarMenu() {
  const actual = UI.ruta === "proyecto" ? "proyecto/" + UI.arg : UI.ruta;
  const it = (ruta, nombre, ico, n) => `<a href="#/${ruta}" class="${actual === ruta ? "on" : ""}">${ico}<span>${nombre}</span>${n ? `<small>${n}</small>` : ""}</a>`;
  const tarde = S.tareas.filter(t => !t.hecha && t.fecha && t.fecha < hoyISO()).length;
  $("#menu").innerHTML = `
    <div class="marca"><img src="icon.svg" alt="" width="28" height="28"><b>Tasca</b></div>
    <nav>
      ${it("hoy", "Hoy", "☀️", contar("hoy") ? `<span class="${tarde ? "rojo" : ""}">${contar("hoy")}</span>` : "")}
      ${it("proximos", "Próximos", "📆", contar("proximos"))}
      ${it("calendario", "Calendario", "🗓️")}
      ${it("bandeja", "Bandeja de entrada", "📥", contar("bandeja"))}
      ${it("enfoque", "Enfoque", "🍅")}
      ${it("estadisticas", "Estadísticas", "📊")}
      ${it("buscar", "Buscar", "🔎")}
    </nav>
    <h3>Proyectos <button class="icono peque" data-nuevo-proyecto aria-label="Nuevo proyecto">+</button></h3>
    <nav>${S.proyectos.filter(p => !p.archivado).map(p => it("proyecto/" + p.id, esc(p.nombre), `<i class="punto" style="background:${esc(p.color)}"></i>`, contar("proyecto", { proyectoId: p.id }))).join("") || `<p class="suave peque">Crea uno por asignatura o importa tus CSV de Todoist en Ajustes.</p>`}</nav>
    <nav class="pie-menu">${it("ajustes", "Ajustes", "⚙️")}</nav>`;
  $$("#abajo a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#/" + UI.ruta));
}

function pintarMiniFoco() {
  const e = P.estado(), el = $("#miniFoco");
  if (e.estado === "parado" || UI.ruta === "enfoque") { el.hidden = true; return; }
  const t = e.tareaId && S.tareas.find(x => x.id === e.tareaId);
  el.hidden = false;
  el.innerHTML = `<a href="#/enfoque"><b data-mini>${P.formato(P.tiempo())}</b> <span>${esc(e.tipo === "crono" ? "Cronómetro" : P.NOMBRES[e.modo])}${t ? " · " + esc(t.titulo) : ""}</span></a><button class="icono" data-mini-p="${e.estado === "corriendo" ? "pausar" : "reanudar"}" aria-label="${e.estado === "corriendo" ? "Pausa" : "Seguir"}">${e.estado === "corriendo" ? "⏸" : "▶"}</button>`;
}

// ---------- menú lateral (móvil) ----------
const abrirMenu = () => document.body.classList.add("menu-abierto");
const cerrarMenu = () => document.body.classList.remove("menu-abierto");
$("#btnMenu").onclick = abrirMenu;
$("#velo").onclick = cerrarMenu;

// ---------- añadir ----------
function contextoAnadir() {
  if (UI.ruta === "proyecto") return { proyectoId: UI.arg };
  if (UI.ruta === "calendario") return { fecha: UI.cal.dia || hoyISO() };
  if (UI.ruta === "hoy") return { fecha: hoyISO() };
  return {};
}
$("#btnAnadir").onclick = () => anadir(contextoAnadir());
document.addEventListener("keydown", e => {
  if (hayHoja() || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "q" || e.key === "n" || e.key === "+") { e.preventDefault(); anadir(contextoAnadir()); }
  else if (e.key === "/") { e.preventDefault(); location.hash = "#/buscar"; }
  else if (e.key === "f" || e.key === "p") location.hash = "#/enfoque";
});

// ---------- pomodoro ----------
function alFoco(id) {
  if (P.estado().estado !== "parado") { P.elegirTarea(id); toast("Pomodoro con esta tarea"); }
  else { P.elegirTipo(P.estado().tipo); P.elegirModo("foco"); P.empezar(id); }
  location.hash = "#/enfoque";
}
P.suscribir(() => { if (S.listo) { if (UI.ruta === "enfoque") pintar(); else pintarMiniFoco(); } });
setInterval(() => {
  const r = P.comprobar();
  if (r && UI.ruta !== "enfoque") toast(r.eraFoco ? "¡Pomodoro terminado! Toca descansar." : "Se acabó el descanso", { ms: 6000 });
  if (UI.ruta === "enfoque") tic($("#vista"));
  const m = $("[data-mini]"); if (m) m.textContent = P.formato(P.tiempo());
}, 500);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { P.comprobar(); if (S.listo) pintar(); } });
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && UI.pantallaCompleta) { UI.pantallaCompleta = false; pintar(); } });
$("#miniFoco").addEventListener("click", e => { const b = e.target.closest("[data-mini-p]"); if (b) { e.preventDefault(); P[b.dataset.miniP](); } });

function elegirTarea() {
  const el = hoja(`<div data-elegir>${elegirTareaHtml()}</div>`);
  const cont = $("[data-elegir]", el);
  cont.addEventListener("input", e => { if (e.target.dataset.q !== undefined) { const q = e.target.value; cont.innerHTML = elegirTareaHtml(q); const i = $("[data-q]", cont); i.focus(); i.setSelectionRange(q.length, q.length); } });
  cont.addEventListener("click", e => { const b = e.target.closest("[data-tarea]"); if (b) { P.elegirTarea(b.dataset.tarea); el.cerrar(); } });
}

// ---------- clics en la vista ----------
const v = $("#vista");
v.addEventListener("click", async e => {
  const b = e.target.closest("button, [data-acc], a[data-ir]");
  if (!b) return;
  const li = b.closest(".tarea"), id = li?.dataset.id;
  const t = id && S.tareas.find(x => x.id === id);
  const acc = b.dataset.acc;
  if (t && acc === "check") {
    vibrar(); li.classList.add("saliendo");
    const r = await D.alternar(t);
    toast(r.texto, { accion: "Deshacer", alPulsar: r.deshacer });
    return;
  }
  if (t && acc === "abrir") return abrirTarea(id, { alFoco });
  if (t && acc === "plegar") { alternarAbierta(id); pintar(); return; }
  if (t && acc === "foco") return alFoco(id);
  const d = b.dataset;
  if (d.foco) return alFoco(d.foco);
  if (d.reprogramar) { for (const x of S.tareas.filter(x => !x.hecha && x.fecha && x.fecha < hoyISO())) D.cambiarTarea(x.id, { fecha: hoyISO() }); toast("Pasadas a hoy"); return; }
  if (d.anadirFecha) return anadir({ fecha: d.anadirFecha });
  if (d.anadirProyecto) return anadir({ proyectoId: d.anadirProyecto });
  if (d.editarProyecto) return A.editarProyecto(d.editarProyecto, () => (location.hash = "#/hoy"));
  if (d.nuevoProyecto !== undefined) return A.editarProyecto(null);
  if (d.dia) { UI.cal.dia = d.dia; if (d.dia.slice(0, 7) !== (UI.cal.mes || hoyISO().slice(0, 7))) UI.cal.mes = d.dia.slice(0, 7); guardarUI(); pintar(); return; }
  if (d.mes !== undefined) { const n = Number(d.mes); UI.cal.mes = n ? V.mesMas(UI.cal.mes || hoyISO().slice(0, 7), n) : hoyISO().slice(0, 7); if (!n) UI.cal.dia = hoyISO(); guardarUI(); pintar(); return; }
  // enfoque
  if (d.tipo) { P.elegirTipo(d.tipo); return; }
  if (d.modo) { P.elegirModo(d.modo); return; }
  if (d.p) { P[d.p](); return; }
  if (d.elegirTarea !== undefined) return elegirTarea();
  if (d.subCheck) { const s = S.tareas.find(x => x.id === d.subCheck); if (s) { vibrar(); D.alternar(s); } return; }
  if (d.acabarTarea) { const x = S.tareas.find(y => y.id === d.acabarTarea); if (x) { const r = await D.alternar(x); toast(r.texto, { accion: "Deshacer", alPulsar: r.deshacer }); P.elegirTarea(null); } return; }
  if (d.borrarFoco) { D.borrarFoco(d.borrarFoco); return; }
  if (d.completa !== undefined) {
    UI.pantallaCompleta = !UI.pantallaCompleta;
    try { UI.pantallaCompleta ? await document.documentElement.requestFullscreen?.() : document.fullscreenElement && (await document.exitFullscreen()); } catch {}
    pintar(); return;
  }
  // ajustes
  if (d.permiso !== undefined) { await A.activarPermiso(); pintar(); return; }
  if (d.exportar !== undefined) return A.exportar();
  if (d.actualizar !== undefined) return Act.comprobar({ manual: true });
  if (d.salir !== undefined) return salir();
  if (d.ir) location.hash = d.ir;
});
v.addEventListener("change", e => {
  const x = e.target;
  if (x.dataset.aj) { A.cambiarAjuste(x); return; }
  if (x.dataset.importar !== undefined && x.files.length) { A.importar([...x.files]); x.value = ""; return; }
  if (x.dataset.restaurar !== undefined && x.files.length) { A.restaurar(x.files[0]); x.value = ""; return; }
  if (x.dataset.verHechas !== undefined) { UI.verHechas[UI.arg] = x.checked; guardarUI(); pintar(); return; }
  if (x.dataset.ruido !== undefined) { UI.ruido = x.value; ruido(x.value, UI.volumen); return; }
});
v.addEventListener("input", e => {
  const x = e.target;
  if (x.dataset.buscar !== undefined) { UI.q = x.value; pintar(); }
  if (x.dataset.volumen !== undefined) { UI.volumen = Number(x.value); volumenRuido(UI.volumen); guardarUI(); }
});
$("#menu").addEventListener("click", e => { if (e.target.closest("[data-nuevo-proyecto]")) { cerrarMenu(); A.editarProyecto(null); } });

// arrastrar tareas a otro día del calendario (ordenador)
v.addEventListener("dragstart", e => { const li = e.target.closest?.(".tarea"); if (li) { e.dataTransfer.setData("text/tarea", li.dataset.id); e.dataTransfer.effectAllowed = "move"; } });
v.addEventListener("dragover", e => { const d = e.target.closest?.(".dia"); if (d && e.dataTransfer.types.includes("text/tarea")) { e.preventDefault(); d.classList.add("encima"); } });
v.addEventListener("dragleave", e => e.target.closest?.(".dia")?.classList.remove("encima"));
v.addEventListener("drop", e => {
  const d = e.target.closest?.(".dia"), id = e.dataTransfer.getData("text/tarea");
  if (d && id) { e.preventDefault(); D.cambiarTarea(id, { fecha: d.dataset.dia }); toast("Movida al " + d.dataset.dia.split("-").reverse().slice(0, 2).join("/")); }
});
new MutationObserver(() => $$(".tarea", v).forEach(li => (li.draggable = matchMedia("(pointer:fine)").matches))).observe(v, { childList: true });

// avisos del sistema (APK): abrir la tarea al tocarlos
alTocarAviso(extra => { if (extra.tarea) setTimeout(() => abrirTarea(extra.tarea, { alFoco }), 400); else if (extra.vista) location.hash = "#/" + extra.vista; });
// enlace desde un aviso web (?tarea=)
{ const q = new URLSearchParams(location.search).get("tarea"); if (q) D.alCambiar(s => { if (s.listo && q && S.tareas.some(t => t.id === q)) { abrirTarea(q, { alFoco }); history.replaceState(null, "", location.pathname + location.hash); } }); }

leerRuta();
// al cambiar de día con la app abierta
let dia = hoyISO();
setInterval(() => { if (hoyISO() !== dia) { dia = hoyISO(); pintar(); reprogramar(); } }, 60000);
