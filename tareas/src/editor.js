// Añadido rápido y ficha de una tarea (con sus pasos).
import * as D from "./datos.js";
import { S } from "./datos.js";
import { hoja, esc, toast, confirmar, $, vibrar } from "./ui.js";
import { analizar } from "./rapido.js";
import { hoyISO, sumarDias, fechaBonita, esFecha, esHora } from "./fechas.js";
import { PRIORIDADES, textoRepetir, hijosPorPadre, compararManual } from "./logica.js";
import { colorPrioridad, icono, proyectoDe } from "./lista.js";

const opcionesProyecto = sel => `<option value="">📥 Bandeja de entrada</option>` + S.proyectos.filter(p => !p.archivado || p.id === sel).map(p => `<option value="${esc(p.id)}" ${p.id === sel ? "selected" : ""}>${esc(p.nombre)}</option>`).join("");

// ---------------- añadido rápido ----------------
export function anadir(contexto = {}) {
  const hoy = hoyISO();
  const base = { proyectoId: contexto.proyectoId || null, fecha: contexto.fecha ?? null, padreId: contexto.padreId || null, seccion: contexto.seccion || null };
  const el = hoja(`
    <form class="rapido" autocomplete="off">
      <textarea name="t" rows="1" placeholder="Nueva tarea… p. ej. «Problemas 4-6 mañana 18:00 #TC !2»" enterkeyhint="done"></textarea>
      <div class="chips" data-chips></div>
      <div class="rapido-opciones">
        <select name="p" aria-label="Proyecto">${opcionesProyecto(base.proyectoId)}</select>
        <div class="seg" role="group" aria-label="Fecha">
          <button type="button" data-f="${hoy}">Hoy</button>
          <button type="button" data-f="${sumarDias(hoy, 1)}">Mañana</button>
          <button type="button" data-f="">Sin fecha</button>
          <input type="date" name="f" aria-label="Otra fecha">
        </div>
        <div class="seg prio" role="group" aria-label="Prioridad">
          ${[1, 2, 3, 4].map(n => `<button type="button" data-pr="${n}" title="${PRIORIDADES[n]}" style="--c:${colorPrioridad(n)}">!${n}</button>`).join("")}
        </div>
      </div>
      <div class="botones"><span class="suave peque">Intro para añadir · seguir escribiendo para otra</span><button class="btn primario">Añadir</button></div>
    </form>`, { clase: "hoja-rapido" });
  const f = $("form", el), ta = f.t;
  let fecha = base.fecha, prioridad = 4;
  const pintarSeg = () => {
    el.querySelectorAll("[data-f]").forEach(b => b.classList.toggle("on", (b.dataset.f || null) === (fecha || null)));
    f.f.value = fecha && ![hoy, sumarDias(hoy, 1)].includes(fecha) ? fecha : "";
    el.querySelectorAll("[data-pr]").forEach(b => b.classList.toggle("on", Number(b.dataset.pr) === prioridad));
  };
  el.querySelectorAll("[data-f]").forEach(b => (b.onclick = () => { fecha = b.dataset.f || null; pintarSeg(); ta.focus(); }));
  f.f.onchange = () => { fecha = f.f.value || null; pintarSeg(); };
  el.querySelectorAll("[data-pr]").forEach(b => (b.onclick = () => { prioridad = Number(b.dataset.pr); pintarSeg(); ta.focus(); }));
  const vista = () => {
    const r = analizar(ta.value, { hoy, proyectos: S.proyectos });
    const c = [];
    if (r.fecha) c.push(`${icono("cal")}${esc(fechaBonita(r.fecha))}${r.hora ? " " + r.hora : ""}`);
    else if (r.hora) c.push(`${icono("reloj")}${r.hora}`);
    if (r.proyectoId) c.push(`#${esc(proyectoDe(r.proyectoId)?.nombre)}`);
    if (r.prioridad < 4) c.push(`!${r.prioridad}`);
    if (r.repetir) c.push(`${icono("rep")}${esc(textoRepetir(r.repetir))}`);
    r.etiquetas.forEach(e => c.push("@" + esc(e)));
    $("[data-chips]", el).innerHTML = c.map(x => `<span class="chip">${x}</span>`).join("");
    ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px";
    return r;
  };
  ta.oninput = vista;
  ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = e => {
    e.preventDefault();
    const lineas = ta.value.split("\n").map(x => x.trim()).filter(Boolean);
    if (!lineas.length) { el.cerrar(); return; }
    for (const l of lineas) {
      const r = analizar(l, { hoy, proyectos: S.proyectos });
      if (!r.titulo) continue;
      const t = D.nuevaTarea({
        ...base, titulo: r.titulo,
        proyectoId: r.proyectoId || f.p.value || null,
        fecha: r.fecha || fecha, hora: r.hora, prioridad: r.prioridad < 4 ? r.prioridad : prioridad,
        etiquetas: r.etiquetas, repetir: r.repetir,
        recordatorios: r.hora ? [S.ajustes.aviso ?? 10] : null,
      });
      D.guardarTarea(t);
    }
    vibrar();
    toast(lineas.length > 1 ? `${lineas.length} tareas añadidas` : "Tarea añadida");
    ta.value = ""; vista(); ta.focus();
  };
  pintarSeg();
  setTimeout(() => ta.focus(), 60);
}

// ---------------- ficha de la tarea ----------------
const AVISOS = [[0, "A la hora"], [5, "5 min antes"], [10, "10 min antes"], [15, "15 min antes"], [30, "30 min antes"], [60, "1 h antes"], [1440, "1 día antes"]];
const DURACIONES = [15, 25, 30, 45, 60, 90, 120, 180];

export function abrirTarea(id, { alFoco } = {}) {
  let t = S.tareas.find(x => x.id === id);
  if (!t) return;
  const el = hoja(`<div class="ficha" data-ficha></div>`, { clase: "hoja-ficha", alCerrar: () => quitar() });
  const quitar = D.alCambiar(() => { const n = S.tareas.find(x => x.id === id); if (!n) { el.cerrar(); return; } if (n.editado !== t.editado || n.hecha !== t.hecha) { t = n; pintar(); } });
  const guardar = cambios => { Object.assign(t, cambios); D.cambiarTarea(t.id, cambios); };

  function pintar() {
    const activo = document.activeElement;
    const enfocado = activo && el.contains(activo) ? activo.name || activo.dataset?.sub : null;
    const hijos = hijosPorPadre(S.tareas);
    const pasos = (hijos.get(t.id) || []).slice().sort(compararManual);
    const padre = t.padreId && S.tareas.find(x => x.id === t.padreId);
    const p = proyectoDe(t.proyectoId);
    const rep = t.repetir ? `${t.repetir.cada}:${t.repetir.n || 1}` : "";
    $("[data-ficha]", el).innerHTML = `
      ${padre ? `<button class="miga" data-ir="${esc(padre.id)}">← ${esc(padre.titulo)}</button>` : ""}
      <div class="ficha-cab">
        <button class="check grande" data-acc="check" style="--c:${colorPrioridad(t.prioridad)}" aria-label="Marcar"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>
        <textarea name="titulo" rows="1" class="ficha-titulo ${t.hecha ? "tachado" : ""}">${esc(t.titulo)}</textarea>
      </div>
      <textarea name="notas" class="ficha-notas" rows="2" placeholder="Notas, apartados, erratas, enlaces…">${esc(t.notas || "")}</textarea>

      <div class="campos">
        <label>${icono("cal")}<span>Fecha</span><input type="date" name="fecha" value="${esc(t.fecha || "")}"></label>
        <label>${icono("reloj")}<span>Hora</span><input type="time" name="hora" value="${esc(t.hora || "")}"></label>
        <label><span class="sin-ico">⏱</span><span>Duración</span><select name="duracion"><option value="">—</option>${DURACIONES.map(d => `<option value="${d}" ${t.duracion === d ? "selected" : ""}>${d >= 60 ? d / 60 + " h" : d + " min"}</option>`).join("")}${t.duracion && !DURACIONES.includes(t.duracion) ? `<option selected value="${t.duracion}">${t.duracion} min</option>` : ""}</select></label>
        <label>${icono("rep")}<span>Repetir</span><select name="repetir">
          <option value="">No se repite</option>
          ${[["dia:1", "Cada día"], ["laborables:1", "Días laborables"], ["semana:1", "Cada semana"], ["semana:2", "Cada 2 semanas"], ["mes:1", "Cada mes"], ["año:1", "Cada año"]].map(([v, n]) => `<option value="${v}" ${rep === v ? "selected" : ""}>${n}</option>`).join("")}
          ${rep && !["dia:1", "laborables:1", "semana:1", "semana:2", "mes:1", "año:1"].includes(rep) ? `<option selected value="${rep}">${esc(textoRepetir(t.repetir))}</option>` : ""}
        </select></label>
        <label>${icono("campana")}<span>Aviso</span><select name="aviso" ${t.hora || t.fecha ? "" : "disabled"}>
          <option value="">Sin aviso</option>
          ${AVISOS.map(([m, n]) => `<option value="${m}" ${t.recordatorios?.[0] === m ? "selected" : ""}>${n}</option>`).join("")}
        </select></label>
        <label><span class="sin-ico">📁</span><span>Proyecto</span><select name="proyectoId" ${t.padreId ? "disabled" : ""}>${opcionesProyecto(t.proyectoId)}</select></label>
        <label>${icono("tomate")}<span>Pomodoros</span><span class="pomos"><b>${t.pomos || 0}</b> de <input type="number" name="pomosEstimados" min="0" max="40" value="${t.pomosEstimados ?? ""}" placeholder="?"></span></label>
        <label><span class="sin-ico">@</span><span>Etiquetas</span><input name="etiquetas" value="${esc((t.etiquetas || []).join(" "))}" placeholder="ninguna"></label>
      </div>
      ${!t.hora && t.fecha && t.recordatorios?.length ? `<p class="suave peque">Sin hora, el aviso llega a las 9:00.</p>` : ""}

      <div class="seg prio grande" role="group" aria-label="Prioridad">
        ${[1, 2, 3, 4].map(n => `<button type="button" data-pr="${n}" class="${t.prioridad === n ? "on" : ""}" style="--c:${colorPrioridad(n)}">${PRIORIDADES[n]}</button>`).join("")}
      </div>

      <h3>Pasos ${pasos.length ? `<span class="suave">${pasos.filter(x => x.hecha).length}/${pasos.length}</span>` : ""}</h3>
      <ul class="pasos">
        ${pasos.map(s => `<li class="${s.hecha ? "hecha" : ""}">
          <button class="check" data-sub-check="${esc(s.id)}" style="--c:${colorPrioridad(s.prioridad)}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button>
          <input data-sub="${esc(s.id)}" value="${esc(s.titulo)}">
          <button class="icono" data-ir="${esc(s.id)}" aria-label="Abrir el paso">${icono("flecha")}</button>
        </li>`).join("")}
        <li class="nuevo-paso"><span class="mas">+</span><input data-nuevo-paso placeholder="Añadir paso (Intro)"></li>
      </ul>

      <div class="acciones-ficha">
        ${!t.hecha ? `<button class="btn primario" data-acc="foco">${icono("play")} Pomodoro</button>` : ""}
        <button class="btn" data-acc="hoy">Para hoy</button>
        <button class="btn" data-acc="manana">Mañana</button>
        <button class="btn" data-acc="duplicar">Duplicar</button>
        <button class="btn peligro" data-acc="borrar">Borrar</button>
      </div>
      <p class="suave peque">${p ? esc(p.nombre) + (t.seccion ? " › " + esc(t.seccion) : "") + " · " : ""}Creada el ${new Date(t.creado).toLocaleDateString("es-ES")}${t.hechaVeces ? ` · hecha ${t.hechaVeces} ${t.hechaVeces === 1 ? "vez" : "veces"}` : ""}</p>`;
    ajustarAltura();
    if (enfocado) (el.querySelector(`[name="${enfocado}"]`) || el.querySelector(`[data-sub="${enfocado}"]`))?.focus();
  }
  const ajustarAltura = () => el.querySelectorAll("textarea").forEach(x => { x.style.height = "auto"; x.style.height = x.scrollHeight + "px"; });

  el.addEventListener("input", e => { if (e.target.tagName === "TEXTAREA") ajustarAltura(); });
  el.addEventListener("change", e => {
    const x = e.target, n = x.name;
    if (x.dataset.sub) { const v = x.value.trim(); v ? D.cambiarTarea(x.dataset.sub, { titulo: v }) : D.borrarTarea(x.dataset.sub); return; }
    if (!n) return;
    if (n === "titulo") { const v = x.value.trim(); if (v) guardar({ titulo: v }); }
    else if (n === "notas") guardar({ notas: x.value });
    else if (n === "fecha") {
      const f = esFecha(x.value) ? x.value : null;
      const c = { fecha: f }; if (!f) { c.hora = null; c.repetir = null; }
      guardar(c); pintar();
    } else if (n === "hora") {
      const h = esHora(x.value) ? x.value : null;
      const c = { hora: h };
      if (h && !t.fecha) c.fecha = hoyISO();
      if (h && !t.recordatorios?.length) c.recordatorios = [S.ajustes.aviso ?? 10];
      guardar(c); pintar();
    } else if (n === "duracion") guardar({ duracion: Number(x.value) || null });
    else if (n === "repetir") { const [cada, k] = x.value.split(":"); guardar({ repetir: x.value ? { cada, n: Number(k) || 1 } : null, ...(x.value && !t.fecha ? { fecha: hoyISO() } : {}) }); pintar(); }
    else if (n === "aviso") guardar({ recordatorios: x.value === "" ? null : [Number(x.value)] });
    else if (n === "proyectoId") {
      const pid = x.value || null;
      guardar({ proyectoId: pid, seccion: null });
      // los pasos van con su tarea
      const hijos = hijosPorPadre(S.tareas);
      const pila = [...(hijos.get(t.id) || [])];
      while (pila.length) { const h = pila.shift(); D.cambiarTarea(h.id, { proyectoId: pid }); pila.push(...(hijos.get(h.id) || [])); }
    } else if (n === "pomosEstimados") guardar({ pomosEstimados: Number(x.value) || null });
    else if (n === "etiquetas") guardar({ etiquetas: x.value.split(/[\s,]+/).map(s => s.replace(/^@/, "")).filter(Boolean) });
  });
  el.addEventListener("keydown", e => {
    if (e.target.dataset.nuevoPaso !== undefined && e.key === "Enter") {
      e.preventDefault();
      const v = e.target.value.trim(); if (!v) return;
      D.guardarTarea(D.nuevaTarea({ titulo: v, padreId: t.id, proyectoId: t.proyectoId, fecha: t.fecha }));
      e.target.value = "";
      setTimeout(() => el.querySelector("[data-nuevo-paso]")?.focus(), 50);
    }
    if (e.target.name === "titulo" && e.key === "Enter") { e.preventDefault(); e.target.blur(); }
  });
  el.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.pr) { guardar({ prioridad: Number(b.dataset.pr) }); pintar(); return; }
    if (b.dataset.ir) { el.cerrar(); abrirTarea(b.dataset.ir, { alFoco }); return; }
    if (b.dataset.subCheck) { const s = S.tareas.find(x => x.id === b.dataset.subCheck); if (s) { vibrar(); D.alternar(s); } return; }
    switch (b.dataset.acc) {
      case "check": { vibrar(); const r = await D.alternar(t); toast(r.texto, { accion: "Deshacer", alPulsar: r.deshacer }); break; }
      case "hoy": guardar({ fecha: hoyISO() }); pintar(); break;
      case "manana": guardar({ fecha: sumarDias(hoyISO(), 1) }); pintar(); break;
      case "foco": el.cerrar(); alFoco?.(t.id); break;
      case "duplicar": {
        const hijos = hijosPorPadre(S.tareas);
        const copiar = (orig, padreId) => {
          const c = D.nuevaTarea({ ...orig, id: undefined, padreId, hecha: false, hechaEn: null, pomos: 0, creado: Date.now(), titulo: padreId === orig.padreId && orig.id === t.id ? orig.titulo + " (copia)" : orig.titulo });
          c.id = D.nuevoId(); D.guardarTarea(c);
          for (const h of hijos.get(orig.id) || []) copiar(h, c.id);
        };
        copiar(t, t.padreId || null);
        toast("Duplicada"); break;
      }
      case "borrar": {
        const n = (hijosPorPadre(S.tareas).get(t.id) || []).length;
        if (await confirmar(`¿Borrar «${t.titulo}»${n ? " y sus pasos" : ""}?`, { si: "Borrar", peligro: true })) { el.cerrar(); await D.borrarTarea(t.id); toast("Borrada"); }
        break;
      }
    }
  });
  pintar();
}
