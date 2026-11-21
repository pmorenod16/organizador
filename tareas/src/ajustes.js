// Ajustes, proyectos, importación de Todoist y copia de seguridad.
import * as D from "./datos.js";
import { S } from "./datos.js";
import { esc, hoja, toast, confirmar, $ } from "./ui.js";
import { deTodoist, nombreDeArchivo } from "./csv.js";
import { hoyISO, fechaBonita } from "./fechas.js";
import { normal } from "./logica.js";
import { pedirPermiso, permisoWeb } from "./avisos.js";
import { esNativo } from "./nativo.js";
import { icono } from "./lista.js";

export const APK_URL = "https://github.com/pmorenod16/organizador/releases/download/tasca/tasca.apk";

export function ajustes({ email, version }) {
  const a = S.ajustes;
  const num = (k, n, min, max, suf = "min") => `<label class="fila-ajuste"><span>${n}</span><span><input type="number" data-aj="${k}" value="${esc(a[k])}" min="${min}" max="${max}"> ${suf}</span></label>`;
  const sw = (k, n) => `<label class="fila-ajuste"><span>${n}</span><input type="checkbox" class="sw" data-aj="${k}" ${a[k] ? "checked" : ""}></label>`;
  const perm = esNativo() ? "granted" : permisoWeb();
  return `<header class="vista-cab"><a class="icono atras" href="#/explorar" aria-label="Atrás">${icono("atras")}</a><div class="tit"><h1>Ajustes</h1><p class="suave">${esc(email || "")}</p></div></header>
  <section class="caja">
    <h2>Importar de Todoist</h2>
    <p class="suave">Elige uno o varios CSV (uno por proyecto). Las sesiones quedan como tareas con fecha y los pasos como subtareas, con sus secciones, notas y prioridades.</p>
    <label class="btn primario archivo">Elegir archivos CSV<input type="file" accept=".csv,text/csv" multiple data-importar hidden></label>
  </section>
  <section class="caja">
    <h2>Proyectos</h2>
    <ul class="proyectos-ajuste">${S.proyectos.map(p => `<li><span class="punto" style="background:${esc(p.color)}"></span><span>${esc(p.nombre)}${p.archivado ? ' <small class="suave">(archivado)</small>' : ""}</span><small class="suave">${S.tareas.filter(t => t.proyectoId === p.id && !t.hecha).length} pendientes</small><button class="enlace" data-editar-proyecto="${esc(p.id)}">Editar</button></li>`).join("") || '<li class="suave">Aún no hay proyectos.</li>'}</ul>
    <button class="btn" data-nuevo-proyecto>+ Nuevo proyecto</button>
  </section>
  <section class="caja">
    <h2>Recordatorios</h2>
    ${esNativo() ? `<p class="suave">Los avisos llegan aunque la app esté cerrada. En los Xiaomi: mantén pulsado el icono → Información de la app → Ahorro de batería: <b>Sin restricciones</b> e Inicio automático: <b>activado</b>.</p>`
      : perm === "granted" ? `<p class="suave">Avisos activados en este navegador. Solo llegan con la web abierta (aunque sea en otra pestaña). Para avisos con todo cerrado, usa la app del móvil.</p>`
      : perm === "denied" ? `<p class="aviso">Has bloqueado los avisos en este navegador. Actívalos en el candado de la barra de direcciones.</p>`
      : `<button class="btn" data-permiso>Activar avisos en este navegador</button>`}
    <label class="fila-ajuste"><span>Aviso por defecto al poner hora</span><select data-aj="aviso">${[[0, "A la hora"], [5, "5 min antes"], [10, "10 min antes"], [15, "15 min antes"], [30, "30 min antes"], [60, "1 h antes"], ["", "Sin aviso"]].map(([v, n]) => `<option value="${v}" ${String(a.aviso ?? "") === String(v) ? "selected" : ""}>${n}</option>`).join("")}</select></label>
  </section>
  <section class="caja">
    <h2>Pomodoro</h2>
    ${num("foco", "Concentración", 5, 120)}${num("corto", "Descanso corto", 1, 30)}${num("largo", "Descanso largo", 5, 60)}
    ${num("cadaLargo", "Descanso largo cada", 2, 8, "pomodoros")}${num("objetivo", "Objetivo diario", 1, 20, "pomodoros")}
    ${sw("autoDescanso", "Empezar el descanso solo")}${sw("autoFoco", "Empezar el siguiente pomodoro solo")}${sw("sonidoFin", "Sonido al terminar")}
  </section>
  <section class="caja">
    <h2>Aspecto</h2>
    <label class="fila-ajuste"><span>Tema</span><select data-aj="tema"><option value="auto" ${a.tema === "auto" ? "selected" : ""}>Como el sistema</option><option value="claro" ${a.tema === "claro" ? "selected" : ""}>Claro</option><option value="oscuro" ${a.tema === "oscuro" ? "selected" : ""}>Oscuro</option></select></label>
  </section>
  <section class="caja">
    <h2>App del móvil</h2>
    ${esNativo() ? `<p class="suave">Estás usando la app de Android. Se actualiza sola, como la web.</p>` : `<p class="suave">Para Android, descarga el APK e instálalo (permite instalar apps de esta fuente si lo pide). También puedes añadir esta web a la pantalla de inicio desde el menú del navegador.</p><a class="btn" href="${APK_URL}">Descargar el APK</a>`}
  </section>
  <section class="caja">
    <h2>Tus datos</h2>
    <div class="botones-izq"><button class="btn" data-exportar>Descargar copia (JSON)</button><label class="btn archivo">Restaurar copia<input type="file" accept=".json,application/json" data-restaurar hidden></label><button class="btn" data-ir="#/hechas">Ver hechas</button></div>
    <p class="suave peque">Todo se guarda en tu Firebase y se sincroniza entre el móvil y la web. Funciona sin conexión y se sube al volver.</p>
  </section>
  <section class="caja">
    <div class="fila-ajuste"><span>Versión <code>${esc(version)}</code></span><button class="btn peque" data-actualizar>Buscar actualizaciones</button></div>
    <p class="suave peque">Se actualiza sola al abrirla, al volver a ella y cada 30 minutos.</p>
    <button class="btn peligro" data-salir>Cerrar sesión</button></section>`;
}

/** Guardar un ajuste desde un input */
export function cambiarAjuste(el) {
  const k = el.dataset.aj;
  let v = el.type === "checkbox" ? el.checked : el.type === "number" ? Math.max(Number(el.min) || 0, Math.min(Number(el.max) || 999, Number(el.value) || 0)) : el.value;
  if (k === "aviso") v = v === "" ? null : Number(v);
  D.guardarAjustes({ [k]: v });
  toast("Guardado", { ms: 1200 });
}

export async function activarPermiso() { const ok = await pedirPermiso(); toast(ok ? "Avisos activados" : "No se han activado los avisos"); }

// ---------------- proyectos ----------------
export function editarProyecto(id, alBorrar) {
  const p = id ? S.proyectos.find(x => x.id === id) : { nombre: "", color: D.COLORES[S.proyectos.length % D.COLORES.length] };
  if (!p) return;
  let color = p.color;
  const el = hoja(`<form class="form-proyecto"><h2>${id ? "Editar proyecto" : "Nuevo proyecto"}</h2>
    <label>Nombre<input name="n" value="${esc(p.nombre)}" placeholder="p. ej. Teoria de Circuits" required></label>
    <div class="colores">${D.COLORES.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === color ? "on" : ""}" aria-label="Color ${c}"></button>`).join("")}</div>
    ${id ? `<label class="fila-ajuste"><span>Archivado (oculto en el menú)</span><input type="checkbox" class="sw" name="arch" ${p.archivado ? "checked" : ""}></label>` : ""}
    <div class="botones">${id ? `<button type="button" class="btn peligro" data-borrar>Borrar</button>` : ""}<span style="flex:1"></span><button class="btn primario">Guardar</button></div></form>`, { clase: "peque" });
  el.querySelectorAll("[data-c]").forEach(b => (b.onclick = () => { color = b.dataset.c; el.querySelectorAll("[data-c]").forEach(x => x.classList.toggle("on", x === b)); }));
  const f = $("form", el);
  f.onsubmit = e => { e.preventDefault(); const x = D.guardarProyecto({ ...p, nombre: f.n.value, color, archivado: f.arch?.checked }); el.cerrar(); if (!id) location.hash = "#/proyecto/" + x.id; };
  el.querySelector("[data-borrar]")?.addEventListener("click", async () => {
    const n = S.tareas.filter(t => t.proyectoId === id).length;
    if (await confirmar(`¿Borrar «${p.nombre}»${n ? ` y sus ${n} tareas` : ""}? No se puede deshacer.`, { si: "Borrar", peligro: true })) { el.cerrar(); await D.borrarProyecto(id); toast("Proyecto borrado"); alBorrar?.(); }
  });
  setTimeout(() => f.n.focus(), 60);
}

// ---------------- importar CSV de Todoist ----------------
export async function importar(archivos, destinoFijo = null) {
  const hoy = hoyISO();
  const lotes = [];
  for (const a of archivos) {
    const texto = await a.text();
    const r = deTodoist(texto, hoy);
    const nombre = nombreDeArchivo(a.name);
    const existe = S.proyectos.find(p => normal(p.nombre) === normal(nombre));
    lotes.push({ archivo: a.name, nombre, destino: destinoFijo || (existe ? existe.id : "nuevo"), ...r });
  }
  const el = hoja(`<div class="importar"><h2>Importar de Todoist</h2>${lotes.map((l, i) => {
    const raiz = l.tareas.filter(t => !t.padreRef), fechas = l.tareas.map(t => t.fecha).filter(Boolean).sort();
    return `<div class="lote" data-i="${i}">
      <p><b>${esc(l.archivo)}</b> · ${raiz.length} tareas y ${l.tareas.length - raiz.length} pasos${fechas.length ? ` · ${esc(fechaBonita(fechas[0]))} → ${esc(fechaBonita(fechas[fechas.length - 1]))}` : ""}</p>
      ${l.tareas.length ? `<label>Proyecto <select data-destino>
        <option value="nuevo" ${l.destino === "nuevo" ? "selected" : ""}>Nuevo: «${esc(l.nombre)}»</option>
        ${S.proyectos.map(p => `<option value="${esc(p.id)}" ${l.destino === p.id ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}
      </select></label><input data-nombre value="${esc(l.nombre)}" ${l.destino === "nuevo" ? "" : "hidden"} aria-label="Nombre del proyecto nuevo">` : ""}
      ${l.avisos.length ? `<details class="aviso"><summary>${l.avisos.length} aviso${l.avisos.length > 1 ? "s" : ""}</summary><ul>${l.avisos.slice(0, 30).map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
      ${l.tareas.length ? `<ul class="muestra">${raiz.slice(0, 4).map(t => `<li>${esc(t.titulo)} <small class="suave">${t.fecha ? esc(fechaBonita(t.fecha)) + (t.hora ? " " + t.hora : "") : "sin fecha"} · ${l.tareas.filter(x => x.padreRef === t.ref).length} pasos</small></li>`).join("")}${raiz.length > 4 ? `<li class="suave">… y ${raiz.length - 4} más</li>` : ""}</ul>` : ""}
    </div>`;
  }).join("")}
    <label class="fila-ajuste"><span>Aviso 10 min antes en las tareas con hora</span><input type="checkbox" class="sw" data-con-aviso checked></label>
    <label class="fila-ajuste"><span>Saltar las que ya tengo (mismo título y fecha)</span><input type="checkbox" class="sw" data-saltar checked></label>
    <p class="suave peque" data-progreso></p>
    <div class="botones"><button class="btn" data-cancelar>Cancelar</button><button class="btn primario" data-ok ${lotes.some(l => l.tareas.length) ? "" : "disabled"}>Importar</button></div></div>`, { clase: "hoja-importar" });
  el.querySelectorAll(".lote").forEach(div => {
    const sel = div.querySelector("[data-destino]");
    sel?.addEventListener("change", () => { div.querySelector("[data-nombre]").hidden = sel.value !== "nuevo"; });
  });
  el.querySelector("[data-cancelar]").onclick = () => el.cerrar();
  el.querySelector("[data-ok]").onclick = async () => {
    const btn = el.querySelector("[data-ok]"); btn.disabled = true;
    const conAviso = el.querySelector("[data-con-aviso]").checked, saltar = el.querySelector("[data-saltar]").checked;
    let total = 0, saltadas = 0, primerProyecto = null;
    try {
      for (const [i, l] of lotes.entries()) {
        if (!l.tareas.length) continue;
        const div = el.querySelector(`.lote[data-i="${i}"]`);
        let pid = div.querySelector("[data-destino]").value;
        if (pid === "nuevo") pid = D.guardarProyecto({ nombre: div.querySelector("[data-nombre]").value.trim() || l.nombre }).id;
        primerProyecto ||= pid;
        const ya = new Set(S.tareas.filter(t => t.proyectoId === pid).map(t => normal(t.titulo) + "|" + (t.fecha || "") + "|" + (t.padreId ? "s" : "r")));
        const ids = new Map(), nuevas = [], omitidas = new Set();
        const base = Date.now();
        for (const [k, t] of l.tareas.entries()) {
          if (t.padreRef && omitidas.has(t.padreRef)) { omitidas.add(t.ref); continue; }
          if (saltar && !t.padreRef && ya.has(normal(t.titulo) + "|" + (t.fecha || "") + "|r")) { omitidas.add(t.ref); saltadas++; continue; }
          const id = D.nuevoId() + k.toString(36);
          ids.set(t.ref, id);
          nuevas.push(D.nuevaTarea({
            id, titulo: t.titulo, notas: t.notas, proyectoId: pid, padreId: t.padreRef ? ids.get(t.padreRef) || null : null,
            seccion: t.padreRef ? null : t.seccion, fecha: t.fecha, hora: t.hora, duracion: t.duracion, prioridad: t.prioridad,
            etiquetas: t.etiquetas, repetir: t.repetir, recordatorios: conAviso && t.hora ? [10] : null,
            orden: t.orden, creado: base + k, origen: "todoist",
          }));
        }
        await D.guardarMuchas(nuevas, (n, de) => { el.querySelector("[data-progreso]").textContent = `${l.archivo}: ${n}/${de}…`; });
        total += nuevas.length;
      }
      el.cerrar();
      toast(`Importadas ${total} tareas y pasos${saltadas ? ` (${saltadas} ya estaban)` : ""}`, { ms: 5000 });
      if (primerProyecto) location.hash = "#/proyecto/" + primerProyecto;
    } catch (e) {
      console.error(e); btn.disabled = false;
      el.querySelector("[data-progreso]").textContent = "Error al importar: " + (e.message || e);
    }
  };
}

// ---------------- copia de seguridad ----------------
export function exportar() {
  const blob = new Blob([JSON.stringify(D.exportar(), null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `tasca-${hoyISO()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export async function restaurar(archivo) {
  let datos;
  try { datos = JSON.parse(await archivo.text()); } catch { toast("Ese archivo no es una copia válida"); return; }
  if (datos.app !== "tasca") { toast("Ese archivo no es una copia de Tasca"); return; }
  if (!(await confirmar(`¿Restaurar ${datos.tareas?.length || 0} tareas y ${datos.proyectos?.length || 0} proyectos? Se añaden o sustituyen las que tengan el mismo identificador.`, { si: "Restaurar" }))) return;
  for (const p of datos.proyectos || []) D.guardarProyecto(p);
  await D.guardarMuchas(datos.tareas || []);
  toast("Copia restaurada");
}
