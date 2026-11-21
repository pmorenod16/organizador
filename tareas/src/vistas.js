// Vistas de listas (Hoy, Próximos, Bandeja, Proyecto, Buscar, Hechas) y Calendario.
import { S } from "./datos.js";
import { esc } from "./ui.js";
import { filas, vacio, proyectoDe, icono } from "./lista.js";
import { deVista, agruparPorDia, hijosPorPadre, siguienteTarea, compararManual, comparar } from "./logica.js";
import { hoyISO, sumarDias, fechaLarga, fechaBonita, DIAS_CORTOS, MESES, lunesDe, diaSemana, aDate } from "./fechas.js";

const cab = (titulo, sub = "", extra = "") => `<header class="vista-cab"><div><h1>${titulo}</h1>${sub ? `<p class="suave">${sub}</p>` : ""}</div>${extra}</header>`;
const horaAhora = () => new Date().toTimeString().slice(0, 5);

export function hoy() {
  const h = hoyISO();
  const l = deVista("hoy", S.tareas, h);
  const tarde = l.filter(t => t.fecha < h), deHoy = l.filter(t => t.fecha === h);
  const hechasHoy = S.tareas.filter(t => t.hecha && t.hechaEn && new Date(t.hechaEn).toDateString() === new Date().toDateString() && !t.padreId).length;
  const sig = siguienteTarea(S.tareas, h, horaAhora());
  const pomosHoy = S.focos.filter(f => new Date(f.inicio).toDateString() === new Date().toDateString() && f.tipo === "pomodoro").length;
  const total = deHoy.length + hechasHoy;
  return cab("Hoy", esc(fechaLarga(h)).replace(/^./, c => c.toUpperCase()), `<div class="anillo-hoy" title="Tareas de hoy hechas"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="fondo-anillo"/><circle cx="18" cy="18" r="15" class="valor-anillo" style="stroke-dasharray:${total ? (94.2 * hechasHoy / total).toFixed(1) : 0} 94.2"/></svg><span>${hechasHoy}/${total}</span></div>`) +
    (sig ? `<section class="ahora">
      <div class="etiqueta">Ahora toca</div>
      <div class="ahora-fila"><div><div class="titulo">${esc(sig.titulo)}</div><div class="suave-claro">${esc([proyectoDe(sig.proyectoId)?.nombre, sig.hora].filter(Boolean).join(" · "))}</div></div>
      <button class="btn claro" data-foco="${esc(sig.id)}">${icono("play")} Empezar</button></div>
      <div class="ahora-pie">${icono("tomate")} ${pomosHoy}/${S.ajustes.objetivo || 8} pomodoros hoy</div>
    </section>` : "") +
    (tarde.length ? `<h2 class="grupo tarde-t">Atrasadas <span>${tarde.length}</span><button class="enlace" data-reprogramar="hoy">Pasar a hoy</button></h2><ul class="lista">${filas(tarde)}</ul>` : "") +
    (deHoy.length ? `<h2 class="grupo">Hoy <span>${deHoy.length}</span></h2><ul class="lista">${filas(deHoy, { fecha: false })}</ul>` : "") +
    (!l.length ? vacio(hechasHoy ? "¡Todo hecho por hoy!" : "Nada para hoy", hechasHoy ? "Buen trabajo. Descansa o adelanta algo de Próximos." : "Añade una tarea con el botón +.") : "");
}

export function proximos() {
  const h = hoyISO();
  const grupos = agruparPorDia(deVista("proximos", S.tareas, h, { dias: 14 }), h);
  // franja de 14 días para saltar
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(h, i));
  const cuenta = new Map(grupos.map(g => [g.fecha, g.tareas.length]));
  return cab("Próximos", "Las dos próximas semanas") +
    `<div class="franja">${dias.map(d => `<a href="#d-${d}" class="${d === h ? "hoy" : ""}"><small>${DIAS_CORTOS[diaSemana(d)]}</small><b>${Number(d.slice(8))}</b>${cuenta.get(d) ? `<i>${cuenta.get(d)}</i>` : "<i></i>"}</a>`).join("")}</div>` +
    (grupos.length ? grupos.map(g => `<h2 class="grupo ${g.fecha === "vencidas" ? "tarde-t" : ""}" id="d-${g.fecha}">${g.fecha === "vencidas" ? "Atrasadas" : esc(fechaBonita(g.fecha, h)) + ` <small class="suave">${esc(fechaLarga(g.fecha))}</small>`} <span>${g.tareas.length}</span><button class="enlace" data-anadir-fecha="${g.fecha === "vencidas" ? h : g.fecha}">+</button></h2><ul class="lista">${filas(g.tareas, { fecha: g.fecha === "vencidas" })}</ul>`).join("") : vacio("Nada en dos semanas", "Disfruta… o planifica algo."));
}

export function bandeja() {
  const l = deVista("bandeja", S.tareas, hoyISO());
  return cab("Bandeja de entrada", "Lo que aún no tiene proyecto") + (l.length ? `<ul class="lista">${filas(l, { proyecto: false })}</ul>` : vacio("Bandeja vacía", "Lo que añadas sin proyecto aparecerá aquí."));
}

export function proyecto(id, { verHechas = false } = {}) {
  const p = proyectoDe(id);
  if (!p) return vacio("Este proyecto ya no existe");
  const todas = S.tareas.filter(t => t.proyectoId === id);
  const raiz = (verHechas ? todas : todas.filter(t => !t.hecha)).filter(t => !t.padreId).sort(compararManual);
  const hijos = hijosPorPadre(S.tareas);
  const hechas = todas.filter(t => t.hecha).length;
  const pct = todas.length ? Math.round(100 * hechas / todas.length) : 0;
  // por secciones, en el orden en que aparecen
  const secciones = [];
  for (const t of raiz) { const s = t.seccion || ""; let g = secciones.find(x => x.s === s); if (!g) secciones.push(g = { s, l: [] }); g.l.push(t); }
  const proxima = todas.filter(t => !t.hecha && t.fecha).sort(comparar)[0];
  return cab(`<i class="punto" style="background:${esc(p.color)}"></i>${esc(p.nombre)}`, `${hechas} de ${todas.length} hechas (pasos incluidos)${proxima ? " · siguiente: " + esc(fechaBonita(proxima.fecha)) : ""}`,
    `<button class="icono" data-editar-proyecto="${esc(p.id)}" aria-label="Editar proyecto">⋯</button>`) +
    `<div class="barra grande"><i style="width:${pct}%;background:${esc(p.color)}"></i></div>
     <div class="herramientas"><label class="interruptor"><input type="checkbox" data-ver-hechas ${verHechas ? "checked" : ""}> Ver hechas</label><button class="enlace" data-anadir-proyecto="${esc(p.id)}">+ Añadir tarea</button></div>` +
    (raiz.length ? secciones.map(g => `${g.s ? `<h2 class="grupo">${esc(g.s)} <span>${g.l.length}</span></h2>` : ""}<ul class="lista">${filas(g.l, { proyecto: false, hijos, verHechas })}</ul>`).join("") : vacio(todas.length ? "¡Proyecto terminado!" : "Proyecto vacío", todas.length ? "Todas las tareas están hechas." : "Añade tareas o importa un CSV de Todoist desde Ajustes."));
}

export function buscar(q) {
  return cab("Buscar") + `<input class="buscador" type="search" placeholder="Buscar en títulos y notas…" value="${esc(q)}" data-buscar><div id="resultados">${resultados(q)}</div>`;
}
export function resultados(q) {
  const l = deVista("buscar", S.tareas, hoyISO(), { q });
  return q ? (l.length ? `<ul class="lista">${filas(l.slice(0, 100))}</ul>` : vacio("Sin resultados")) : `<p class="suave centrado">Pulsa «/» en el ordenador para buscar desde cualquier sitio.</p>`;
}

export function hechas() {
  const l = deVista("hechas", S.tareas, hoyISO()).filter(t => !t.padreId).slice(0, 150);
  const grupos = new Map();
  for (const t of l) { const k = t.hechaEn ? new Date(t.hechaEn).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "Antes"; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(t); }
  return cab("Hechas", "Las últimas 150") + (l.length ? [...grupos].map(([k, ts]) => `<h2 class="grupo">${esc(k)} <span>${ts.length}</span></h2><ul class="lista">${filas(ts, { sinFoco: true })}</ul>`).join("") : vacio("Aún nada hecho", "¡A por la primera!"));
}

// ---------------- calendario ----------------
export function calendario(estado) {
  const h = hoyISO();
  const mes = estado.mes || h.slice(0, 7);
  const sel = estado.dia || h;
  const [a, m] = mes.split("-").map(Number);
  const primero = `${mes}-01`;
  const inicio = lunesDe(primero);
  const finMes = new Date(a, m, 0).getDate();
  const semanas = Math.ceil((diaSemana(primero) + finMes) / 7);
  const porDia = new Map();
  for (const t of S.tareas) if (t.fecha && (!t.padreId || !S.tareas.some(x => x.id === t.padreId && x.fecha === t.fecha))) { if (!porDia.has(t.fecha)) porDia.set(t.fecha, []); porDia.get(t.fecha).push(t); }
  for (const l of porDia.values()) l.sort(comparar);
  const celdas = [];
  for (let i = 0; i < semanas * 7; i++) {
    const d = sumarDias(inicio, i), l = porDia.get(d) || [], pend = l.filter(t => !t.hecha);
    celdas.push(`<button class="dia ${d.slice(0, 7) !== mes ? "fuera" : ""} ${d === h ? "hoy" : ""} ${d === sel ? "sel" : ""} ${diaSemana(d) > 4 ? "finde" : ""}" data-dia="${d}">
      <span class="num">${Number(d.slice(8))}</span>
      <span class="eventos">${l.slice(0, 3).map(t => `<em class="${t.hecha ? "hecha" : ""}" style="--c:${esc(proyectoDe(t.proyectoId)?.color || "var(--suave)")}">${t.hora ? `<b>${t.hora}</b> ` : ""}${esc(t.titulo)}</em>`).join("")}${l.length > 3 ? `<small>+${l.length - 3}</small>` : ""}</span>
      <span class="puntos">${pend.slice(0, 4).map(t => `<i style="background:${esc(proyectoDe(t.proyectoId)?.color || "var(--suave)")}"></i>`).join("")}</span>
    </button>`);
  }
  const deSel = porDia.get(sel) || [];
  const pend = deSel.filter(t => !t.hecha), hech = deSel.filter(t => t.hecha);
  return cab(`${MESES[m - 1].replace(/^./, c => c.toUpperCase())} <span class="suave">${a}</span>`, "", `<div class="nav-mes"><button class="icono" data-mes="-1" aria-label="Mes anterior">‹</button><button class="btn peque" data-mes="0">Hoy</button><button class="icono" data-mes="1" aria-label="Mes siguiente">›</button></div>`) +
    `<div class="mes"><div class="sem">${DIAS_CORTOS.map(d => `<span>${d}</span>`).join("")}</div><div class="rejilla" style="--filas:${semanas}">${celdas.join("")}</div></div>
     <h2 class="grupo">${esc(fechaBonita(sel, h))} <small class="suave">${esc(fechaLarga(sel))}</small> <span>${pend.length}</span><button class="enlace" data-anadir-fecha="${sel}">+ Añadir</button></h2>
     ${pend.length ? `<ul class="lista">${filas(pend, { fecha: false })}</ul>` : `<p class="suave centrado">Nada pendiente este día.</p>`}
     ${hech.length ? `<h2 class="grupo">Hechas <span>${hech.length}</span></h2><ul class="lista">${filas(hech, { fecha: false, sinFoco: true })}</ul>` : ""}
     <p class="suave peque centrado">En el ordenador puedes arrastrar una tarea a otro día.</p>`;
}
export const mesMas = (mes, n) => { const d = aDate(mes + "-01"); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
