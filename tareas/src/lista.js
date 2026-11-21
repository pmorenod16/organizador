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
    if (t.notas) meta.push(`<span title="Tiene notas">${icono("nota")}</span>`);
    if (t.recordatorios?.length) meta.push(`<span title="Recordatorio">${icono("campana")}</span>`);
    for (const e of t.etiquetas || []) meta.push(`<span class="etq">@${esc(e)}</span>`);
    if (p) meta.push(`<span class="proy"><i style="background:${esc(p.color)}"></i>${esc(p.nombre)}</span>`);
    const barra = pr.total ? `<div class="barra"><i style="width:${Math.round(100 * pr.hechas / pr.total)}%"></i></div>` : "";
    return `<li class="tarea ${t.hecha ? "hecha" : ""}" data-id="${esc(t.id)}" style="--niv:${nivel}">
      <div class="fila">
        <button class="check" data-acc="check" aria-label="${t.hecha ? "Desmarcar" : "Marcar como hecha"}" style="--c:${colorPrioridad(t.prioridad)}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>
        <div class="cuerpo" data-acc="abrir">
          <div class="titulo">${esc(t.titulo)}</div>
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
