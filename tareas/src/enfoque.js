// Vista de Enfoque (Pomodoro y cronómetro) y Estadísticas.
import { S } from "./datos.js";
import { esc } from "./ui.js";
import * as P from "./pomodoro.js";
import { RUIDOS } from "./sonido.js";
import { proyectoDe, icono, colorPrioridad } from "./lista.js";
import { hijosPorPadre, compararManual, racha, deVista } from "./logica.js";
import { hoyISO, sumarDias, fechaDe, DIAS_CORTOS, diaSemana, minutosTexto, lunesDe } from "./fechas.js";

const R = 108, CIRC = 2 * Math.PI * R;
const diaDe = ts => fechaDe(new Date(ts));

export function enfoque(ui) {
  const e = P.estado();
  const t = e.tareaId && S.tareas.find(x => x.id === e.tareaId);
  const p = t && proyectoDe(t.proyectoId);
  const hoy = hoyISO();
  const focosHoy = S.focos.filter(f => diaDe(f.inicio) === hoy).sort((a, b) => b.inicio - a.inicio);
  const pomosHoy = focosHoy.filter(f => f.tipo === "pomodoro").length;
  const minHoy = focosHoy.reduce((s, f) => s + (f.minutos || 0), 0);
  const obj = Number(S.ajustes.objetivo) || 8;
  const pasos = t ? (hijosPorPadre(S.tareas).get(t.id) || []).slice().sort(compararManual) : [];
  const sigPaso = pasos.find(x => !x.hecha);
  const parado = e.estado === "parado";
  return `<div class="enfoque modo-${e.modo} ${ui.pantallaCompleta ? "completa" : ""}">
    <header class="vista-cab"><div class="tit"><h1>Enfoque</h1></div>
      <div class="seg" role="tablist">${[["pomodoro", "Pomodoro"], ["crono", "Cronómetro"]].map(([k, n]) => `<button data-tipo="${k}" class="${e.tipo === k ? "on" : ""}" ${parado ? "" : "disabled"}>${n}</button>`).join("")}</div>
    </header>
    ${e.tipo === "pomodoro" ? `<div class="seg modos">${Object.entries(P.NOMBRES).map(([k, n]) => `<button data-modo="${k}" class="${e.modo === k ? "on" : ""}" ${parado ? "" : "disabled"}>${n}</button>`).join("")}</div>` : ""}
    <div class="reloj">
      <svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="${R}" class="pista"/><circle cx="120" cy="120" r="${R}" class="avance" data-avance style="stroke-dasharray:${CIRC} ${CIRC}"/></svg>
      <div class="centro-reloj"><div class="tiempo" data-tiempo>${P.formato(P.tiempo())}</div><div class="suave" data-estado>${e.tipo === "crono" ? "Cronómetro" : P.NOMBRES[e.modo]}${e.estado === "pausa" ? " · en pausa" : ""}</div>
      ${e.tipo === "pomodoro" ? `<div class="ciclos">${Array.from({ length: Number(S.ajustes.cadaLargo) || 4 }, (_, i) => `<i class="${i < e.ciclos % (Number(S.ajustes.cadaLargo) || 4) ? "on" : ""}"></i>`).join("")}</div>` : ""}</div>
    </div>
    <div class="controles">
      ${parado ? `<button class="btn primario enorme" data-p="empezar">${icono("play")} Empezar</button>` : ""}
      ${e.estado === "corriendo" ? `<button class="btn enorme" data-p="pausar">Pausa</button>` : ""}
      ${e.estado === "pausa" ? `<button class="btn primario enorme" data-p="reanudar">Seguir</button>` : ""}
      ${!parado ? `<button class="btn" data-p="parar">${e.tipo === "crono" ? "Terminar" : "Parar"}</button>` : ""}
      ${parado && e.modo !== "foco" ? `<button class="btn" data-p="saltar">Saltar descanso</button>` : ""}
      ${!parado && e.modo !== "foco" ? `<button class="btn" data-p="saltar">Saltar</button>` : ""}
    </div>

    <button class="tarea-foco" data-elegir-tarea>${t ? `<span class="punto" style="background:${esc(p?.color || "var(--suave)")}"></span><span><b>${esc(t.titulo)}</b><small>${esc(p?.nombre || "Bandeja")}${t.pomos ? ` · ${t.pomos}${t.pomosEstimados ? "/" + t.pomosEstimados : ""} 🍅` : ""}</small></span>` : `<span class="suave">¿En qué vas a trabajar? Elige una tarea</span>`}<span class="cambiar">Cambiar</span></button>
    ${sigPaso ? `<div class="sig-paso"><div class="etiqueta">Siguiente paso</div>
      <ul class="pasos foco">${pasos.map(s => `<li class="${s.hecha ? "hecha" : ""} ${s === sigPaso ? "actual" : ""}"><button class="check" data-sub-check="${esc(s.id)}" style="--c:${colorPrioridad(s.prioridad)}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button><span>${esc(s.titulo)}</span></li>`).join("")}</ul></div>` : t && pasos.length ? `<p class="suave centrado">✅ Todos los pasos hechos. ¿Marcas la tarea? <button class="enlace" data-acabar-tarea="${esc(t.id)}">Marcar hecha</button></p>` : ""}

    <div class="ambiente">
      <label>🎧 <select data-ruido>${Object.entries(RUIDOS).map(([k, n]) => `<option value="${k}" ${ui.ruido === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <input type="range" min="0" max="1" step="0.05" value="${ui.volumen ?? 0.5}" data-volumen aria-label="Volumen">
      <button class="btn peque" data-completa>${ui.pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}</button>
    </div>

    <section class="resumen-foco">
      <div class="tomates" title="Objetivo diario">${Array.from({ length: Math.max(obj, pomosHoy) }, (_, i) => `<i class="${i < pomosHoy ? "on" : ""}"></i>`).join("")}</div>
      <p><b>${pomosHoy}</b> de ${obj} pomodoros · <b>${minutosTexto(minHoy)}</b> de concentración hoy</p>
      ${focosHoy.length ? `<ul class="sesiones">${focosHoy.slice(0, 12).map(f => `<li><span>${new Date(f.inicio).toTimeString().slice(0, 5)}</span><span>${esc(f.titulo || "Sin tarea")}</span><span>${f.minutos} min</span><button class="icono peque" data-borrar-foco="${esc(f.id)}" aria-label="Borrar sesión">×</button></li>`).join("")}</ul>` : ""}
    </section>
    <p class="suave peque centrado consejo">Consejo: deja el móvil boca abajo y lejos. ${P.estado().tipo === "pomodoro" ? `Tras ${S.ajustes.cadaLargo || 4} pomodoros toca un descanso largo.` : ""}</p>
  </div>`;
}

/** Actualiza solo el reloj (cada medio segundo) */
export function tic(raiz) {
  const el = raiz.querySelector("[data-tiempo]"); if (!el) return;
  const e = P.estado(), ms = P.tiempo();
  el.textContent = P.formato(ms);
  const av = raiz.querySelector("[data-avance]");
  const frac = e.tipo === "crono" ? (ms / 60000 % 60) / 60 : 1 - ms / P.total();
  av.style.strokeDashoffset = String(CIRC * (1 - Math.max(0, Math.min(1, frac))));
  document.title = e.estado === "corriendo" ? `${P.formato(ms)} · ${e.tipo === "crono" ? "Cronómetro" : P.NOMBRES[e.modo]}` : "Tasca";
}

/** Lista para elegir la tarea del pomodoro */
export function elegirTareaHtml(q = "") {
  const h = hoyISO();
  const base = q ? deVista("buscar", S.tareas, h, { q }).filter(t => !t.hecha) : deVista("hoy", S.tareas, h).concat(deVista("proximos", S.tareas, h, { dias: 7 }).filter(t => t.fecha > h));
  const vistos = new Set();
  const l = base.filter(t => !vistos.has(t.id) && vistos.add(t.id)).slice(0, 40);
  return `<h2>¿En qué vas a trabajar?</h2><input type="search" data-q placeholder="Buscar tarea…" value="${esc(q)}">
    <ul class="elegir">${l.map(t => { const p = proyectoDe(t.proyectoId); return `<li><button data-tarea="${esc(t.id)}"><span class="punto" style="background:${esc(p?.color || "var(--suave)")}"></span><span>${esc(t.titulo)}<small>${esc([p?.nombre, t.fecha === h ? "Hoy" : t.fecha].filter(Boolean).join(" · "))}</small></span></button></li>`; }).join("") || `<li class="suave">No hay tareas${q ? " con ese nombre" : " para hoy ni esta semana"}.</li>`}
    <li><button data-tarea=""><span class="punto"></span><span>Sin tarea</span></button></li></ul>`;
}

// ---------------- estadísticas ----------------
export function estadisticas() {
  const hoy = hoyISO();
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i - 13));
  const minPorDia = new Map(dias.map(d => [d, 0])), hechasPorDia = new Map(dias.map(d => [d, 0]));
  for (const f of S.focos) { const d = diaDe(f.inicio); if (minPorDia.has(d)) minPorDia.set(d, minPorDia.get(d) + (f.minutos || 0)); }
  for (const t of S.tareas) if (t.hecha && t.hechaEn) { const d = diaDe(t.hechaEn); if (hechasPorDia.has(d)) hechasPorDia.set(d, hechasPorDia.get(d) + 1); }
  const activos = [...new Set([...S.focos.map(f => diaDe(f.inicio)), ...S.tareas.filter(t => t.hechaEn).map(t => diaDe(t.hechaEn))])];
  const lunes = lunesDe(hoy);
  const semana = S.focos.filter(f => diaDe(f.inicio) >= lunes);
  const minSemana = semana.reduce((s, f) => s + (f.minutos || 0), 0);
  const minHoy = minPorDia.get(hoy) || 0;
  const hechasSemana = S.tareas.filter(t => t.hecha && t.hechaEn && diaDe(t.hechaEn) >= lunes).length;
  const maxMin = Math.max(60, ...minPorDia.values()), maxH = Math.max(5, ...hechasPorDia.values());
  const barras = (mapa, max, fmt, clase) => `<div class="barras ${clase}">${dias.map(d => { const v = mapa.get(d); return `<div class="b ${d === hoy ? "hoy" : ""}" title="${d}: ${fmt(v)}"><span style="height:${Math.round(100 * v / max)}%"></span><small>${DIAS_CORTOS[diaSemana(d)]}</small></div>`; }).join("")}</div>`;
  // por proyecto (últimos 30 días)
  const desde = sumarDias(hoy, -29), porP = new Map();
  for (const f of S.focos) if (diaDe(f.inicio) >= desde) porP.set(f.proyectoId || "", (porP.get(f.proyectoId || "") || 0) + (f.minutos || 0));
  const totalP = [...porP.values()].reduce((a, b) => a + b, 0) || 1;
  const filasP = [...porP].sort((a, b) => b[1] - a[1]).map(([id, m]) => { const p = proyectoDe(id); return `<li><span class="punto" style="background:${esc(p?.color || "var(--suave)")}"></span><span class="n">${esc(p?.nombre || "Sin proyecto")}</span><span class="bh"><i style="width:${Math.round(100 * m / totalP)}%;background:${esc(p?.color || "var(--suave)")}"></i></span><span>${minutosTexto(m)}</span></li>`; }).join("");
  const avance = S.proyectos.filter(p => !p.archivado).map(p => {
    const ts = S.tareas.filter(t => t.proyectoId === p.id), h = ts.filter(t => t.hecha).length;
    return `<li><span class="punto" style="background:${esc(p.color)}"></span><span class="n">${esc(p.nombre)}</span><span class="bh"><i style="width:${ts.length ? Math.round(100 * h / ts.length) : 0}%;background:${esc(p.color)}"></i></span><span>${ts.length ? Math.round(100 * h / ts.length) : 0}%</span></li>`;
  }).join("");
  return `<header class="vista-cab"><a class="icono atras" href="#/explorar" aria-label="Atrás">${icono("atras")}</a><div class="tit"><h1>Estadísticas</h1><p class="suave">Para saber si vas al ritmo</p></div></header>
    <div class="tarjetas">
      <div class="tarjeta-dato"><b>🔥 ${racha(activos, hoy)}</b><span>días seguidos</span></div>
      <div class="tarjeta-dato"><b>${minutosTexto(minHoy)}</b><span>concentración hoy</span></div>
      <div class="tarjeta-dato"><b>${minutosTexto(minSemana)}</b><span>esta semana</span></div>
      <div class="tarjeta-dato"><b>${hechasSemana}</b><span>tareas y pasos hechos esta semana</span></div>
    </div>
    <h2 class="grupo">Concentración · 14 días</h2>${barras(minPorDia, maxMin, v => minutosTexto(v), "min")}
    <h2 class="grupo">Hechas · 14 días</h2>${barras(hechasPorDia, maxH, v => v + " hechas", "hechas")}
    <h2 class="grupo">Tiempo por asignatura · 30 días</h2>${filasP ? `<ul class="horiz">${filasP}</ul>` : `<p class="suave">Aún no hay pomodoros. Empieza uno desde Enfoque o con ▶ en cualquier tarea.</p>`}
    <h2 class="grupo">Avance de los proyectos</h2>${avance ? `<ul class="horiz">${avance}</ul>` : `<p class="suave">Sin proyectos todavía.</p>`}`;
}
