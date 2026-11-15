// Asistente de configuración: corto, con todo rellenado por defecto. Se puede volver a abrir desde ⚙️.
import { esc } from "./dia.js?v=202611150744";
import { hhmm } from "../tiempo.js?v=202611150744";
import { completarPerfil } from "../perfil.js?v=202611150744";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const aMin = v => { if (!v) return null; const [h, m] = String(v).split(":").map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const hora = m => (m == null ? "" : hhmm(m));
const slug = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sitio";

/**
 * @param {HTMLElement} cont
 * @param {object|null} perfilActual
 * @param {{probarCalendario(url): Promise<string>, guardar(perfil): Promise<void>, cancelar?(): void}} on
 */
export function pintarConfiguracion(cont, perfilActual, on) {
  const p = completarPerfil(structuredClone(perfilActual || {}));
  let paso = 0;
  const PASOS = [pasoCalendarios, pasoSitios, pasoHorarios, pasoObjetivos];

  function pintar() {
    cont.innerHTML = `<h1>${perfilActual ? "Ajustes" : "Vamos a configurarlo"}</h1>
      <p class="progreso">Paso ${paso + 1} de ${PASOS.length}. Todo viene rellenado; cambia solo lo que no te cuadre.</p>
      <div class="paso-config">${PASOS[paso].html()}</div>
      <div class="navegacion">
        <button class="btn" data-nav="atras" ${paso === 0 && !perfilActual ? 'style="visibility:hidden"' : ""}>${paso === 0 ? "Cancelar" : "Atrás"}</button>
        <button class="btn primario" data-nav="siguiente">${paso === PASOS.length - 1 ? "Guardar" : "Siguiente"}</button>
      </div><p class="error" id="cfgError"></p>`;
    PASOS[paso].enlazar?.();
    cont.querySelector("[data-nav=atras]").onclick = () => {
      if (paso === 0) { if (perfilActual) on.cancelar?.(); return; }
      PASOS[paso].leer(); paso--; pintar();
    };
    cont.querySelector("[data-nav=siguiente]").onclick = async () => {
      try { PASOS[paso].leer(); } catch (e) { cont.querySelector("#cfgError").textContent = e.message; return; }
      if (paso < PASOS.length - 1) { paso++; pintar(); window.scrollTo(0, 0); return; }
      await on.guardar(p);
    };
  }
  const $ = s => cont.querySelector(s);
  const $$ = s => [...cont.querySelectorAll(s)];

  function pasoCalendarios() {}
  pasoCalendarios.html = () => `<h2>Tus calendarios</h2>
    <p>La app solo los <b>lee</b>; nunca escribe en ellos.</p>
    ${campoCal("google", "Google Calendar (clases y eventos)", `<ol><li>En el ordenador, abre <b>calendar.google.com</b> → ⚙️ <b>Configuración</b>.</li><li>A la izquierda, toca tu calendario → <b>Integrar el calendario</b>.</li><li>Copia la <b>Dirección secreta en formato iCal</b> y pégala aquí.</li></ol>`)}
    ${campoCal("google2", "Otro Google Calendar (si usas otra cuenta)", `Si tienes citas o turnos en otra cuenta de Google, saca su <b>Dirección secreta en formato iCal</b> igual que la del primero (con esa cuenta abierta) y pégala aquí. Si no, déjalo vacío.`)}
    ${campoCal("examenes", "Calendario de exámenes (si tienes otro enlace)", `Pega el enlace que tengas (empieza por <code>https://</code> o <code>webcal://</code>). Si los exámenes ya están en Google Calendar, déjalo vacío.`)}
    ${campoCal("moodle", "Moodle de la UdG (entregas)", `<ol><li>En el Moodle, abre <b>Calendari</b>.</li><li>Pulsa <b>Exporta el calendari</b> (o <b>Importa o exporta calendaris</b> → <b>Exporta</b>).</li><li>Elige <b>Tots els cursos</b> y <b>Esdeveniments recents i propers</b>, pulsa <b>Obtén l'URL del calendari</b> y pégala aquí.</li></ol>`)}`;
  function campoCal(id, titulo, ayuda) {
    return `<div class="campo"><span>${titulo}</span><div class="fila"><input id="cal-${id}" value="${esc(p.calendarios[id])}" placeholder="https://…">
      <button class="btn peque estrecho" data-probar="${id}">Probar</button></div><div class="detalle" id="res-${id}"></div>
      <details class="ayuda"><summary>¿Dónde lo encuentro?</summary>${ayuda}</details></div>`;
  }
  pasoCalendarios.enlazar = () => $$("[data-probar]").forEach(b => b.onclick = async () => {
    const id = b.dataset.probar, url = $(`#cal-${id}`).value.trim(), res = $(`#res-${id}`);
    if (!url) { res.textContent = "Pega primero el enlace."; return; }
    res.textContent = "Probando…";
    try { res.innerHTML = `<span class="ok">✓ ${esc(await on.probarCalendario(url))}</span>`; } catch (e) { res.textContent = "✗ " + e.message; }
  });
  pasoCalendarios.leer = () => { for (const id of ["google", "google2", "examenes", "moodle"]) p.calendarios[id] = $(`#cal-${id}`).value.trim(); };

  function pasoSitios() {}
  pasoSitios.html = () => `<h2>Tus sitios y lo que tardas desde casa</h2>
    <p class="suave">Minutos de casa a cada sitio. Si la UdG son varios campus, añade cada uno.</p>
    <div id="sitios">${p.sitios.filter(s => s.id !== p.casaId).map(filaSitio).join("")}</div>
    <button class="btn peque" id="masSitio">+ Añadir sitio</button>
    <h2>Asignaturas</h2>
    <p class="suave">Una por línea, tal como salen en el calendario. Sirve para saber en qué campus es cada clase.</p>
    <textarea id="asignaturas" rows="5" placeholder="Teoria de Circuits&#10;Imatge Mèdica">${esc(p.asignaturas.map(a => a.nombre).join("\n"))}</textarea>
    <div class="campo"><span>Campus por defecto de las clases</span><select id="campus">${p.sitios.filter(s => s.id !== p.casaId).map(s => `<option value="${esc(s.id)}" ${s.id === (p.campusDefecto || "udg") ? "selected" : ""}>${esc(s.nombre)}</option>`).join("")}</select></div>`;
  const filaSitio = s => `<div class="fila campo" data-sitio="${esc(s.id)}"><input class="nombre" value="${esc(s.nombre)}"><input class="estrecho min" type="number" min="0" max="180" value="${p.trayectos[`${p.casaId}|${s.id}`] ?? ""}" placeholder="min"></div>`;
  pasoSitios.enlazar = () => { $("#masSitio").onclick = () => $("#sitios").insertAdjacentHTML("beforeend", filaSitio({ id: "", nombre: "" })); };
  pasoSitios.leer = () => {
    const sitios = [p.sitios.find(s => s.id === p.casaId)];
    const trayectos = Object.fromEntries(Object.entries(p.trayectos).filter(([k]) => !k.startsWith(`${p.casaId}|`)));
    for (const fila of $$("[data-sitio]")) {
      const nombre = fila.querySelector(".nombre").value.trim();
      if (!nombre) continue;
      let id = fila.dataset.sitio || slug(nombre);
      while (!fila.dataset.sitio && sitios.some(s => s.id === id)) id += "-2";
      sitios.push({ id, nombre });
      const min = fila.querySelector(".min").value;
      if (min !== "") trayectos[`${p.casaId}|${id}`] = +min;
    }
    p.sitios = sitios; p.trayectos = trayectos;
    const campus = $("#campus").value;
    p.campusDefecto = campus;
    p.asignaturas = $("#asignaturas").value.split("\n").map(s => s.trim()).filter(Boolean).map(nombre => ({ nombre, sitioId: campus }));
  };

  function pasoHorarios() {}
  pasoHorarios.html = () => `<h2>Trabajo (GEiEG)</h2>
    <p class="suave">Si tus turnos ya están en Google Calendar (eventos llamados «Feina», «Treball» o «Trabajo»), deja todo vacío: la app los lee de ahí. Si tienes horario fijo, ponlo aquí. El trabajo nunca se mueve.</p>
    ${DIAS.map((d, i) => { const t = p.trabajo.find(x => x.diaSemana === i); return `<div class="fila campo"><span>${d}</span><input type="time" data-tini="${i}" value="${hora(t?.inicio)}"><input type="time" data-tfin="${i}" value="${hora(t?.fin)}"></div>`; }).join("")}
    <h2>Sueño</h2>
    <div class="fila"><label class="campo"><span>Te acuestas a las</span><input type="time" id="dormir" value="${hora(p.horaDormir % 1440)}"></label>
      <label class="campo"><span>Horas que quieres dormir</span><input type="number" id="horas" min="4" max="12" step="0.5" value="${p.horasSueno}"></label></div>
    <div class="fila"><label class="campo"><span>Mínimo antes de saltarte una clase (h)</span><input type="number" id="minimo" min="2" max="8" step="0.5" value="${p.minSleepHours}"></label>
      <label class="campo"><span>Si no hay nada pronto, te levantas a las</span><input type="time" id="levantarse" value="${hora(p.levantarseDefecto)}"></label></div>
    <h2>Rutina de la mañana</h2>
    ${p.rutinaManana.map((r, i) => `<div class="fila campo"><input data-rtit="${i}" value="${esc(r.titulo)}"><input class="estrecho" type="number" data-rmin="${i}" value="${r.minutos}"></div>`).join("")}
    <h2>Comidas y descanso</h2>
    ${p.comidas.map((c, i) => `<div class="fila campo"><span>${esc(c.titulo)}</span><input type="time" data-chora="${i}" value="${hora(c.hora)}"><input class="estrecho" type="number" data-cmin="${i}" value="${c.minutos}"></div>`).join("")}
    <div class="fila"><label class="campo"><span>Descanso al día (min)</span><input type="number" id="descanso" min="0" max="300" value="${p.descansoMinDia}"></label>
      <label class="campo"><span>Margen entre cosas (min)</span><input type="number" id="margen" min="0" max="30" value="${p.margen}"></label></div>`;
  pasoHorarios.leer = () => {
    p.trabajo = DIAS.map((_, i) => ({ diaSemana: i, inicio: aMin($(`[data-tini="${i}"]`).value), fin: aMin($(`[data-tfin="${i}"]`).value) }))
      .filter(t => t.inicio != null && t.fin != null);
    if (p.trabajo.some(t => t.fin <= t.inicio)) throw new Error("Revisa el horario del trabajo: la salida va antes que la entrada.");
    const dormir = aMin($("#dormir").value) ?? 23 * 60 + 30;
    p.horaDormir = dormir < 12 * 60 ? dormir + 1440 : dormir;
    p.horasSueno = +$("#horas").value || 8;
    p.minSleepHours = +$("#minimo").value || 4;
    p.levantarseDefecto = aMin($("#levantarse").value) ?? 8 * 60;
    p.rutinaManana = p.rutinaManana.map((r, i) => ({ titulo: $(`[data-rtit="${i}"]`).value.trim() || r.titulo, minutos: +$(`[data-rmin="${i}"]`).value || 0 })).filter(r => r.minutos > 0);
    p.comidas = p.comidas.map((c, i) => ({ ...c, hora: aMin($(`[data-chora="${i}"]`).value) ?? c.hora, minutos: +$(`[data-cmin="${i}"]`).value || c.minutos }));
    p.descansoMinDia = +$("#descanso").value || 0;
    p.margen = +$("#margen").value || 0;
  };

  function pasoObjetivos() {}
  const entreno = () => p.eventosManuales.find(e => e.id === "balonmano");
  pasoObjetivos.html = () => `<h2>Estudio</h2>
    <label class="campo"><span>Horas de estudio para examen cada día (se reparten entre tus asignaturas; las que tienen examen antes, primero)</span>
      <input type="number" id="horasEstudio" min="0" max="10" step="0.5" value="${(p.estudio?.minutosDia ?? 180) / 60}"></label>
    <h2>Objetivos de la semana</h2>
    <p class="suave">Van por detrás del estudio y los entrenos: si no caben, pasan a otro día.</p>
    ${p.objetivos.map((o, i) => `<div class="campo"><span>${esc(o.titulo)}</span><div class="fila"><label>Veces/semana<input type="number" data-overes="${i}" min="0" max="7" value="${o.vecesSemana}"></label><label>Minutos<input type="number" data-omin="${i}" min="10" max="300" value="${o.minutos}"></label></div>
      ${o.tipo === "gym" ? `<details class="ayuda" ${o.horario?.length ? "open" : ""}><summary>Horario de apertura (vacío = siempre abierto; día vacío = cerrado)</summary>
        ${DIAS.map((d, j) => { const t = o.horario?.find(x => x.diaSemana === j); return `<div class="fila campo"><span>${d}</span><input type="time" data-hini="${i}-${j}" value="${hora(t?.inicio)}"><input type="time" data-hfin="${i}-${j}" value="${hora(t?.fin)}"></div>`; }).join("")}
      </details>` : ""}</div>`).join("")}
    <h2>Entrenos de balonmano</h2>
    <label class="fila"><input type="checkbox" id="hayEntreno" style="width:auto" ${entreno() ? "checked" : ""}> <span>Voy a entrenar con el equipo</span></label>
    <div id="entrenoDatos" ${entreno() ? "" : "hidden"}>
      <div class="fila campo">${DIAS.map((d, i) => `<label style="flex:0"><input type="checkbox" style="width:auto" data-edia="${i}" ${entreno()?.repetir?.diasSemana.includes(i) ? "checked" : ""}> ${d.slice(0, 2)}</label>`).join("")}</div>
      <div class="fila"><label class="campo"><span>De</span><input type="time" id="eIni" value="${hora(entreno()?.inicio ?? 20 * 60)}"></label><label class="campo"><span>a</span><input type="time" id="eFin" value="${hora(entreno()?.fin ?? 21 * 60 + 30)}"></label></div>
    </div>
    <p class="ayuda">Los partidos de fútbol de la uni y cualquier otra cosa se apuntan diciéndoselo a la app («el jueves a las 18 tengo partido»). Los PDFs de las asignaturas llegarán en la siguiente fase.</p>`;
  pasoObjetivos.enlazar = () => { $("#hayEntreno").onchange = e => { $("#entrenoDatos").hidden = !e.target.checked; }; };
  pasoObjetivos.leer = () => {
    p.estudio = { ...(p.estudio || {}), minutosDia: Math.round((+$("#horasEstudio").value || 0) * 60) };
    p.objetivos = p.objetivos.map((o, i) => {
      const n = { ...o, vecesSemana: +$(`[data-overes="${i}"]`).value || 0, minutos: +$(`[data-omin="${i}"]`).value || o.minutos };
      if (o.tipo === "gym") {
        n.horario = DIAS.map((_, j) => ({ diaSemana: j, inicio: aMin($(`[data-hini="${i}-${j}"]`).value), fin: aMin($(`[data-hfin="${i}-${j}"]`).value) }))
          .filter(t => t.inicio != null && t.fin != null && t.fin > t.inicio);
      }
      return n;
    });
    p.eventosManuales = p.eventosManuales.filter(e => e.id !== "balonmano");
    if ($("#hayEntreno").checked) {
      const dias = DIAS.map((_, i) => i).filter(i => $(`[data-edia="${i}"]`).checked);
      if (!dias.length) throw new Error("Marca qué días entrenas.");
      const hoy = new Date().toISOString().slice(0, 10);
      p.eventosManuales.push({ id: "balonmano", titulo: "Entreno de balonmano", tipo: "entreno", fecha: hoy, inicio: aMin($("#eIni").value), fin: aMin($("#eFin").value), repetir: { diasSemana: dias } });
    }
  };

  pintar();
}
