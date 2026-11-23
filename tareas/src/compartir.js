// Proyectos compartidos: invitar por correo, ver quién está y aceptar invitaciones.
import * as D from "./datos.js";
import { S } from "./datos.js";
import { esc, hoja, toast, confirmar } from "./ui.js";

const nombreDe = (p, u) => p.nombres?.[u] || p.correos?.[u] || "Alguien";

/** Avisos de invitación (arriba de Hoy y de Proyectos) */
export const invitacionesHtml = () => S.invitaciones.map(p => {
  const quien = nombreDe(p, p.dueno);
  return `<div class="invitacion tarjeta"><span class="ico-inv">👥</span><div><b>${esc(quien)}</b> te invita al proyecto <b>«${esc(p.nombre)}»</b>
    <div class="botones-izq"><button class="btn primario peque" data-inv-aceptar="${esc(p.id)}">Unirme</button><button class="btn peque" data-inv-rechazar="${esc(p.id)}">No, gracias</button></div></div></div>`;
}).join("");

export async function aceptar(pid) {
  const p = S.invitaciones.find(x => x.id === pid);
  try { await D.aceptar(pid); toast(`Ya estás en «${p?.nombre || "el proyecto"}»`); location.hash = "#/proyecto/" + pid; }
  catch (e) { console.error(e); toast("No he podido unirte: " + (e.code || e.message)); }
}
export async function rechazar(pid) { try { await D.rechazar(pid); toast("Invitación rechazada"); } catch (e) { toast("No he podido rechazarla"); } }

/** Hoja de compartir un proyecto */
export function abrir(pid) {
  const pintar = () => {
    const p = S.proyectos.find(x => x.id === pid);
    if (!p) return `<h2>Compartir</h2><p class="suave">Este proyecto ya no existe.</p>`;
    const yo = D.usuario().uid;
    const miembros = p.compartido ? p.miembros || [] : [yo];
    return `<div class="hoja-compartir"><h2>Compartir «${esc(p.nombre)}»</h2>
      <p class="suave">Las personas que invites verán y podrán editar todas las tareas de este proyecto, cada una desde su Tasca. Tienen que entrar con su cuenta de Google.</p>
      <form data-invitar class="fila-invitar"><input type="email" name="c" placeholder="correo@gmail.com" inputmode="email" autocomplete="off" required><button class="btn primario">Invitar</button></form>
      <h3>Miembros</h3>
      <ul class="miembros">${miembros.map(u => `<li><span class="avatar">${esc((nombreDe(p.compartido ? p : { nombres: { [yo]: D.usuario().nombre } }, u)[0] || "?").toUpperCase())}</span><span>${esc(u === yo ? "Tú" : nombreDe(p, u))}${p.dueno === u ? ` <small class="suave">· creó el proyecto</small>` : ""}<small class="suave bloque">${esc(u === yo ? D.usuario().email : p.correos?.[u] || "")}</small></span>${p.compartido && u !== yo ? `<button class="enlace" data-quitar-miembro="${esc(u)}">Quitar</button>` : ""}</li>`).join("")}</ul>
      ${p.compartido && (p.invitados || []).length ? `<h3>Invitaciones pendientes</h3><ul class="miembros">${p.invitados.map(c => `<li><span class="avatar suave">✉</span><span>${esc(c)}<small class="suave bloque">Aún no ha aceptado</small></span><button class="enlace" data-quitar-inv="${esc(c)}">Cancelar</button></li>`).join("")}</ul>` : ""}
      ${p.compartido ? `<button class="btn peligro" data-salir>Salir del proyecto</button>` : ""}</div>`;
  };
  let quitar = () => {};
  const el = hoja(pintar(), { alCerrar: () => quitar() });
  quitar = D.alCambiar(() => { if (document.body.contains(el)) { const f = el.querySelector("[data-invitar] input"); const v = f?.value; el.innerHTML = `<div class="asa"></div>` + pintar(); const g = el.querySelector("[data-invitar] input"); if (g && v) g.value = v; } else quitar(); });
  el.addEventListener("submit", async e => {
    e.preventDefault();
    const c = e.target.c.value.trim().toLowerCase();
    if (!D.correoValido(c)) return toast("Ese correo no parece válido");
    if (c === D.usuario().email) return toast("Ese eres tú 🙂");
    const b = e.target.querySelector("button"); b.disabled = true;
    try { await D.compartir(pid, c); e.target.c.value = ""; toast(`Invitación enviada a ${c}: le saldrá al abrir Tasca`); }
    catch (er) { console.error(er); toast("No he podido compartirlo: " + (er.code || er.message)); }
    b.disabled = false;
  });
  el.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    const p = S.proyectos.find(x => x.id === pid); if (!p) return;
    if (b.dataset.quitarInv) { await D.quitarInvitacion(pid, b.dataset.quitarInv); toast("Invitación cancelada"); }
    else if (b.dataset.quitarMiembro) {
      if (await confirmar(`¿Quitar a ${nombreDe(p, b.dataset.quitarMiembro)} del proyecto?`, { si: "Quitar", peligro: true })) await D.quitarMiembro(pid, b.dataset.quitarMiembro);
    } else if (b.dataset.salir !== undefined) {
      const solo = (p.miembros || []).length <= 1;
      if (await confirmar(solo ? `Eres la única persona del proyecto: si sales, se borra con sus tareas.` : `¿Salir de «${p.nombre}»? Dejarás de ver sus tareas (los demás las seguirán teniendo).`, { si: solo ? "Borrar y salir" : "Salir", peligro: true })) {
        await (solo ? D.borrarProyecto(pid) : D.salirDe(pid));
        el.cerrar?.(); location.hash = "#/explorar"; toast(solo ? "Proyecto borrado" : "Has salido del proyecto");
      }
    }
  });
}
