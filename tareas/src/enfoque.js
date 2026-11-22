// Vista de Enfoque (Pomodoro y cronómetro) y Estadísticas.
import { S } from "./datos.js";
import { esc } from "./ui.js";
import * as P from "./pomodoro.js";
import { RUIDOS } from "./sonido.js";
import { hoja } from "./ui.js";
import * as D from "./datos.js";
import { proyectoDe, icono, colorPrioridad } from "./lista.js";
import { hijosPorPadre, compararManual, racha, deVista } from "./logica.js";
import { hoyISO, sumarDias, fechaDe, DIAS_CORTOS, diaSemana, minutosTexto, lunesDe } from "./fechas.js";

const R = 108, CIRC = 2 * Math.PI * R;
const diaDe = ts => fechaDe(new Date(ts));

export function enfoque(ui) {
  const e = P.estado(), M = P.metodo();
  const t = e.tareaId && S.tareas.find(x => x.id === e.tareaId);
  const p = t ? proyectoDe(t.proyectoId) : e.proyectoId ? proyectoDe(e.proyectoId) : null;
  const hoy = hoyISO();
  const focosHoy = S.focos.filter(f => diaDe(f.inicio) === hoy).sort((a, b) => b.inicio - a.inicio);
  const minHoy = focosHoy.reduce((s, f) => s + (f.minutos || 0), 0);
  const obj = Number(S.ajustes.objetivo) || 8, unidad = Number(S.ajustes.foco) || 25;
  const hechosHoy = Math.floor(minHoy / unidad);
  const pasos = t ? (hijosPorPadre(S.tareas).get(t.id) || []).slice().sort(compararManual) : [];
  const sigPaso = pasos.find(x => !x.hecha);
  const parado = e.estado === "parado", subiendo = P.subiendo();
  const etiquetaReloj = e.modo !== "foco" ? P.NOMBRES[e.modo] : M.libre ? (e.tipo === "flow" ? "Flowtime · estudiando" : "Cronómetro") : M.sinDescanso ? `Temporizador · ${e.minutos} min` : "Concentración";
  const que = t ? `<span class="punto" style="background:${esc(p?.color || "var(--suave)")}"></span><span><b>${esc(t.titulo)}</b><small>${esc(p?.nombre || "Bandeja")}${t.pomos ? ` · ${t.pomos}${t.pomosEstimados ? "/" + t.pomosEstimados : ""} 🍅` : ""}</small></span>`
    : p || e.etiqueta ? `<span class="punto" style="background:${esc(p?.color || "var(--suave)")}"></span><span><b>${esc(e.etiqueta || "Estudio libre")}</b><small>${esc(p?.nombre || "Sin asignatura")} · sin tarea</small></span>`
    : `<span class="suave">Estudio libre · toca para elegir tarea o asignatura (opcional)</span>`;
  return `<div class="enfoque modo-${e.modo} ${ui.pantallaCompleta ? "completa" : ""}">
    <header class="vista-cab"><div class="tit"><h1>Estudio</h1></div><div class="acc-cab"><button class="icono" data-info-metodos aria-label="Qué es cada método">?</button></div></header>
    <div class="metodos" role="tablist" data-nodeslizar>${Object.entries(P.METODOS).map(([k, m]) => `<button data-tipo="${k}" class="${e.tipo === k ? "on" : ""}" ${parado || e.tipo === k ? "" : "disabled"}><b>${m.nombre}</b><small>${m.corto}</small></button>`).join("")}</div>
    <p class="desc-metodo suave">${esc(M.desc)}</p>
    ${e.tipo === "pomodoro" ? `<button class="ajustar-pomo" data-ajustar-pomo ${parado ? "" : "disabled"}>${esc(resumenPomodoro())} <span>${parado ? "Ajustar" : ""}</span></button>` : ""}
    ${parado && !M.libre && !M.sinDescanso ? `<div class="seg modos">${Object.entries(P.NOMBRES).filter(([k]) => k !== "largo" || M.largo).map(([k, n]) => `<button data-modo="${k}" class="${e.modo === k ? "on" : ""}">${n}</button>`).join("")}</div>` : ""}
    ${parado && e.tipo === "cuenta" ? `<div class="seg minutos">${[15, 30, 45, 60, 90, 120].map(n => `<button data-minutos="${n}" class="${Number(e.minutos) === n ? "on" : ""}">${n < 60 ? n + " min" : n / 60 + " h"}</button>`).join("")}<button data-minutos-otro>Otro</button></div>` : ""}
    <div class="reloj">
      <svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="${R}" class="pista"/><circle cx="120" cy="120" r="${R}" class="avance" data-avance style="stroke-dasharray:${CIRC} ${CIRC};stroke-dashoffset:${CIRC * (1 - Math.max(0, Math.min(1, P.subiendo() ? (P.tiempo() / 60000 % 60) / 60 : 1 - P.tiempo() / P.total())))}"/></svg>
      <div class="centro-reloj"><div class="tiempo" data-tiempo>${P.formato(P.tiempo())}</div><div class="suave" data-estado>${etiquetaReloj}${e.estado === "pausa" ? " · en pausa" : ""}</div>
      ${e.plan ? `<div class="ciclos plan" title="Bloques de la sesión">${Array.from({ length: e.plan }, (_, i) => `<i class="${i < e.hechos ? "on" : i === e.hechos && e.modo === "foco" && !parado ? "en-curso" : ""}"></i>`).join("")}</div><div class="suave peque">${e.hechos >= e.plan ? "Sesión terminada" : `Bloque ${Math.min(e.hechos + (e.modo === "foco" ? 1 : 0), e.plan) || 1} de ${e.plan}`}</div>`
        : M.cada ? `<div class="ciclos">${Array.from({ length: M.cada() }, (_, i) => `<i class="${i < e.ciclos % M.cada() ? "on" : ""}"></i>`).join("")}</div>` : ""}</div>
    </div>
    <div class="controles">
      ${parado ? `<button class="btn primario enorme" data-p="empezar">${icono("play")} ${e.modo !== "foco" ? "Empezar descanso" : e.plan && e.hechos > 0 && e.hechos < e.plan ? `Empezar bloque ${e.hechos + 1}` : "Empezar"}</button>` : ""}
      ${!parado && e.tipo === "flow" && e.modo === "foco" ? `<button class="btn primario enorme" data-p="descansar">Descansar</button>` : ""}
      ${e.estado === "corriendo" && !(e.tipo === "flow" && e.modo === "foco") ? `<button class="btn enorme" data-p="pausar">Pausa</button>` : ""}
      ${e.estado === "pausa" ? `<button class="btn primario enorme" data-p="reanudar">Seguir</button>` : ""}
      ${!parado ? `<button class="btn" data-p="parar">${subiendo ? "Terminar" : "Parar"}</button>` : ""}
      ${e.modo !== "foco" ? `<button class="btn" data-p="saltar">Saltar descanso</button>` : ""}
    </div>

    ${ui.sesion && t && ui.sesion.tareaId === t.id ? (() => {
      const s = ui.sesion, hechos = focosHoy.filter(f => f.tareaId === t.id && f.tipo === "pomodoro").length;
      const queda = s.fin ? Math.round((new Date(s.fin) - Date.now()) / 60000) : null;
      const antes = s.ini && new Date(s.ini) > new Date();
      return `<div class="sesion-foco">${!s.fin ? "Sesión de estudio" : antes ? `Sesión de <b>${s.ini.slice(11)}</b> a <b>${s.fin.slice(11)}</b>` : `Sesión hasta las <b>${s.fin.slice(11)}</b>${queda > 0 ? ` · quedan ${minutosTexto(queda)}` : " · ya ha acabado"}`}${s.pomos && e.tipo === "pomodoro" ? ` · ${hechos} de ${s.pomos} 🍅` : ""}</div>`;
    })() : ""}
    <button class="tarea-foco" data-elegir-tarea>${que}<span class="cambiar">${t || p || e.etiqueta ? "Cambiar" : "Elegir"}</span></button>
    ${sigPaso ? `<div class="sig-paso"><div class="etiqueta">Siguiente paso</div>
      <ul class="pasos foco">${pasos.map(s => `<li class="${s.hecha ? "hecha" : ""} ${s === sigPaso ? "actual" : ""}"><button class="check" data-sub-check="${esc(s.id)}" style="--c:${colorPrioridad(s.prioridad)}"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></button><span>${esc(s.titulo)}</span></li>`).join("")}</ul></div>` : t && pasos.length ? `<p class="suave centrado">✅ Todos los pasos hechos. ¿Marcas la tarea? <button class="enlace" data-acabar-tarea="${esc(t.id)}">Marcar hecha</button></p>` : ""}

    <div class="ambiente">
      <label>🎧 <select data-ruido>${Object.entries(RUIDOS).map(([k, n]) => `<option value="${k}" ${ui.ruido === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <input type="range" min="0" max="1" step="0.05" value="${ui.volumen ?? 0.5}" data-volumen aria-label="Volumen">
      <button class="btn peque" data-completa>${ui.pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}</button>
    </div>

    <section class="resumen-foco">
      <div class="tomates" title="Objetivo diario (en bloques de ${unidad} min)">${Array.from({ length: Math.max(obj, hechosHoy) }, (_, i) => `<i class="${i < hechosHoy ? "on" : ""}"></i>`).join("")}</div>
      <p><b>${minutosTexto(minHoy)}</b> de concentración hoy · objetivo ${minutosTexto(obj * unidad)}</p>
      ${focosHoy.length ? `<ul class="sesiones">${focosHoy.slice(0, 12).map(f => `<li><span>${new Date(f.inicio).toTimeString().slice(0, 5)}</span><span>${esc(f.titulo || proyectoDe(f.proyectoId)?.nombre || "Estudio libre")}${f.metodo && f.metodo !== "pomodoro" ? ` <small class="suave">· ${esc(P.METODOS[f.metodo]?.nombre || "")}</small>` : ""}</span><span>${f.minutos} min</span><button class="icono peque" data-borrar-foco="${esc(f.id)}" aria-label="Borrar sesión">×</button></li>`).join("")}</ul>` : ""}
    </section>
    <p class="suave peque centrado consejo">Consejo: deja el móvil boca abajo y lejos. En los descansos, levántate y no mires el móvil.</p>
  </div>`;
}

/** Actualiza solo el reloj (cada medio segundo) */
export function tic(raiz) {
  const el = raiz.querySelector("[data-tiempo]"); if (!el) return;
  const e = P.estado(), ms = P.tiempo();
  el.textContent = P.formato(ms);
  const av = raiz.querySelector("[data-avance]");
  const frac = P.subiendo() ? (ms / 60000 % 60) / 60 : 1 - ms / P.total();
  av.style.strokeDashoffset = String(CIRC * (1 - Math.max(0, Math.min(1, frac))));
  document.title = e.estado === "corriendo" ? `${P.formato(ms)} · ${e.modo === "foco" ? P.metodo().nombre : P.NOMBRES[e.modo]}` : "Tasca";
}

/** Lista para elegir la tarea del pomodoro */
export function elegirTareaHtml(q = "") {
  const h = hoyISO();
  const base = q ? deVista("buscar", S.tareas, h, { q }).filter(t => !t.hecha) : deVista("hoy", S.tareas, h).concat(deVista("proximos", S.tareas, h, { dias: 7 }).filter(t => t.fecha > h));
  const vistos = new Set();
  const l = base.filter(t => !vistos.has(t.id) && vistos.add(t.id)).slice(0, 40);
  const e = P.estado();
  return `<h2>¿En qué vas a trabajar?</h2>
    <div class="libre-caja"><h3>Sin tarea</h3>
      <input data-etiqueta placeholder="Qué vas a hacer (opcional): repasar apuntes, examen de prueba…" value="${esc(e.etiqueta || "")}">
      <div class="chips">${[`<button type="button" class="chip ${!e.proyectoId ? "on" : ""}" data-libre="">Ninguna asignatura</button>`, ...S.proyectos.filter(p => !p.archivado).map(p => `<button type="button" class="chip ${e.proyectoId === p.id && !e.tareaId ? "on" : ""}" data-libre="${esc(p.id)}"><span class="punto" style="background:${esc(p.color)}"></span>${esc(p.nombre)}</button>`)].join("")}</div>
      <button class="btn primario" data-libre-ok>Estudio libre</button></div>
    <h3>O una tarea</h3><input type="search" data-q placeholder="Buscar tarea…" value="${esc(q)}">
    <ul class="elegir">${l.map(t => { const p = proyectoDe(t.proyectoId); return `<li><button data-tarea="${esc(t.id)}"><span class="punto" style="background:${esc(p?.color || "var(--suave)")}"></span><span>${esc(t.titulo)}<small>${esc([p?.nombre, t.fecha === h ? "Hoy" : t.fecha].filter(Boolean).join(" · "))}</small></span></button></li>`; }).join("") || `<li class="suave">No hay tareas${q ? " con ese nombre" : " para hoy ni esta semana"}.</li>`}
    </ul>`;
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
    <h2 class="grupo">Tiempo por asignatura · 30 días</h2>${filasP ? `<ul class="horiz">${filasP}</ul>` : `<p class="suave">Aún no hay tiempo de estudio. Empieza desde Estudio o con «Estudiar» en cualquier tarea.</p>`}
    <h2 class="grupo">Avance de los proyectos</h2>${avance ? `<ul class="horiz">${avance}</ul>` : `<p class="suave">Sin proyectos todavía.</p>`}`;
}

// ---------------- duración de los bloques del Pomodoro ----------------
const CAMPOS = [["foco", "Concentración", 5, 120, 5, "min"], ["corto", "Descanso", 1, 30, 1, "min"], ["largo", "Descanso largo", 5, 60, 5, "min"], ["cadaLargo", "Descanso largo cada", 2, 8, 1, "bloques"]];
const PRESETS = [["Clásico", 25, 5, 15, 4], ["Corto", 15, 3, 10, 4], ["Medio", 45, 10, 20, 3], ["Largo", 50, 10, 30, 3]];
export const resumenPomodoro = () => { const a = S.ajustes; return `${a.foco || 25} min · descanso ${a.corto || 5} · largo ${a.largo || 15} cada ${a.cadaLargo || 4}`; };
/** Ajustar la longitud de cada bloque. Devuelve true si se guarda (y conEmpezar = pulsó «Empezar»). */
export function configurarPomodoro({ conEmpezar = false } = {}) {
  return new Promise(ok => {
    let hecho = false;
    const v = Object.fromEntries(CAMPOS.map(([k]) => [k, Number(S.ajustes[k]) || { foco: 25, corto: 5, largo: 15, cadaLargo: 4 }[k]]));
    const el = hoja(`<div class="conf-pomo"><h2>Bloques del Pomodoro</h2>
      <div class="chips">${PRESETS.map(([n, f, c, l, k]) => `<button type="button" class="chip" data-preset="${f},${c},${l},${k}">${n} <small>${f}/${c}</small></button>`).join("")}</div>
      ${CAMPOS.map(([k, n, min, max, paso, u]) => `<div class="paso-num"><span>${n}</span><button class="icono" data-menos="${k}" aria-label="Menos">−</button><b data-v="${k}">${v[k]}</b><small>${u}</small><button class="icono" data-mas="${k}" aria-label="Más">+</button></div>`).join("")}
      <p class="suave peque" data-total></p>
      <div class="botones"><button class="btn" data-guardar>Guardar</button>${conEmpezar ? `<button class="btn primario" data-empezar>${icono("play")} Empezar</button>` : ""}</div></div>`, { clase: "peque", alCerrar: () => !hecho && ok(false) });
    const pintar = () => {
      for (const [k] of CAMPOS) el.querySelector(`[data-v="${k}"]`).textContent = v[k];
      const ciclo = v.foco * v.cadaLargo + v.corto * (v.cadaLargo - 1) + v.largo;
      el.querySelector("[data-total]").textContent = `Una vuelta completa (${v.cadaLargo} bloques con sus descansos) dura ${minutosTexto(ciclo)}.`;
      el.querySelectorAll("[data-preset]").forEach(b => b.classList.toggle("on", b.dataset.preset === `${v.foco},${v.corto},${v.largo},${v.cadaLargo}`));
    };
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      const c = CAMPOS.find(([k]) => k === (b.dataset.mas || b.dataset.menos));
      if (c) { const [k, , min, max, paso] = c; v[k] = Math.max(min, Math.min(max, v[k] + (b.dataset.mas ? paso : -paso))); pintar(); return; }
      if (b.dataset.preset) { [v.foco, v.corto, v.largo, v.cadaLargo] = b.dataset.preset.split(",").map(Number); pintar(); return; }
      if (b.dataset.guardar !== undefined || b.dataset.empezar !== undefined) {
        hecho = true; D.guardarAjustes({ ...v }); el.cerrar(); ok(b.dataset.empezar !== undefined ? "empezar" : true);
      }
    });
    pintar();
  });
}
