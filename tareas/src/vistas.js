// Vistas, organizadas como Todoist: Bandeja, Hoy, Próximo (lista o calendario), Buscar, Explorar y Proyectos.
import { S } from "./datos.js";
import { esc } from "./ui.js";
import { filas, vacio, proyectoDe, icono, filaAnadir, filasEventos } from "./lista.js";
import * as Cal from "./calendarios.js";
import { deVista, hijosPorPadre, compararManual, comparar } from "./logica.js";
import { hoyISO, sumarDias, DIAS_CORTOS, DIAS, MESES, lunesDe, diaSemana, aDate } from "./fechas.js";
import { seccionesDe } from "./selectores.js";

/** Cabecera: título grande, y a la derecha los botones (atrás a la izquierda si hace falta) */
export const cab = (titulo, { sub = "", atras = "", acciones = "" } = {}) =>
  `<header class="vista-cab">${atras ? `<a class="icono atras" href="${atras}" aria-label="Atrás">${icono("atras")}</a>` : ""}<div class="tit"><h1>${titulo}</h1>${sub ? `<p class="suave">${sub}</p>` : ""}</div><div class="acc-cab">${acciones}</div></header>`;
const botonMenu = (dato, etiqueta = "Opciones de la vista") => `<button class="icono" ${dato} aria-label="${etiqueta}">${icono("puntos")}</button>`;
const botonBuscar = `<a class="icono solo-movil" href="#/buscar" aria-label="Buscar">${icono("buscar")}</a>`;
const diaTitulo = f => { const [, m, d] = f.split("-").map(Number); return `${d} ${MESES[m - 1].slice(0, 3)} · ${DIAS[diaSemana(f)]}`; };

// ---------------- Hoy ----------------
/**
 * Horario del día en orden de horas: los eventos del calendario y las tareas mezclados.
 * Primero lo de todo el día, luego por hora (la tarea enlazada usa la hora de su sesión) y al final lo que no tiene hora.
 */
function horario(f, tareas, enl = Cal.enlacesDia(f), op = {}) {
  const items = [
    ...Cal.delDia(f).filter(e => !enl.porEvento.has(e.id)).map(e => ({ k: e.todoElDia ? "00:00 0" : (e.ini.slice(0, 10) < f ? "00:00 1" : e.ini.slice(11)), e })),
    ...tareas.map(t => ({ k: enl.porTarea.get(t.id)?.ini.slice(11) || t.hora || "99:99", t })),
  ].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.e ? -1 : 1));
  if (!items.length) return "";
  return `<ul class="lista horario">${items.map(x => x.e
    ? `<li class="evento-fila"><button data-evento="${esc(x.e.id)}" data-evento-dia="${f}" style="--c:${esc(x.e.color)}"><span class="hora-ev">${esc(Cal.horaDe(x.e, f))}</span><span class="tit-ev">${esc(x.e.titulo)}${x.e.lugar ? `<small>${esc(x.e.lugar)}</small>` : ""}</span></button></li>`
    : filas([x.t], { fecha: false, sesiones: enl.porTarea, ...op })).join("")}</ul>`;
}
export function hoy() {
  const h = hoyISO();
  const l = deVista("hoy", S.tareas, h);
  const tarde = l.filter(t => t.fecha < h), deHoy = l.filter(t => t.fecha === h);
  const enl = Cal.enlacesDia(h);
  const hechasHoy = S.tareas.filter(t => t.hecha && t.hechaEn && new Date(t.hechaEn).toDateString() === new Date().toDateString() && !t.padreId).length;
  return cab("Hoy", { sub: l.length ? `${icono("hecho")} ${l.length} ${l.length === 1 ? "tarea" : "tareas"}` : "", acciones: botonBuscar + botonMenu("data-menu-vista") }) +
    (tarde.length ? `<h2 class="grupo tarde-t">Vencidas <span>${tarde.length}</span><button class="enlace" data-reprogramar="hoy">Reprogramar</button></h2><ul class="lista">${filas(tarde)}</ul>` : "") +
    `<h2 class="grupo">${esc(diaTitulo(h))} · Hoy</h2>` + horario(h, deHoy, enl) + filaAnadir({ fecha: h }) +
    (!l.length && !Cal.delDia(h).length ? vacio(hechasHoy ? "¡Todo hecho por hoy!" : "Disfruta del día", hechasHoy ? `Has completado ${hechasHoy} ${hechasHoy === 1 ? "tarea" : "tareas"}.` : "No tienes nada para hoy.") : "");
}

// ---------------- Bandeja ----------------
export function bandeja() {
  const l = deVista("bandeja", S.tareas, hoyISO());
  return cab("Bandeja de entrada", { atras: "#/explorar", acciones: botonMenu("data-menu-vista") }) +
    (l.length ? `<ul class="lista">${filas(l, { proyecto: false })}</ul>` : "") + filaAnadir({}) +
    (!l.length ? vacio("Tu bandeja está vacía", "Lo que apuntes sin proyecto llega aquí. Luego muévelo a su asignatura.") : "");
}

// ---------------- Próximo ----------------
export function proximos(ui) {
  const h = hoyISO();
  const modo = ui.modoProximo === "calendario" ? "calendario" : "lista";
  const selector = `<div class="seg modo-prox"><button data-modo-prox="lista" class="${modo === "lista" ? "on" : ""}">${icono("lista")} Lista</button><button data-modo-prox="calendario" class="${modo === "calendario" ? "on" : ""}">${icono("proximo")} Calendario</button></div>`;
  if (modo === "calendario") return calendario(ui.cal, selector);
  const inicio = ui.semana && ui.semana >= lunesDe(h) ? ui.semana : lunesDe(h);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
  const [a, m] = inicio.split("-").map(Number);
  const lista = deVista("proximos", S.tareas, h, { dias: 70 });
  const porDia = new Map();
  for (const t of lista) { const k = t.fecha < h ? "vencidas" : t.fecha; if (!porDia.has(k)) porDia.set(k, []); porDia.get(k).push(t); }
  const desde = inicio < h ? h : inicio;
  const listaDias = Array.from({ length: 14 }, (_, i) => sumarDias(desde, i));
  const tarde = porDia.get("vencidas") || [];
  return cab("Próximo", { acciones: selector + botonBuscar }) +
    `<div class="semana-nav"><b>${MESES[m - 1].replace(/^./, c => c.toUpperCase())} ${a}</b><span class="sep"></span>
      <button class="icono" data-semana="-1" ${inicio <= lunesDe(h) ? "disabled" : ""} aria-label="Semana anterior">‹</button>
      <button class="btn peque" data-semana="0">Hoy</button>
      <button class="icono" data-semana="1" aria-label="Semana siguiente">›</button></div>
     <div class="franja">${dias.map(d => `<button class="${d === h ? "hoy" : ""} ${d < h ? "pasado" : ""}" data-ir-dia="${d}"><small>${DIAS_CORTOS[diaSemana(d)]}</small><b>${Number(d.slice(8))}</b><i>${porDia.get(d)?.length ? "•" : ""}</i></button>`).join("")}</div>` +
    (tarde.length && inicio === lunesDe(h) ? `<h2 class="grupo tarde-t">Vencidas <span>${tarde.length}</span><button class="enlace" data-reprogramar="hoy">Reprogramar</button></h2><ul class="lista">${filas(tarde)}</ul>` : "") +
    listaDias.map(d => {
      const ts = porDia.get(d) || [], enl = Cal.enlacesDia(d);
      return `<h2 class="grupo" id="d-${d}">${esc(diaTitulo(d))}${d === h ? " · Hoy" : d === sumarDias(h, 1) ? " · Mañana" : ""} ${ts.length ? `<span>${ts.length}</span>` : ""}</h2>${horario(d, ts, enl)}${filaAnadir({ fecha: d })}`;
    }).join("");
}

export function calendario(estado, selector = "") {
  const h = hoyISO();
  const mes = estado.mes || h.slice(0, 7);
  const sel = estado.dia || h;
  const [a, m] = mes.split("-").map(Number);
  const primero = `${mes}-01`;
  const inicio = lunesDe(primero);
  const finMes = new Date(a, m, 0).getDate();
  const semanas = Math.ceil((diaSemana(primero) + finMes) / 7);
  const porDia = new Map();
  for (const t of S.tareas) if (t.fecha && (!t.padreId || !S.tareas.some(x => x.id === t.padreId && x.fecha === t.fecha))) { if (!porDia.has(t.fecha)) porDia.set(t.fecha, []); porDia.get(t.fecha).push(t); }
  for (const l of porDia.values()) l.sort(comparar);
  const celdas = [];
  for (let i = 0; i < semanas * 7; i++) {
    const d = sumarDias(inicio, i), l = porDia.get(d) || [], pend = l.filter(t => !t.hecha), enlD = Cal.enlacesDia(d), ev = Cal.delDia(d).filter(e => !enlD.porEvento.has(e.id));
    celdas.push(`<button class="dia ${d.slice(0, 7) !== mes ? "fuera" : ""} ${d === h ? "hoy" : ""} ${d === sel ? "sel" : ""} ${diaSemana(d) > 4 ? "finde" : ""}" data-dia="${d}">
      <span class="num">${Number(d.slice(8))}</span>
      <span class="eventos">${(() => {
        const items = [...ev.map(e => ({ k: e.todoElDia ? "00:00" : e.ini.slice(11), h: `<em class="ev" style="--c:${esc(e.color)}">${e.todoElDia ? "" : `<b>${e.ini.slice(11)}</b> `}${esc(e.titulo)}</em>` })),
          ...l.map(t => { const k = enlD.porTarea.get(t.id)?.ini.slice(11) || t.hora; return { k: k || "99:99", h: `<em class="${t.hecha ? "hecha" : ""}" style="--c:${esc(proyectoDe(t.proyectoId)?.color || "var(--suave)")}">${k ? `<b>${k}</b> ` : ""}${esc(t.titulo)}</em>` }; })]
          .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
        return items.slice(0, 3).map(x => x.h).join("") + (items.length > 3 ? `<small>+${items.length - 3}</small>` : "");
      })()}</span>
      <span class="puntos">${ev.slice(0, 2).map(e => `<i class="ev" style="background:${esc(e.color)}"></i>`).join("")}${pend.slice(0, 4).map(t => `<i style="background:${esc(proyectoDe(t.proyectoId)?.color || "var(--suave)")}"></i>`).join("")}</span>
    </button>`);
  }
  const deSel = porDia.get(sel) || [];
  const pend = deSel.filter(t => !t.hecha), hech = deSel.filter(t => t.hecha), enlSel = Cal.enlacesDia(sel);
  return cab("Próximo", { acciones: selector }) +
    `<div class="semana-nav"><b>${MESES[m - 1].replace(/^./, c => c.toUpperCase())} ${a}</b><span class="sep"></span><button class="icono" data-mes="-1" aria-label="Mes anterior">‹</button><button class="btn peque" data-mes="0">Hoy</button><button class="icono" data-mes="1" aria-label="Mes siguiente">›</button></div>
     <div class="mes"><div class="sem">${DIAS_CORTOS.map(d => `<span>${d}</span>`).join("")}</div><div class="rejilla">${celdas.join("")}</div></div>
     <h2 class="grupo">${esc(diaTitulo(sel))}${sel === h ? " · Hoy" : ""} ${pend.length ? `<span>${pend.length}</span>` : ""}</h2>${horario(sel, pend, enlSel)}${filaAnadir({ fecha: sel })}
     ${hech.length ? `<h2 class="grupo">Completadas <span>${hech.length}</span></h2><ul class="lista">${filas(hech, { fecha: false, sinFoco: true })}</ul>` : ""}
     <p class="suave peque centrado solo-pc">Puedes arrastrar una tarea a otro día.</p>`;
}
export const mesMas = (mes, n) => { const d = aDate(mes + "-01"); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// ---------------- Proyecto ----------------
export function proyecto(id, { verHechas = false } = {}) {
  const p = proyectoDe(id);
  if (!p) return cab("Proyecto", { atras: "#/explorar" }) + vacio("Este proyecto ya no existe");
  const todas = S.tareas.filter(t => t.proyectoId === id);
  const raiz = (verHechas ? todas : todas.filter(t => !t.hecha)).filter(t => !t.padreId).sort(compararManual);
  const hijos = hijosPorPadre(S.tareas);
  const hechas = todas.filter(t => t.hecha).length;
  const pct = todas.length ? Math.round(100 * hechas / todas.length) : 0;
  const secs = seccionesDe(id);
  const sinSeccion = raiz.filter(t => !t.seccion || !secs.includes(t.seccion));
  const bloque = (s, l) => `<section class="seccion">
      ${s ? `<h2 class="grupo sec">${esc(s)} <span>${l.length}</span><button class="icono peque" data-menu-seccion="${esc(s)}" aria-label="Opciones de la sección">${icono("puntos")}</button></h2>` : ""}
      ${l.length ? `<ul class="lista">${filas(l, { proyecto: false, hijos, verHechas })}</ul>` : ""}
      ${filaAnadir({ proyectoId: id, seccion: s || null })}
    </section>`;
  return cab(`<span style="color:${esc(p.color)}">#</span> ${esc(p.nombre)}`, { atras: "#/explorar", sub: `${pct}% completado · ${hechas}/${todas.length}`, acciones: botonMenu(`data-menu-proyecto="${esc(p.id)}"`, "Opciones del proyecto") }) +
    `<div class="barra grande"><i style="width:${pct}%;background:${esc(p.color)}"></i></div>` +
    bloque("", sinSeccion) + secs.map(s => bloque(s, raiz.filter(t => t.seccion === s))).join("") +
    `<button class="fila-anadir seccion-nueva" data-nueva-seccion="${esc(id)}"><span>${icono("seccion")}</span>Añadir sección</button>` +
    (!todas.length ? vacio("Proyecto vacío", "Añade tareas o importa tu CSV de Todoist desde el menú ⋯.") : "");
}

// ---------------- Buscar ----------------
const sinTildes = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const navProyectos = ps => `<nav class="lista-nav">${ps.map(p => `<a href="#/proyecto/${esc(p.id)}"><span style="color:${esc(p.color)}">${icono("almohadilla")}</span><span>${esc(p.nombre)}</span></a>`).join("")}</nav>`;
export function buscar(q) {
  return cab("Buscar") + `<div class="buscador-caja">${icono("buscar")}<input class="buscador" type="search" placeholder="Tareas, descripciones, proyectos…" value="${esc(q)}" data-buscar></div><div id="resultados">${resultados(q)}</div>`;
}
export function resultados(q) {
  if (!q) { const ps = S.proyectos.filter(p => !p.archivado).slice(0, 8); return ps.length ? `<h2 class="grupo">Proyectos</h2>${navProyectos(ps)}` : ""; }
  const proys = S.proyectos.filter(p => sinTildes(p.nombre).includes(sinTildes(q)));
  const l = deVista("buscar", S.tareas, hoyISO(), { q });
  return (proys.length ? `<h2 class="grupo">Proyectos</h2>${navProyectos(proys)}` : "") +
    (l.length ? `<h2 class="grupo">Tareas <span>${l.length}</span></h2><ul class="lista">${filas(l.slice(0, 100))}</ul>` : proys.length ? "" : vacio("Sin resultados", `No hay nada que contenga «${q}».`));
}

// ---------------- Completadas ----------------
export function hechas() {
  const l = deVista("hechas", S.tareas, hoyISO()).filter(t => !t.padreId).slice(0, 150);
  const grupos = new Map();
  for (const t of l) { const k = t.hechaEn ? new Date(t.hechaEn).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "Antes"; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(t); }
  return cab("Completadas", { atras: "#/explorar" }) + (l.length ? [...grupos].map(([k, ts]) => `<h2 class="grupo">${esc(k)} <span>${ts.length}</span></h2><ul class="lista">${filas(ts, { sinFoco: true })}</ul>`).join("") : vacio("Aún nada completado", "¡A por la primera!"));
}

// ---------------- Explorar ----------------
export function explorar() {
  const n = id => deVista("proyecto", S.tareas, hoyISO(), { proyectoId: id }).length;
  const it = (href, ico, nombre, extra = "", color = "") => `<a href="${href}"><span style="${color ? "color:" + color : ""}">${icono(ico)}</span><span>${nombre}</span>${extra ? `<small>${extra}</small>` : ""}</a>`;
  const activos = S.proyectos.filter(p => !p.archivado), archivados = S.proyectos.filter(p => p.archivado);
  return cab("Proyectos", { acciones: botonBuscar + `<a class="icono" href="#/ajustes" aria-label="Ajustes">${icono("ajustes")}</a>` }) +
    `<nav class="lista-nav tarjeta">
      ${it("#/bandeja", "bandeja", "Bandeja de entrada", deVista("bandeja", S.tareas, hoyISO()).length || "", "var(--p3)")}
    </nav>
    <h2 class="grupo">Mis proyectos <button class="icono peque" data-nuevo-proyecto aria-label="Añadir proyecto">${icono("mas")}</button></h2>
    <nav class="lista-nav tarjeta">${activos.map(p => it(`#/proyecto/${esc(p.id)}`, "almohadilla", esc(p.nombre), n(p.id) || "", p.color)).join("") || `<p class="suave peque relleno">Crea un proyecto por asignatura con el + o importa tus CSV de Todoist.</p>`}
      <button class="fila-anadir dentro" data-importar-abrir><span>${icono("importar")}</span>Importar CSV de Todoist</button></nav>
    <h2 class="grupo">Más</h2>
    <nav class="lista-nav tarjeta">
      ${it("#/estadisticas", "grafica", "Estadísticas", "", "var(--p3)")}
      ${it("#/hechas", "hecho", "Completadas", "", "var(--verde)")}
      ${it("#/ajustes/calendarios", "cal", "Google Calendar", Cal.lista().length ? `${Cal.lista().length} conectado${Cal.lista().length > 1 ? "s" : ""}` : "Conectar", "var(--p3)")}
      ${it("#/ajustes", "ajustes", "Ajustes", "", "var(--suave)")}
    </nav>
    ${archivados.length ? `<h2 class="grupo suave">Archivados</h2><nav class="lista-nav tarjeta">${archivados.map(p => it(`#/proyecto/${esc(p.id)}`, "almohadilla", esc(p.nombre), "", "var(--suave)")).join("")}</nav>` : ""}`;
}
