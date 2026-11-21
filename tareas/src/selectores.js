// Selectores pequeños, como los de Todoist: fecha (con hora y repetición), prioridad, recordatorio,
// etiquetas, proyecto y menús de acciones. Todos devuelven una promesa con lo elegido (o null si se cierra).
import { S } from "./datos.js";
import { hoja, esc } from "./ui.js";
import { icono, colorPrioridad } from "./lista.js";
import { hoyISO, sumarDias, diaSemana, fechaBonita, DIAS, esFecha, esHora } from "./fechas.js";
import { textoRepetir, PRIORIDADES } from "./logica.js";

function elegir(html, alMontar, clase = "peque selector") {
  return new Promise(ok => {
    let hecho = false;
    const el = hoja(html, { clase, alCerrar: () => !hecho && ok(null) });
    const fin = v => { hecho = true; el.cerrar(); ok(v); };
    alMontar(el, fin);
  });
}

/** Fecha, hora y repetición. Devuelve { fecha, hora, repetir } (fecha null = sin fecha). */
export function elegirFecha({ fecha = null, hora = null, repetir = null } = {}) {
  const h = hoyISO();
  const finde = (() => { let f = h; while (diaSemana(f) !== 5) f = sumarDias(f, 1); return f; })();
  const lunes = sumarDias(h, 7 - diaSemana(h));
  const op = [
    [h, "Hoy", DIAS[diaSemana(h)].slice(0, 3), "var(--verde)", "hoy"],
    [sumarDias(h, 1), "Mañana", DIAS[diaSemana(sumarDias(h, 1))].slice(0, 3), "var(--naranja)", "cal"],
    [finde, "Este fin de semana", DIAS[5].slice(0, 3), "var(--p3)", "cal"],
    [lunes, "Próxima semana", `lun ${Number(lunes.slice(8))}`, "var(--morado)", "proximo"],
    ["", "Sin fecha", "", "var(--suave)", "cerrar"],
  ];
  const rep = repetir ? `${repetir.cada}:${repetir.n || 1}` : "";
  return elegir(`<div class="sel-fecha">
      <div class="sel-actual">${fecha ? `${icono("cal")} ${esc(fechaBonita(fecha))}${hora ? " · " + hora : ""}${repetir ? " · " + esc(textoRepetir(repetir)) : ""}` : "Sin fecha"}</div>
      <ul class="opciones">${op.map(([f, n, d, c, i]) => `<li><button data-f="${f}"><span style="color:${c}">${icono(i)}</span><span>${n}</span><small>${d}</small></button></li>`).join("")}</ul>
      <label class="fila-sel">${icono("cal")}<span>Otra fecha</span><input type="date" name="f" value="${esc(fecha || "")}"></label>
      <label class="fila-sel">${icono("reloj")}<span>Hora</span><input type="time" name="h" value="${esc(hora || "")}"></label>
      <label class="fila-sel">${icono("rep")}<span>Repetir</span><select name="r">
        <option value="">No se repite</option>
        ${[["dia:1", "Cada día"], ["laborables:1", "Días laborables"], ["semana:1", "Cada semana"], ["semana:2", "Cada 2 semanas"], ["mes:1", "Cada mes"], ["año:1", "Cada año"]].map(([v, n]) => `<option value="${v}" ${rep === v ? "selected" : ""}>${n}</option>`).join("")}
        ${rep && !["dia:1", "laborables:1", "semana:1", "semana:2", "mes:1", "año:1"].includes(rep) ? `<option selected value="${rep}">${esc(textoRepetir(repetir))}</option>` : ""}
      </select></label>
      <div class="botones"><button class="btn" data-cancelar>Cancelar</button><button class="btn primario" data-ok>Listo</button></div>
    </div>`, (el, fin) => {
    const f = el.querySelector("[name=f]"), ho = el.querySelector("[name=h]"), r = el.querySelector("[name=r]");
    const leer = fx => {
      const [cada, n] = r.value.split(":");
      const nf = fx ?? (esFecha(f.value) ? f.value : null);
      const nh = esHora(ho.value) ? ho.value : null;
      return { fecha: nf || (nh || r.value ? h : null), hora: nf || nh ? nh : null, repetir: r.value && (nf || nh || r.value) ? { cada, n: Number(n) || 1 } : null };
    };
    el.querySelectorAll("[data-f]").forEach(b => (b.onclick = () => {
      if (!b.dataset.f) return fin({ fecha: null, hora: null, repetir: null });
      fin(leer(b.dataset.f));
    }));
    el.querySelector("[data-ok]").onclick = () => fin(leer());
    el.querySelector("[data-cancelar]").onclick = () => el.cerrar();
  });
}

export function elegirPrioridad(actual = 4) {
  return elegir(`<h3>Prioridad</h3><ul class="opciones">${[1, 2, 3, 4].map(n => `<li><button data-p="${n}" class="${n === actual ? "on" : ""}"><span style="color:${colorPrioridad(n)}">${icono("bandera")}</span><span>Prioridad ${n}</span><small>${PRIORIDADES[n]}</small></button></li>`).join("")}</ul>`,
    (el, fin) => el.querySelectorAll("[data-p]").forEach(b => (b.onclick = () => fin(Number(b.dataset.p)))));
}

export const AVISOS = [[0, "A la hora de la tarea"], [5, "5 min antes"], [10, "10 min antes"], [15, "15 min antes"], [30, "30 min antes"], [60, "1 hora antes"], [1440, "1 día antes"]];
export const textoAviso = r => (r?.length ? AVISOS.find(([m]) => m === r[0])?.[1] || `${r[0]} min antes` : "");
export function elegirAviso(actual = null, { conHora = true } = {}) {
  return elegir(`<h3>Recordatorio</h3>${conHora ? "" : `<p class="suave peque">La tarea no tiene hora: el aviso llegará a las 9:00 del día.</p>`}
    <ul class="opciones">${AVISOS.map(([m, n]) => `<li><button data-m="${m}" class="${actual?.[0] === m ? "on" : ""}"><span>${icono("alarma")}</span><span>${n}</span></button></li>`).join("")}
    <li><button data-m=""><span>${icono("cerrar")}</span><span>Sin recordatorio</span></button></li></ul>`,
    (el, fin) => el.querySelectorAll("[data-m]").forEach(b => (b.onclick = () => fin(b.dataset.m === "" ? [] : [Number(b.dataset.m)]))));
}

export function elegirEtiquetas(actuales = []) {
  const todas = [...new Set(S.tareas.flatMap(t => t.etiquetas || []))].sort();
  return elegir(`<h3>Etiquetas</h3><form><input name="e" value="${esc(actuales.join(" "))}" placeholder="repaso examen (separadas por espacios)"></form>
    ${todas.length ? `<div class="chips">${todas.map(e => `<button type="button" class="chip ${actuales.includes(e) ? "on" : ""}" data-e="${esc(e)}">@${esc(e)}</button>`).join("")}</div>` : ""}
    <div class="botones"><button class="btn primario" data-ok>Listo</button></div>`, (el, fin) => {
    const i = el.querySelector("[name=e]");
    const leer = () => [...new Set(i.value.split(/[\s,]+/).map(s => s.replace(/^@/, "")).filter(Boolean))];
    el.querySelectorAll("[data-e]").forEach(b => (b.onclick = () => {
      const l = leer(), e = b.dataset.e;
      i.value = (l.includes(e) ? l.filter(x => x !== e) : [...l, e]).join(" ");
      b.classList.toggle("on");
    }));
    el.querySelector("form").onsubmit = e => { e.preventDefault(); fin(leer()); };
    el.querySelector("[data-ok]").onclick = () => fin(leer());
    setTimeout(() => i.focus(), 60);
  });
}

/** Proyecto (y sección). Devuelve { proyectoId, seccion } */
export function elegirProyecto(actual = null, seccionActual = null) {
  const filas = [`<li><button data-p="" data-s="" class="${!actual ? "on" : ""}"><span>${icono("bandeja")}</span><span>Bandeja de entrada</span></button></li>`];
  for (const p of S.proyectos.filter(p => !p.archivado || p.id === actual)) {
    filas.push(`<li><button data-p="${esc(p.id)}" data-s="" class="${p.id === actual && !seccionActual ? "on" : ""}"><span style="color:${esc(p.color)}">${icono("almohadilla")}</span><span>${esc(p.nombre)}</span></button></li>`);
    for (const s of seccionesDe(p.id)) filas.push(`<li class="sub"><button data-p="${esc(p.id)}" data-s="${esc(s)}" class="${p.id === actual && s === seccionActual ? "on" : ""}"><span>${icono("seccion")}</span><span>${esc(s)}</span></button></li>`);
  }
  return elegir(`<h3>Mover a…</h3><ul class="opciones">${filas.join("")}</ul>`,
    (el, fin) => el.querySelectorAll("[data-p]").forEach(b => (b.onclick = () => fin({ proyectoId: b.dataset.p || null, seccion: b.dataset.s || null }))));
}

/** Secciones de un proyecto, en orden: las guardadas en el proyecto y las que usan sus tareas */
export function seccionesDe(pid) {
  const p = S.proyectos.find(x => x.id === pid);
  const l = [...(p?.secciones || [])];
  const tareas = S.tareas.filter(t => t.proyectoId === pid && t.seccion && !t.padreId).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  for (const t of tareas) if (!l.includes(t.seccion)) l.push(t.seccion);
  return l;
}

/** Menú de acciones: [{ id, texto, icono, peligro }] → id */
export function menu(acciones, titulo = "") {
  return elegir(`${titulo ? `<h3>${esc(titulo)}</h3>` : ""}<ul class="opciones">${acciones.map(a => `<li><button data-a="${esc(a.id)}" class="${a.peligro ? "peligro" : ""}"><span>${icono(a.icono || "puntos")}</span><span>${esc(a.texto)}</span></button></li>`).join("")}</ul>`,
    (el, fin) => el.querySelectorAll("[data-a]").forEach(b => (b.onclick = () => fin(b.dataset.a))));
}
