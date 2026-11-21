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
import { menu, seccionesDe } from "./selectores.js";
import { pedirTexto, confirmar } from "./ui.js";
import { reprogramar } from "./avisos.js";
import { ruido, volumenRuido } from "./sonido.js";
import { esNativo, alTocarAviso } from "./nativo.js";
import { hoyISO, sumarDias, lunesDe } from "./fechas.js";
import { deVista } from "./logica.js";
import * as Act from "./actualizar.js";
import * as Cal from "./calendarios.js";
import { fechaBonita } from "./fechas.js";
import { conEnlaces } from "./ui.js";

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
  Cal.usarToken(() => user.getIdToken());
  D.iniciar(F, db, user.uid);
});

// ---------- estado de la interfaz ----------
const UI = { ruta: "hoy", arg: null, cal: {}, verHechas: {}, q: "", ruido: "", volumen: 0.5, pantallaCompleta: false, modoProximo: "lista", semana: null };
try { Object.assign(UI, JSON.parse(localStorage.getItem("tasca.ui") || "{}"), { ruido: "", pantallaCompleta: false }); } catch {}
const guardarUI = () => { try { localStorage.setItem("tasca.ui", JSON.stringify({ cal: UI.cal, verHechas: UI.verHechas, volumen: UI.volumen, modoProximo: UI.modoProximo })); } catch {} };

function leerRuta() {
  const [r, arg] = (location.hash.replace(/^#\/?/, "") || "hoy").split("/");
  UI.ruta = r || "hoy"; UI.arg = arg ? decodeURIComponent(arg) : null;
  if (UI.ruta === "calendario") { UI.ruta = "proximos"; UI.arg = "calendario"; }
  if (UI.ruta === "proximos" && UI.arg) { UI.modoProximo = UI.arg === "calendario" ? "calendario" : "lista"; guardarUI(); }
}
window.addEventListener("hashchange", () => { leerRuta(); pintar(); window.scrollTo(0, 0); });

D.alCambiar((s, err) => {
  if (err) { if (!s.listo) fallo("No se pueden leer los datos: " + (err.code || err.message)); else toast("Sin permiso o sin conexión con la base de datos"); return; }
  if (!s.listo) return;
  if (!$("#carga").hidden) { mostrar("app"); primeraCarga(); }
  tema(s.ajustes.tema); try { localStorage.setItem("tasca.tema", s.ajustes.tema || "auto"); } catch {}
  pintar();
  reprogramar();
});

// ---------- calendarios ----------
async function primeraCarga() {
  if (S.ajustes.calendarios === undefined) {
    // la primera vez, coge los calendarios que ya tenías en el Organizador
    const l = await Cal.importarDelOrganizador(F, db, usuario.uid);
    await D.guardarAjustes({ calendarios: l });
    if (l.length) toast(`He conectado ${l.length === 1 ? "tu calendario" : `tus ${l.length} calendarios`} del Organizador`, { ms: 5000 });
  }
  Cal.recargar();
}
Cal.alCambiarEventos(() => { if (S.listo) pintar(); });
setInterval(() => { if (S.listo && !document.hidden) Cal.recargar(); }, 10 * 60 * 1000);
function verEvento(id, dia) {
  const e = Cal.delDia(dia).find(x => x.id === id); if (!e) return;
  const cuando = e.todoElDia ? (e.ini === e.fin ? `${fechaBonita(e.ini)} · todo el día` : `Del ${fechaBonita(e.ini)} al ${fechaBonita(e.fin)}`) : `${fechaBonita(e.ini.slice(0, 10))} · ${e.ini.slice(11)}–${e.fin.slice(11)}`;
  const el = hoja(`<div class="evento-ficha"><div class="ficha-sup"><span class="miga"><i class="punto" style="background:${esc(e.color)}"></i> ${esc(e.cal)}</span><span class="sep"></span><button class="icono" data-cerrar aria-label="Cerrar">${icono("cerrar")}</button></div>
    <h2>${esc(e.titulo)}</h2>
    <p>${icono("cal")} ${esc(cuando)}</p>${e.lugar ? `<p>📍 ${esc(e.lugar)}</p>` : ""}${e.desc ? `<p class="suave">${conEnlaces(e.desc)}</p>` : ""}
    <p class="suave peque">Es un evento de tu calendario: se cambia en Google Calendar.</p>
    <div class="botones"><button class="btn primario" data-crear>${icono("mas")} Crear tarea a partir del evento</button></div></div>`, { clase: "peque" });
  el.querySelector("[data-cerrar]").onclick = () => el.cerrar();
  el.querySelector("[data-crear]").onclick = () => {
    const t = D.nuevaTarea({ titulo: e.titulo, notas: [e.lugar, e.desc].filter(Boolean).join("\n"), fecha: e.todoElDia ? e.ini : e.ini.slice(0, 10), hora: e.todoElDia ? null : e.ini.slice(11), recordatorios: e.todoElDia || S.ajustes.aviso == null ? null : [S.ajustes.aviso] });
    D.guardarTarea(t); el.cerrar(); toast("Tarea creada en la Bandeja"); abrirTarea(t.id, { alFoco });
  };
}

// ---------- pintar ----------
function pintar() {
  if (!S.listo) return;
  const v = $("#vista");
  // no repintar mientras se escribe en el buscador
  const buscando = document.activeElement?.dataset?.buscar !== undefined;
  let html;
  switch (UI.ruta) {
    case "proximos": html = V.proximos(UI); break;
    case "explorar": html = V.explorar(); break;
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
  $("#btnAnadir").hidden = ["enfoque", "estadisticas", "ajustes", "hechas"].includes(UI.ruta);
  if (UI.ruta === "buscar") { const i = $("[data-buscar]", v); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  if (UI.ruta === "enfoque") tic(v);
  if (UI.ruta === "ajustes" && UI.arg && !v.dataset.saltado) { v.dataset.saltado = "1"; setTimeout(() => document.getElementById(UI.arg)?.scrollIntoView({ block: "start" }), 50); }
  if (UI.ruta !== "ajustes") delete v.dataset.saltado;
  pintarMenu();
  pintarMiniFoco();
}

function contar(vista, extra) { return deVista(vista, S.tareas, hoyISO(), extra).length; }
const PESTANAS = [["bandeja", "Bandeja", "bandeja"], ["hoy", "Hoy", "hoy"], ["proximos", "Próximo", "proximo"], ["buscar", "Buscar", "buscar"], ["explorar", "Explorar", "explorar"]];
const pestanaDe = r => (["proyecto", "enfoque", "estadisticas", "hechas", "ajustes"].includes(r) ? "explorar" : r);
function pintarMenu() {
  const actual = UI.ruta === "proyecto" ? "proyecto/" + UI.arg : UI.ruta;
  const it = (ruta, nombre, ico, n, color = "") => `<a href="#/${ruta}" class="${actual === ruta ? "on" : ""}"><span class="ico-m" style="${color ? "color:" + color : ""}">${icono(ico)}</span><span>${nombre}</span>${n ? `<small>${n}</small>` : ""}</a>`;
  const tarde = S.tareas.filter(t => !t.hecha && t.fecha && t.fecha < hoyISO()).length;
  const nHoy = contar("hoy");
  $("#menu").innerHTML = `
    <div class="marca"><img src="icon.svg" alt="" width="26" height="26"><b>${esc(usuario?.displayName?.split(" ")[0] || "Tasca")}</b></div>
    <button class="anadir-menu" data-anadir-menu><span>${icono("mas")}</span>Añadir tarea</button>
    <nav>
      ${it("buscar", "Buscar", "buscar")}
      ${it("bandeja", "Bandeja de entrada", "bandeja", contar("bandeja"), "#1C7ED6")}
      ${it("hoy", "Hoy", "hoy", nHoy ? `<span class="${tarde ? "rojo" : ""}">${nHoy}</span>` : "", "var(--verde)")}
      ${it("proximos", "Próximo", "proximo", "", "#7048E8")}
      ${it("enfoque", "Enfoque", "tomate", "", "var(--acento)")}
      ${it("estadisticas", "Estadísticas", "grafica", "", "#1098AD")}
      ${it("hechas", "Completadas", "hecho", "", "var(--suave)")}
    </nav>
    <h3>Mis proyectos <button class="icono peque" data-nuevo-proyecto aria-label="Añadir proyecto">${icono("mas")}</button></h3>
    <nav>${S.proyectos.filter(p => !p.archivado).map(p => it("proyecto/" + p.id, esc(p.nombre), "almohadilla", contar("proyecto", { proyectoId: p.id }), p.color)).join("") || `<p class="suave peque">Crea uno por asignatura o importa tus CSV de Todoist.</p>`}
      <button class="enlace-menu" data-importar-abrir>${icono("importar")} Importar CSV de Todoist</button></nav>
    <nav class="pie-menu">${it("ajustes", "Ajustes", "ajustes")}</nav>`;
  const pes = pestanaDe(UI.ruta);
  $("#abajo").innerHTML = PESTANAS.map(([r, n, i]) => `<a href="#/${r}" class="${pes === r ? "on" : ""}">${icono(i)}<span>${n}</span>${r === "hoy" && nHoy ? `<i class="globo ${tarde ? "rojo" : ""}">${nHoy}</i>` : ""}</a>`).join("");
}

function pintarMiniFoco() {
  const e = P.estado(), el = $("#miniFoco");
  if (e.estado === "parado" || UI.ruta === "enfoque") { el.hidden = true; return; }
  const t = e.tareaId && S.tareas.find(x => x.id === e.tareaId);
  el.hidden = false;
  el.innerHTML = `<a href="#/enfoque"><b data-mini>${P.formato(P.tiempo())}</b> <span>${esc(e.tipo === "crono" ? "Cronómetro" : P.NOMBRES[e.modo])}${t ? " · " + esc(t.titulo) : ""}</span></a><button class="icono" data-mini-p="${e.estado === "corriendo" ? "pausar" : "reanudar"}" aria-label="${e.estado === "corriendo" ? "Pausa" : "Seguir"}">${e.estado === "corriendo" ? "⏸" : "▶"}</button>`;
}


// ---------- añadir ----------
function contextoAnadir() {
  if (UI.ruta === "proyecto") return { proyectoId: UI.arg };
  if (UI.ruta === "proximos") return { fecha: UI.modoProximo === "calendario" ? UI.cal.dia || hoyISO() : hoyISO() };
  if (UI.ruta === "hoy") return { fecha: hoyISO() };
  return {};
}
$("#btnAnadir").onclick = () => anadir(contextoAnadir());
let destinoImportar = null;
const abrirImportar = (destino = null) => { destinoImportar = destino; $("#archivoImportar").click(); };
$("#archivoImportar").onchange = e => { const x = e.target; if (x.files.length) A.importar([...x.files], destinoImportar); x.value = ""; };
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) { P.comprobar(); if (S.listo) { pintar(); Cal.recargar(); } } });
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
  if (d.evento) return verEvento(d.evento, d.eventoDia);
  if (d.calEditar !== undefined) return A.editarCalendario(d.calEditar);
  if (d.calRecargar !== undefined) { toast("Actualizando…", { ms: 1200 }); await Cal.recargar(true); toast(Cal.error() || "Calendarios al día"); return; }
  if (d.anadir !== undefined) { let c = {}; try { c = JSON.parse(d.anadir); } catch {} return anadir(c); }
  if (d.importarAbrir !== undefined) return abrirImportar();
  if (d.modoProx) { UI.modoProximo = d.modoProx; guardarUI(); history.replaceState(null, "", "#/proximos/" + d.modoProx); pintar(); return; }
  if (d.semana !== undefined) { const n = Number(d.semana); UI.semana = n ? sumarDias(UI.semana && UI.semana >= lunesDe(hoyISO()) ? UI.semana : lunesDe(hoyISO()), 7 * n) : null; pintar(); return; }
  if (d.irDia) { const g = document.getElementById("d-" + d.irDia); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" }); else anadir({ fecha: d.irDia }); return; }
  if (d.menuVista !== undefined) return menuVista();
  if (d.menuProyecto) return menuProyecto(d.menuProyecto);
  if (d.menuSeccion) return menuSeccion(UI.arg, d.menuSeccion);
  if (d.nuevaSeccion) return nuevaSeccion(d.nuevaSeccion);
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
  if (x.dataset.aj) { A.cambiarAjuste(x); if (x.dataset.aj === "verEventos") Cal.recargar(true); return; }
  if (x.dataset.calActivo !== undefined) { A.activarCalendario(Number(x.dataset.calActivo), x.checked); return; }
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
$("#menu").addEventListener("click", e => {
  if (e.target.closest("[data-nuevo-proyecto]")) A.editarProyecto(null);
  if (e.target.closest("[data-anadir-menu]")) anadir(contextoAnadir());
  if (e.target.closest("[data-importar-abrir]")) abrirImportar();
});

// ---------- menús ⋯ ----------
async function menuVista() {
  const tarde = S.tareas.filter(t => !t.hecha && t.fecha && t.fecha < hoyISO());
  const r = await menu([
    ...(tarde.length ? [{ id: "reprogramar", texto: `Pasar las ${tarde.length} vencidas a hoy`, icono: "hoy" }] : []),
    { id: "hechas", texto: "Ver completadas", icono: "hecho" },
    { id: "importar", texto: "Importar CSV de Todoist", icono: "importar" },
    { id: "ajustes", texto: "Ajustes", icono: "ajustes" },
  ]);
  if (r === "reprogramar") { for (const x of tarde) D.cambiarTarea(x.id, { fecha: hoyISO() }); toast("Pasadas a hoy"); }
  else if (r === "hechas") location.hash = "#/hechas";
  else if (r === "importar") abrirImportar();
  else if (r === "ajustes") location.hash = "#/ajustes";
}
async function menuProyecto(id) {
  const p = S.proyectos.find(x => x.id === id); if (!p) return;
  const r = await menu([
    { id: "editar", texto: "Editar proyecto", icono: "almohadilla" },
    { id: "seccion", texto: "Añadir sección", icono: "seccion" },
    { id: "hechas", texto: UI.verHechas[id] ? "Ocultar completadas" : "Mostrar completadas", icono: "hecho" },
    { id: "importar", texto: "Importar CSV de Todoist aquí", icono: "importar" },
    { id: "foco", texto: "Pomodoro con la siguiente tarea", icono: "tomate" },
    { id: "archivar", texto: p.archivado ? "Desarchivar" : "Archivar", icono: "carpeta" },
    { id: "borrar", texto: "Eliminar proyecto", icono: "cerrar", peligro: true },
  ], p.nombre);
  if (r === "editar") A.editarProyecto(id, () => (location.hash = "#/explorar"));
  else if (r === "seccion") nuevaSeccion(id);
  else if (r === "hechas") { UI.verHechas[id] = !UI.verHechas[id]; guardarUI(); pintar(); }
  else if (r === "importar") abrirImportar(id);
  else if (r === "foco") { const t = S.tareas.filter(x => x.proyectoId === id && !x.hecha && !x.padreId).sort((a, b) => (a.fecha || "9") < (b.fecha || "9") ? -1 : (a.fecha || "9") > (b.fecha || "9") ? 1 : (a.orden ?? 0) - (b.orden ?? 0))[0]; t ? alFoco(t.id) : toast("No hay tareas pendientes"); }
  else if (r === "archivar") { D.guardarProyecto({ ...p, archivado: !p.archivado }); toast(p.archivado ? "Desarchivado" : "Archivado"); }
  else if (r === "borrar") {
    const n = S.tareas.filter(t => t.proyectoId === id).length;
    if (await confirmar(`¿Eliminar «${p.nombre}»${n ? ` y sus ${n} tareas` : ""}? No se puede deshacer.`, { si: "Eliminar", peligro: true })) { await D.borrarProyecto(id); toast("Proyecto eliminado"); location.hash = "#/explorar"; }
  }
}
async function nuevaSeccion(pid) {
  const p = S.proyectos.find(x => x.id === pid); if (!p) return;
  const n = await pedirTexto("Nombre de la sección", "", { boton: "Añadir sección", placeholder: "p. ej. Exámenes del dossier" });
  if (!n || seccionesDe(pid).includes(n)) return;
  D.guardarProyecto({ ...p, secciones: [...seccionesDe(pid), n] });
}
async function menuSeccion(pid, sec) {
  const p = S.proyectos.find(x => x.id === pid); if (!p) return;
  const r = await menu([{ id: "anadir", texto: "Añadir tarea", icono: "mas" }, { id: "renombrar", texto: "Cambiar nombre", icono: "seccion" }, { id: "borrar", texto: "Eliminar sección (las tareas se quedan)", icono: "cerrar", peligro: true }], sec);
  const tareas = S.tareas.filter(t => t.proyectoId === pid && t.seccion === sec);
  if (r === "anadir") anadir({ proyectoId: pid, seccion: sec });
  else if (r === "renombrar") {
    const n = await pedirTexto("Nuevo nombre", sec); if (!n || n === sec) return;
    D.guardarProyecto({ ...p, secciones: seccionesDe(pid).map(x => (x === sec ? n : x)) });
    for (const t of tareas) D.cambiarTarea(t.id, { seccion: n });
  } else if (r === "borrar") {
    D.guardarProyecto({ ...p, secciones: seccionesDe(pid).filter(x => x !== sec) });
    for (const t of tareas) D.cambiarTarea(t.id, { seccion: null });
  }
}

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
