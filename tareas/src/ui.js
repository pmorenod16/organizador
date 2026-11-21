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
    setTimeout(() => fondo.remove(), 320);
    alCerrar?.();
  };
  fondo.addEventListener("pointerdown", e => { if (e.target === fondo) fondo.dataset.fuera = "1"; });
  fondo.addEventListener("click", e => { if (e.target === fondo && fondo.dataset.fuera) cerrar(); delete fondo.dataset.fuera; });
  pila.push(cerrar);
  const el = fondo.firstElementChild;
  arrastrarParaCerrar(fondo, el, cerrar);
  el.cerrar = cerrar;
  return el;
}
/** En el móvil la hoja se arrastra hacia abajo para cerrarla: sigue al dedo y, al soltar, se cierra si has bajado bastante o rápido */
function arrastrarParaCerrar(fondo, hojaEl, cerrar) {
  if (!matchMedia("(pointer: coarse)").matches) return;
  let st = null;
  hojaEl.addEventListener("touchstart", e => {
    const t = e.touches[0];
    if (e.touches.length !== 1 || e.target.closest("input, textarea, select")) return (st = null);
    st = { y: t.clientY, x: t.clientX, dy: 0, t0: performance.now(), lock: null, arriba: hojaEl.scrollTop <= 0 };
  }, { passive: true });
  hojaEl.addEventListener("touchmove", e => {
    if (!st || !st.arriba) return;
    const t = e.touches[0], dy = t.clientY - st.y, dx = t.clientX - st.x;
    if (!st.lock) { if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return; st.lock = dy > Math.abs(dx) * 1.2 ? "y" : "x"; }
    if (st.lock !== "y" || dy < 0) return;
    e.preventDefault();
    st.dy = dy;
    hojaEl.style.transition = "none"; hojaEl.style.transform = `translateY(${dy}px)`;
    fondo.style.transition = "none"; fondo.style.background = `rgba(10, 11, 14, ${Math.max(0.05, 0.38 * (1 - dy / 500))})`;
  }, { passive: false });
  const fin = () => {
    if (!st) return;
    const { dy, t0 } = st; st = null;
    const v = dy / Math.max(1, performance.now() - t0);
    hojaEl.style.transition = ""; fondo.style.transition = ""; fondo.style.background = "";
    hojaEl.style.transform = "";
    if (dy > 110 || (v > 0.5 && dy > 30)) cerrar();
  };
  hojaEl.addEventListener("touchend", fin, { passive: true });
  hojaEl.addEventListener("touchcancel", fin, { passive: true });
}
export const cerrarHoja = () => pila[pila.length - 1]?.();
export const hayHoja = () => pila.length > 0;
document.addEventListener("keydown", e => { if (e.key === "Escape" && pila.length) { e.preventDefault(); cerrarHoja(); } });

export function confirmar(texto, { si = "Sí", no = "Cancelar", peligro = false } = {}) {
  return new Promise(ok => {
    const el = hoja(`<p class="pregunta">${esc(texto)}</p><div class="botones"><button class="btn" data-r="0">${esc(no)}</button><button class="btn ${peligro ? "peligro" : "primario"}" data-r="1">${esc(si)}</button></div>`, { clase: "peque", alCerrar: () => ok(false) });
    el.querySelectorAll("[data-r]").forEach(b => (b.onclick = () => { ok(b.dataset.r === "1"); el.cerrar(); }));
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
