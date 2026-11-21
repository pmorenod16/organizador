// Añadir tarea y ficha de una tarea, con el mismo orden que Todoist.
import * as D from "./datos.js";
import { S } from "./datos.js";
import { hoja, esc, toast, confirmar, $, vibrar } from "./ui.js";
import { analizar } from "./rapido.js";
import { hoyISO, sumarDias, fechaBonita, minutosTexto } from "./fechas.js";
import { textoRepetir, hijosPorPadre, compararManual } from "./logica.js";
import { colorPrioridad, icono, proyectoDe } from "./lista.js";
import { elegirFecha, elegirPrioridad, elegirAviso, elegirEtiquetas, elegirProyecto, menu, textoAviso } from "./selectores.js";

export const colorFecha = f => { const h = hoyISO(); return !f ? "" : f < h ? "var(--p1)" : f === h ? "var(--verde)" : f === sumarDias(h, 1) ? "#E8590C" : f <= sumarDias(h, 7) ? "#7048E8" : "var(--suave)"; };
const nombreProyecto = (pid, sec) => { const p = proyectoDe(pid); return p ? `<span style="color:${esc(p.color)}">${icono("almohadilla")}</span>${esc(p.nombre)}${sec ? ` <span class="suave">/ ${esc(sec)}</span>` : ""}` : `${icono("bandeja")}Bandeja de entrada`; };

// ---------------- añadir tarea ----------------
export function anadir(contexto = {}) {
  const hoy = hoyISO();
  const st = { fecha: contexto.fecha ?? null, hora: null, repetir: null, prioridad: 4, recordatorios: null, etiquetas: [], proyectoId: contexto.proyectoId || null, seccion: contexto.seccion || null };
  const padre = contexto.padreId && S.tareas.find(t => t.id === contexto.padreId);
  const el = hoja(`
    <form class="rapido" autocomplete="off">
      ${padre ? `<div class="suave peque">Subtarea de «${esc(padre.titulo)}»</div>` : ""}
      <textarea name="t" rows="1" placeholder="Nombre de la tarea" enterkeyhint="send"></textarea>
      <textarea name="d" rows="1" placeholder="Descripción" class="desc"></textarea>
      <div class="chips-opc" data-chips></div>
      <div class="pie-rapido">
        <button type="button" class="chip-proy" data-proy></button>
        <button class="enviar" aria-label="Añadir tarea">${icono("enviar")}</button>
      </div>
      <p class="truco suave peque">Truco: escribe «mañana 18:00», «cada lunes», «#asignatura» o «p1» en el nombre.</p>
    </form>`, { clase: "hoja-rapido" });
  const f = $("form", el), ta = f.t;
  const actual = () => {
    const r = analizar(ta.value, { hoy, proyectos: S.proyectos });
    return {
      r, fecha: r.fecha || st.fecha, hora: r.fecha || r.hora ? r.hora : st.hora, repetir: r.repetir || st.repetir,
      prioridad: r.prioridad < 4 ? r.prioridad : st.prioridad, proyectoId: r.proyectoId || st.proyectoId,
      seccion: r.proyectoId && r.proyectoId !== st.proyectoId ? null : st.seccion,
      etiquetas: [...new Set([...st.etiquetas, ...r.etiquetas])],
    };
  };
  const pintar = () => {
    const a = actual();
    const fechaTxt = a.fecha ? `${esc(fechaBonita(a.fecha))}${a.hora ? " " + a.hora : ""}` : "Fecha";
    $("[data-chips]", el).innerHTML = `
      <button type="button" class="chip-opc ${a.fecha ? "con" : ""}" data-c="fecha" style="${a.fecha ? `color:${colorFecha(a.fecha)}` : ""}">${icono(a.repetir ? "rep" : "cal")}${fechaTxt}${a.fecha && !a.r.fecha ? `<i data-quitar="fecha">×</i>` : ""}</button>
      <button type="button" class="chip-opc ${a.prioridad < 4 ? "con" : ""}" data-c="prioridad" style="${a.prioridad < 4 ? `color:${colorPrioridad(a.prioridad)}` : ""}">${icono("bandera")}${a.prioridad < 4 ? "P" + a.prioridad : "Prioridad"}</button>
      <button type="button" class="chip-opc ${st.recordatorios?.length ? "con" : ""}" data-c="aviso">${icono("alarma")}${st.recordatorios?.length ? esc(textoAviso(st.recordatorios)) : "Recordatorio"}</button>
      <button type="button" class="chip-opc ${a.etiquetas.length ? "con" : ""}" data-c="etiquetas">${icono("etiqueta")}${a.etiquetas.length ? a.etiquetas.map(e => "@" + esc(e)).join(" ") : "Etiquetas"}</button>`;
    $("[data-proy]", el).innerHTML = `${nombreProyecto(a.proyectoId, a.seccion)} ▾`;
    $("[data-proy]", el).disabled = !!padre;
    f.querySelector(".enviar").disabled = !a.r.titulo;
    for (const x of [ta, f.d]) { x.style.height = "auto"; x.style.height = x.scrollHeight + "px"; }
  };
  ta.oninput = pintar; f.d.oninput = pintar;
  ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
  el.addEventListener("click", async e => {
    const q = e.target.closest("[data-quitar]");
    if (q) { e.stopPropagation(); Object.assign(st, { fecha: null, hora: null, repetir: null }); pintar(); return; }
    const b = e.target.closest("[data-c], [data-proy]"); if (!b) return;
    const a = actual();
    if (b.dataset.c === "fecha") { const r = await elegirFecha(a); if (r) Object.assign(st, r); }
    else if (b.dataset.c === "prioridad") { const r = await elegirPrioridad(a.prioridad); if (r) st.prioridad = r; }
    else if (b.dataset.c === "aviso") { const r = await elegirAviso(st.recordatorios, { conHora: !!a.hora }); if (r) st.recordatorios = r.length ? r : null; }
    else if (b.dataset.c === "etiquetas") { const r = await elegirEtiquetas(a.etiquetas); if (r) st.etiquetas = r; }
    else if (b.dataset.proy !== undefined) { const r = await elegirProyecto(a.proyectoId, a.seccion); if (r) Object.assign(st, r); }
    pintar(); ta.focus();
  });
  f.onsubmit = e => {
    e.preventDefault();
    const a = actual();
    if (!a.r.titulo) return;
    const t = D.nuevaTarea({
      titulo: a.r.titulo, notas: f.d.value.trim(), proyectoId: padre ? padre.proyectoId : a.proyectoId, seccion: padre ? null : a.seccion,
      padreId: padre?.id || null, fecha: a.fecha ?? (padre ? padre.fecha : null), hora: a.hora, repetir: a.repetir,
      prioridad: a.prioridad, etiquetas: a.etiquetas,
      recordatorios: st.recordatorios || (a.hora && S.ajustes.aviso != null ? [S.ajustes.aviso] : null),
    });
    D.guardarTarea(t);
    vibrar();
    toast(`Añadida a ${proyectoDe(t.proyectoId)?.nombre || "Bandeja de entrada"}${t.fecha ? " · " + fechaBonita(t.fecha) : ""}`);
    ta.value = ""; f.d.value = ""; st.etiquetas = []; st.recordatorios = null;
    pintar(); ta.focus();
  };
  pintar();
  setTimeout(() => ta.focus(), 60);
}

// ---------------- ficha de la tarea ----------------
const DURACIONES = [15, 25, 30, 45, 60, 90, 120, 180];

export function abrirTarea(id, { alFoco } = {}) {
  let t = S.tareas.find(x => x.id === id);
  if (!t) return;
  const el = hoja(`<div class="ficha" data-ficha></div>`, { clase: "hoja-ficha", alCerrar: () => quitar() });
  const quitar = D.alCambiar(() => { const n = S.tareas.find(x => x.id === id); if (!n) { el.cerrar(); return; } t = n; pintar(); });
  const guardar = cambios => { Object.assign(t, cambios); D.cambiarTarea(t.id, cambios); pintar(); };

  function pintar() {
    const activo = document.activeElement;
    const enfocado = activo && el.contains(activo) ? activo.name || activo.dataset?.sub : null;
    if (enfocado === "titulo" || enfocado === "notas") { pintarSubtareas(); return; } // no pisar lo que se escribe
    const padre = t.padreId && S.tareas.find(x => x.id === t.padreId);
    const fila = (c, ico, nombre, valor, color = "") => `<button class="fila-det" data-c="${c}"><span class="ico-det">${icono(ico)}</span><span class="nom">${nombre}</span><span class="val ${valor ? "" : "vacio-v"}" style="${color ? "color:" + color : ""}">${valor || "Añadir"}</span></button>`;
    $("[data-ficha]", el).innerHTML = `
      <div class="ficha-sup">
        ${padre ? `<button class="miga" data-ir="${esc(padre.id)}">${icono("atras")} ${esc(padre.titulo)}</button>` : `<button class="miga" data-c="proyecto">${nombreProyecto(t.proyectoId, t.seccion)}</button>`}
        <span class="sep"></span>
        <button class="icono" data-c="menu" aria-label="Más acciones">${icono("puntos")}</button>
        <button class="icono" data-cerrar aria-label="Cerrar">${icono("cerrar")}</button>
      </div>
      <div class="ficha-cab">
        <button class="check grande" data-acc="check" style="--c:${colorPrioridad(t.prioridad)}" aria-label="Completar"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>
        <textarea name="titulo" rows="1" class="ficha-titulo ${t.hecha ? "tachado" : ""}">${esc(t.titulo)}</textarea>
      </div>
      <textarea name="notas" class="ficha-notas" rows="1" placeholder="Descripción">${esc(t.notas || "")}</textarea>
      <div class="detalles">
        ${!padre ? fila("proyecto", "carpeta", "Proyecto", nombreProyecto(t.proyectoId, t.seccion)) : ""}
        ${fila("fecha", t.repetir ? "rep" : "cal", "Fecha", t.fecha ? `${esc(fechaBonita(t.fecha))}${t.hora ? " · " + t.hora : ""}${t.repetir ? " · " + esc(textoRepetir(t.repetir)) : ""}` : "", colorFecha(t.fecha))}
        ${fila("prioridad", "bandera", "Prioridad", `P${t.prioridad || 4}`, colorPrioridad(t.prioridad))}
        ${fila("aviso", "alarma", "Recordatorio", t.fecha ? textoAviso(t.recordatorios) : "")}
        ${fila("etiquetas", "etiqueta", "Etiquetas", (t.etiquetas || []).map(e => "@" + esc(e)).join(" "))}
        ${fila("duracion", "duracion", "Duración", t.duracion ? minutosTexto(t.duracion) : "")}
        <div class="fila-det"><span class="ico-det">${icono("tomate")}</span><span class="nom">Pomodoros</span><span class="val">${t.pomos || 0} de <input type="number" name="pomosEstimados" min="0" max="40" value="${t.pomosEstimados ?? ""}" placeholder="?"></span>${!t.hecha ? `<button class="btn peque primario" data-acc="foco">${icono("play")} Empezar</button>` : ""}</div>
      </div>
      <div data-subtareas></div>
      <p class="suave peque">Creada el ${new Date(t.creado).toLocaleDateString("es-ES")}${t.hechaVeces ? ` · completada ${t.hechaVeces} ${t.hechaVeces === 1 ? "vez" : "veces"}` : ""}</p>`;
    pintarSubtareas();
    ajustarAltura();
    if (enfocado) el.querySelector(`[data-sub="${enfocado}"], [name="${enfocado}"]`)?.focus();
  }
  function pintarSubtareas() {
    const pasos = (hijosPorPadre(S.tareas).get(t.id) || []).slice().sort(compararManual);
    const hechos = pasos.filter(x => x.hecha).length;
    const foco = document.activeElement?.dataset?.nuevoPaso !== undefined;
    $("[data-subtareas]", el).innerHTML = `
      <h3 class="tit-sub">Subtareas ${pasos.length ? `<span class="suave">${hechos}/${pasos.length}</span>` : ""}</h3>
      ${pasos.length ? `<div class="barra"><i style="width:${Math.round(100 * hechos / pasos.length)}%"></i></div>` : ""}
      <ul class="pasos">
        ${pasos.map(s => `<li class="${s.hecha ? "hecha" : ""}">
          <button class="check" data-sub-check="${esc(s.id)}" style="--c:${colorPrioridad(s.prioridad)}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>
          <input data-sub="${esc(s.id)}" value="${esc(s.titulo)}">
          <button class="icono" data-ir="${esc(s.id)}" aria-label="Abrir la subtarea">${icono("flecha")}</button>
        </li>`).join("")}
        <li class="nuevo-paso"><span class="mas">${icono("mas")}</span><input data-nuevo-paso placeholder="Añadir subtarea"></li>
      </ul>`;
    if (foco) el.querySelector("[data-nuevo-paso]")?.focus();
  }
  const ajustarAltura = () => el.querySelectorAll("textarea").forEach(x => { x.style.height = "auto"; x.style.height = x.scrollHeight + "px"; });

  el.addEventListener("input", e => { if (e.target.tagName === "TEXTAREA") ajustarAltura(); });
  el.addEventListener("change", e => {
    const x = e.target, n = x.name;
    if (x.dataset.sub) { const v = x.value.trim(); v ? D.cambiarTarea(x.dataset.sub, { titulo: v }) : D.borrarTarea(x.dataset.sub); return; }
    if (n === "titulo") { const v = x.value.trim(); if (v) { t.titulo = v; D.cambiarTarea(t.id, { titulo: v }); } }
    else if (n === "notas") { t.notas = x.value; D.cambiarTarea(t.id, { notas: x.value }); }
    else if (n === "pomosEstimados") guardar({ pomosEstimados: Number(x.value) || null });
  });
  el.addEventListener("keydown", e => {
    if (e.target.dataset.nuevoPaso !== undefined && e.key === "Enter") {
      e.preventDefault();
      const v = e.target.value.trim(); if (!v) return;
      D.guardarTarea(D.nuevaTarea({ titulo: v, padreId: t.id, proyectoId: t.proyectoId, fecha: t.fecha }));
      e.target.value = "";
    }
    if (e.target.name === "titulo" && e.key === "Enter") { e.preventDefault(); e.target.blur(); }
  });
  el.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.cerrar !== undefined) return el.cerrar();
    if (b.dataset.ir) { el.cerrar(); abrirTarea(b.dataset.ir, { alFoco }); return; }
    if (b.dataset.subCheck) { const s = S.tareas.find(x => x.id === b.dataset.subCheck); if (s) { vibrar(); D.alternar(s); } return; }
    switch (b.dataset.c) {
      case "proyecto": {
        const r = await elegirProyecto(t.proyectoId, t.seccion); if (!r) return;
        guardar(r);
        const hijos = hijosPorPadre(S.tareas), pila = [...(hijos.get(t.id) || [])];
        while (pila.length) { const h = pila.shift(); D.cambiarTarea(h.id, { proyectoId: r.proyectoId }); pila.push(...(hijos.get(h.id) || [])); }
        return;
      }
      case "fecha": {
        const r = await elegirFecha(t); if (!r) return;
        const c = { ...r };
        if (r.hora && !t.recordatorios?.length && S.ajustes.aviso != null) c.recordatorios = [S.ajustes.aviso];
        return guardar(c);
      }
      case "prioridad": { const r = await elegirPrioridad(t.prioridad); if (r) guardar({ prioridad: r }); return; }
      case "aviso": {
        if (!t.fecha) { toast("Pon primero una fecha"); return; }
        const r = await elegirAviso(t.recordatorios, { conHora: !!t.hora }); if (r) guardar({ recordatorios: r.length ? r : null }); return;
      }
      case "etiquetas": { const r = await elegirEtiquetas(t.etiquetas || []); if (r) guardar({ etiquetas: r }); return; }
      case "duracion": {
        const r = await menu([...DURACIONES.map(d => ({ id: String(d), texto: minutosTexto(d), icono: "duracion" })), { id: "0", texto: "Sin duración", icono: "cerrar" }], "Duración");
        if (r) guardar({ duracion: Number(r) || null }); return;
      }
      case "menu": {
        const r = await menu([
          { id: "hoy", texto: "Para hoy", icono: "hoy" }, { id: "manana", texto: "Para mañana", icono: "cal" },
          ...(!t.hecha ? [{ id: "foco", texto: "Empezar un pomodoro", icono: "tomate" }] : []),
          { id: "subtarea", texto: "Añadir subtarea", icono: "sub" },
          { id: "duplicar", texto: "Duplicar", icono: "lista" },
          { id: "borrar", texto: "Eliminar tarea", icono: "cerrar", peligro: true },
        ]);
        return accion(r);
      }
    }
    if (b.dataset.acc) accion(b.dataset.acc);
  });
  async function accion(a) {
    switch (a) {
      case "check": { vibrar(); const eraRepetida = t.repetir && !t.hecha; const r = await D.alternar(t); toast(r.texto, { accion: "Deshacer", alPulsar: r.deshacer }); if (!eraRepetida) el.cerrar(); break; }
      case "hoy": guardar({ fecha: hoyISO() }); break;
      case "manana": guardar({ fecha: sumarDias(hoyISO(), 1) }); break;
      case "foco": el.cerrar(); alFoco?.(t.id); break;
      case "subtarea": el.querySelector("[data-nuevo-paso]")?.focus(); break;
      case "duplicar": {
        const hijos = hijosPorPadre(S.tareas);
        const copiar = (orig, padreId, raiz) => {
          const c = D.nuevaTarea({ ...orig, padreId, hecha: false, hechaEn: null, pomos: 0, hechaVeces: 0, creado: Date.now(), titulo: raiz ? orig.titulo + " (copia)" : orig.titulo });
          c.id = D.nuevoId(); D.guardarTarea(c);
          for (const h of hijos.get(orig.id) || []) copiar(h, c.id, false);
        };
        copiar(t, t.padreId || null, true);
        toast("Duplicada"); break;
      }
      case "borrar": {
        const n = (hijosPorPadre(S.tareas).get(t.id) || []).length;
        if (await confirmar(`¿Eliminar «${t.titulo}»${n ? " y sus subtareas" : ""}?`, { si: "Eliminar", peligro: true })) { el.cerrar(); await D.borrarTarea(t.id); toast("Eliminada"); }
        break;
      }
    }
  }
  pintar();
}
