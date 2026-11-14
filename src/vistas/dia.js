// Vista del día: «Ahora toca», hora de levantarse, avisos, propuestas y la línea del día.
import { hhmm } from "../tiempo.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = f => { const d = new Date(f + "T12:00:00Z"); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
const FIJOS = new Set(["clase", "practica", "examen", "entreno", "partido", "otro"]);
const OBJETIVOS = new Set(["gym", "flexible"]);
const dur = b => { const m = b.fin - b.inicio; return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}` : `${m} min`; };

/**
 * @param {HTMLElement} cont
 * @param {{plan, esHoy: boolean, ahora: number, tareas: object[], perfil: object, hechosHoy: object, nativo: boolean}} d
 * @param {{paso(id, hecho), objetivo(id, hecho), propuesta(p, acepta), menuBloque(b), alarma()}} on
 */
export function pintarDia(cont, d, on) {
  const { plan, esHoy, ahora, tareas, perfil } = d;
  const tareaDe = id => tareas.find(t => t.id === id);
  const pasoDe = id => tareas.flatMap(t => t.pasos).find(p => p.id === id);
  const nombre = id => plan.bloques.find(b => b.refId === id)?.titulo || tareaDe(id)?.titulo || perfil.objetivos?.find(o => o.id === id)?.titulo || id;
  const html = [];

  html.push(`<h1>${esHoy ? "Hoy" : "Mañana"}, ${esc(fechaLarga(plan.fecha))}</h1>`);

  if (esHoy) {
    const utiles = plan.bloques.filter(b => b.tipo !== "trayecto" || b.fin > ahora);
    const actual = utiles.find(b => b.inicio <= ahora && ahora < b.fin) || utiles.find(b => b.inicio > ahora);
    if (actual) {
      const empezado = actual.inicio <= ahora;
      const primerPaso = (actual.pasoIds || []).map(pasoDe).find(p => p && !p.hecho);
      html.push(`<div class="ahora"><div class="etiqueta">${empezado ? "Ahora toca" : `A las ${hhmm(actual.inicio)}`}</div>
        <div class="titulo">${esc(actual.titulo)}</div><div>Hasta las ${hhmm(actual.fin)}</div>
        ${primerPaso ? `<div class="paso">Empieza por: <b>${esc(primerPaso.titulo)}</b></div>` : ""}</div>`);
    } else {
      html.push(`<div class="ahora"><div class="titulo">Nada más por hoy</div><div>A descansar.</div></div>`);
    }
  } else {
    html.push(`<div class="levantarse"><div>Levántate a las<br><b>${hhmm(plan.horaLevantarse)}</b></div>
      ${d.nativo ? `<button class="btn primario" data-accion="alarma">Poner alarma</button>` : ""}</div>`);
  }

  for (const a of plan.avisos) html.push(`<div class="aviso">⚠️ ${esc(a.texto)}</div>`);
  plan.propuestas.forEach((p, i) => {
    const texto = p.tipo === "saltar-clase"
      ? `Dormirías muy poco. ¿Te saltas <b>${esc(nombre(p.refId))}</b>? Luego te apunto qué recuperar.`
      : `La entrega no cabe. ¿No vas a <b>${esc(nombre(p.refId))}</b> y usas ese tiempo?`;
    html.push(`<div class="propuesta">${texto}<div class="botones">
      <button class="btn peque primario" data-propuesta="${i}" data-acepta="1">Sí</button>
      <button class="btn peque" data-propuesta="${i}" data-acepta="0">No, voy</button></div></div>`);
  });

  html.push(`<ul class="linea">`);
  plan.bloques.forEach((b, i) => {
    const clases = [`bloque`, `t-${b.tipo}`];
    if (esHoy && b.inicio <= ahora && ahora < b.fin) clases.push("actual");
    if (esHoy && b.fin <= ahora) clases.push("pasado");
    let detalle = "";
    if (b.pasoIds?.length) {
      const t = tareaDe(b.refId);
      const limite = t?.fechaLimite ? `<div class="detalle">Para el ${esc(fechaLarga(t.fechaLimite))}</div>` : "";
      detalle = limite + `<ul class="pasos">${b.pasoIds.map(id => {
        const p = pasoDe(id);
        return p ? `<li><label><input type="checkbox" data-paso="${esc(id)}" ${p.hecho ? "checked" : ""}><span class="${p.hecho ? "hecho" : ""}">${esc(p.titulo)} <small class="suave">${p.minutos} min</small></span></label></li>` : "";
      }).join("")}</ul>`;
    } else if (OBJETIVOS.has(b.tipo)) {
      const hecho = !!d.hechosHoy?.[b.refId];
      detalle = `<ul class="pasos"><li><label><input type="checkbox" data-objetivo="${esc(b.refId)}" ${hecho ? "checked" : ""}><span class="${hecho ? "hecho" : ""}">Hecho</span></label></li></ul>`;
    }
    const menu = FIJOS.has(b.tipo) ? `<button class="menu" data-menu="${i}" aria-label="Opciones">⋯</button>` : "<span></span>";
    html.push(`<li class="${clases.join(" ")}"><div class="hora">${hhmm(b.inicio)}${b.tipo !== "trayecto" && b.tipo !== "rutina" ? `<small>${dur(b)}</small>` : ""}</div>
      <div><div class="titulo">${esc(b.titulo)}</div>${detalle}</div>${menu}</li>`);
  });
  html.push(`</ul>`);

  if (d.pasosHechos?.length) {
    html.push(`<h2>Hecho ${esHoy ? "hoy" : "este día"}</h2><ul class="pasos">${d.pasosHechos.map(id => {
      const p = pasoDe(id);
      return p ? `<li><label><input type="checkbox" data-paso="${esc(id)}" checked><span class="hecho">${esc(p.titulo)}</span></label></li>` : "";
    }).join("")}</ul>`);
  }

  if (plan.sinColocar.length) {
    html.push(`<h2>No cabe ${esHoy ? "hoy" : "mañana"}</h2>`);
    for (const s of plan.sinColocar) html.push(`<p class="sinColocar">${esc(nombre(s.refId))}: ${s.minutos} min → pasa a otro día</p>`);
  }

  cont.innerHTML = html.join("");
  cont.querySelectorAll("[data-paso]").forEach(el => el.onchange = () => on.paso(el.dataset.paso, el.checked));
  cont.querySelectorAll("[data-objetivo]").forEach(el => el.onchange = () => on.objetivo(el.dataset.objetivo, el.checked));
  cont.querySelectorAll("[data-propuesta]").forEach(el => el.onclick = () => on.propuesta(plan.propuestas[+el.dataset.propuesta], el.dataset.acepta === "1"));
  cont.querySelectorAll("[data-menu]").forEach(el => el.onclick = () => on.menuBloque(plan.bloques[+el.dataset.menu]));
  cont.querySelector("[data-accion=alarma]")?.addEventListener("click", () => on.alarma());
}
