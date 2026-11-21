// Utilidades de interfaz: escapar texto, avisos breves, hojas (modales) y confirmaciones.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Texto con enlaces clicables y saltos de línea */
export const conEnlaces = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, "<br>");

let tT;
export function toast(texto, { accion, alPulsar, ms = 3500 } = {}) {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(texto)}</span>${accion ? `<button>${esc(accion)}</button>` : ""}`;
  el.hidden = false;
  if (accion) el.querySelector("button").onclick = () => { el.hidden = true; alPulsar?.(); };
  clearTimeout(tT); tT = setTimeout(() => (el.hidden = true), ms);
}

const pila = [];
/** Abre una hoja (abajo en el móvil, centrada en el ordenador). Devuelve el elemento del contenido. */
export function hoja(html, { clase = "", alCerrar } = {}) {
  const fondo = document.createElement("div");
  fondo.className = "fondo-hoja";
  fondo.innerHTML = `<div class="hoja ${clase}" role="dialog" aria-modal="true"><div class="asa"></div>${html}</div>`;
  document.body.append(fondo);
  requestAnimationFrame(() => fondo.classList.add("abierta"));
  const cerrar = () => {
    const i = pila.indexOf(cerrar); if (i >= 0) pila.splice(i, 1);
    fondo.classList.remove("abierta");
    setTimeout(() => fondo.remove(), 180);
    alCerrar?.();
  };
  fondo.addEventListener("pointerdown", e => { if (e.target === fondo) fondo.dataset.fuera = "1"; });
  fondo.addEventListener("click", e => { if (e.target === fondo && fondo.dataset.fuera) cerrar(); delete fondo.dataset.fuera; });
  pila.push(cerrar);
  const el = fondo.firstElementChild;
  el.cerrar = cerrar;
  return el;
}
export const cerrarHoja = () => pila[pila.length - 1]?.();
export const hayHoja = () => pila.length > 0;
document.addEventListener("keydown", e => { if (e.key === "Escape" && pila.length) { e.preventDefault(); cerrarHoja(); } });

export function confirmar(texto, { si = "Sí", no = "Cancelar", peligro = false } = {}) {
  return new Promise(ok => {
    const el = hoja(`<p class="pregunta">${esc(texto)}</p><div class="botones"><button class="btn" data-r="0">${esc(no)}</button><button class="btn ${peligro ? "peligro" : "primario"}" data-r="1">${esc(si)}</button></div>`, { clase: "peque", alCerrar: () => ok(false) });
    el.querySelectorAll("[data-r]").forEach(b => (b.onclick = () => { const r = b.dataset.r === "1"; el.cerrar(); setTimeout(() => ok(r), 0); }));
  });
}
export function pedirTexto(titulo, valor = "", { boton = "Guardar", placeholder = "" } = {}) {
  return new Promise(ok => {
    let hecho = false;
    const el = hoja(`<form class="pedir"><label>${esc(titulo)}<input name="v" value="${esc(valor)}" placeholder="${esc(placeholder)}" required></label><div class="botones"><button type="button" class="btn" data-c>Cancelar</button><button class="btn primario">${esc(boton)}</button></div></form>`, { clase: "peque", alCerrar: () => !hecho && ok(null) });
    const f = el.querySelector("form");
    f.onsubmit = e => { e.preventDefault(); hecho = true; const v = f.v.value.trim(); el.cerrar(); ok(v || null); };
    el.querySelector("[data-c]").onclick = () => el.cerrar();
    setTimeout(() => f.v.focus(), 50);
  });
}

/** Vibración corta en el móvil (si se puede) */
export const vibrar = (ms = 12) => { try { navigator.vibrate?.(ms); } catch {} };
