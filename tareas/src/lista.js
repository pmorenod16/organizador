// Filas de tareas con sus subtareas plegables. Devuelve HTML; los clics se gestionan en main.js.
import { S } from "./datos.js";
import { esc } from "./ui.js";
import { hijosPorPadre, progreso, vencida } from "./logica.js";
import { fechaBonita, hoyISO, minutosTexto } from "./fechas.js";

const LS = "tasca.abiertas";
const abiertas = new Set((() => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } })());
export const estaAbierta = id => abiertas.has(id);
export function alternarAbierta(id) {
  abiertas.has(id) ? abiertas.delete(id) : abiertas.add(id);
  try { localStorage.setItem(LS, JSON.stringify([...abiertas].slice(-300))); } catch {}
}

export const proyectoDe = id => S.proyectos.find(p => p.id === id);
export const colorPrioridad = p => ({ 1: "var(--p1)", 2: "var(--p2)", 3: "var(--p3)" }[p] || "var(--p4)");

export function icono(nombre) {
  const I = {
    rep: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    nota: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    sub: '<path d="M6 3v12a3 3 0 0 0 3 3h9"/><path d="M15 15l3 3-3 3"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    campana: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    tomate: '<circle cx="12" cy="13" r="8"/><path d="M12 5V2M9 4l3 1 3-1"/>',
    flecha: '<path d="M9 6l6 6-6 6"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    bandeja: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    hoy: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 9h18"/><text x="12" y="19" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui">' + new Date().getDate() + '</text>',
    proximo: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    explorar: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bandera: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
    alarma: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3L2 6M22 6l-3-3"/>',
    etiqueta: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    almohadilla: '<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    puntos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    atras: '<path d="M15 18l-6-6 6-6"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    hecho: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    grafica: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    importar: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    enviar: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    seccion: '<path d="M4 6h16M4 12h10M4 18h6"/>',
    duracion: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[nombre] || ""}</svg>`;
}

/**
 * @param lista tareas de primer nivel
 * @param op { proyecto: mostrar proyecto, fecha: mostrar fecha, nivel, hijos (mapa ya calculado) }
 */
export function filas(lista, op = {}) {
  const hijos = op.hijos || hijosPorPadre(S.tareas);
  const hoy = hoyISO();
  const nivel = op.nivel || 0;
  return lista.map(t => {
    const pr = progreso(t.id, hijos);
    const abierta = estaAbierta(t.id);
    const p = op.proyecto !== false ? proyectoDe(t.proyectoId) : null;
    const meta = [];
    if (op.fecha !== false && t.fecha && t.fecha !== op.padreFecha) meta.push(`<span class="fecha ${vencida(t, hoy) ? "tarde" : t.fecha === hoy ? "hoy" : ""}">${icono("cal")}${esc(fechaBonita(t.fecha, hoy))}${t.hora ? " · " + t.hora : ""}</span>`);
    else if (t.hora) meta.push(`<span class="fecha">${icono("reloj")}${t.hora}</span>`);
    if (t.duracion) meta.push(`<span>${esc(minutosTexto(t.duracion))}</span>`);
    if (t.repetir) meta.push(`<span title="Se repite">${icono("rep")}</span>`);
    if (pr.total) meta.push(`<span class="prog" title="Pasos hechos">${icono("sub")}${pr.hechas}/${pr.total}</span>`);
    if (t.pomos || t.pomosEstimados) meta.push(`<span title="Pomodoros">${icono("tomate")}${t.pomos || 0}${t.pomosEstimados ? "/" + t.pomosEstimados : ""}</span>`);
    if (t.recordatorios?.length) meta.push(`<span title="Recordatorio">${icono("campana")}</span>`);
    for (const e of t.etiquetas || []) meta.push(`<span class="etq">@${esc(e)}</span>`);
    if (p) meta.push(`<span class="proy">${esc(p.nombre)}${t.seccion ? " / " + esc(t.seccion) : ""} <i style="color:${esc(p.color)}">#</i></span>`);
    else if (op.proyecto !== false && !t.padreId) meta.push(`<span class="proy">Bandeja ${icono("bandeja")}</span>`);
    const barra = pr.total ? `<div class="barra"><i style="width:${Math.round(100 * pr.hechas / pr.total)}%"></i></div>` : "";
    return `<li class="tarea ${t.hecha ? "hecha" : ""}" data-id="${esc(t.id)}" style="--niv:${nivel}">
      <div class="fila">
        <button class="check" data-acc="check" aria-label="${t.hecha ? "Desmarcar" : "Marcar como hecha"}" style="--c:${colorPrioridad(t.prioridad)}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>
        <div class="cuerpo" data-acc="abrir">
          <div class="titulo">${esc(t.titulo)}</div>
          ${t.notas && !op.sinNotas ? `<div class="desc-fila">${esc(t.notas.split("\n")[0].slice(0, 140))}</div>` : ""}
          ${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}
          ${!abierta ? barra : ""}
        </div>
        ${!t.hecha && !op.sinFoco ? `<button class="btn-foco" data-acc="foco" aria-label="Empezar un pomodoro con esta tarea" title="Pomodoro">${icono("play")}</button>` : ""}
        ${pr.total ? `<button class="plegar ${abierta ? "abierta" : ""}" data-acc="plegar" aria-label="${abierta ? "Ocultar" : "Ver"} pasos">${icono("flecha")}</button>` : ""}
      </div>
      ${abierta && (hijos.get(t.id) || []).length ? `<ul class="subtareas">${filas(hijos.get(t.id), { ...op, nivel: nivel + 1, hijos, proyecto: false, verHechas: true, padreFecha: t.fecha })}</ul>` : ""}
    </li>`;
  }).join("");
}

/** Lista vacía bonita */
export const vacio = (titulo, texto = "") => `<div class="vacio"><svg viewBox="0 0 120 90" aria-hidden="true"><rect x="22" y="14" width="76" height="62" rx="10" fill="var(--suave2)"/><path d="M40 44l12 12 26-26" fill="none" stroke="var(--acento)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${esc(titulo)}</b>${texto ? `<p>${esc(texto)}</p>` : ""}</div>`;

/** Fila «+ Añadir tarea» al final de un grupo, como en Todoist */
export const filaAnadir = (ctx = {}, texto = "Añadir tarea") => `<button class="fila-anadir" data-anadir='${esc(JSON.stringify(ctx))}'><span>${icono("mas")}</span>${esc(texto)}</button>`;
