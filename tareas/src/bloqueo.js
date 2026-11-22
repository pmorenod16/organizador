// Bloqueo de distracciones (solo en la app de Android): mientras estudias, las apps de la lista se tapan con
// la pantalla «Ahora toca estudiar». Usa «Acceso al uso» (qué app está delante) y «Mostrar sobre otras apps» (taparla);
// sin servicio de accesibilidad, que Play Protect bloquea al instalar APKs descargados.
import * as D from "./datos.js";
import { S } from "./datos.js";
import { esNativo, llamar } from "./nativo.js";
import { esc, hoja, toast } from "./ui.js";
import { normal } from "./logica.js";

// apps que se proponen la primera vez (si las tienes instaladas), además de todos los juegos
const SUGERIDAS = [
  "com.instagram.android", "com.instagram.barcelona", "com.google.android.youtube", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill",
  "com.amazon.avod.thirdpartyclient", "es.plus.yomvi", "es.movistar.plus", "com.netflix.mediaclient", "com.disney.disneyplus", "com.wbd.stream", "com.hbo.hbonow",
  "com.atresmedia.atresplayer", "es.rtve.play", "com.dazn", "tv.twitch.android.app", "com.twitter.android", "com.facebook.katana", "com.reddit.frontpage",
  "com.snapchat.android", "com.pinterest", "com.bereal.ft",
];

export const disponible = () => esNativo();
const conf = () => ({ activo: false, apps: [], descansos: false, ...(S.ajustes.bloqueo || {}) });
const guardar = cambios => D.guardarAjustes({ bloqueo: { ...conf(), ...cambios } });

let lista = null;
/** Apps instaladas (con icono). La primera vez propone las distracciones típicas y los juegos. */
export async function apps() {
  if (!lista) {
    const r = await llamar("Bloqueo", "apps");
    lista = (r?.apps || []).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    const c = conf();
    if (!c.inicializado) guardar({ inicializado: true, apps: lista.filter(a => a.juego || SUGERIDAS.includes(a.app)).map(a => a.app) });
  }
  return lista;
}

let ultima = "";
/** Le dice al servicio qué bloquear y hasta cuándo, según el reloj de Estudio */
export function sincronizar(P, subiendo, forzar) {
  if (forzar) ultima = "";
  if (!esNativo()) return;
  const c = conf();
  let hasta = 0;
  if (c.activo && c.apps.length && P.estado === "corriendo" && (P.modo === "foco" || c.descansos))
    hasta = subiendo ? Date.now() + 6 * 3600e3 : P.fin; // con cuenta atrás se levanta solo al acabar el bloque
  const clave = Math.round(hasta / 60000) + "|" + c.apps.join(",");
  if (clave === ultima) return;
  ultima = clave;
  llamar("Bloqueo", "configurar", { apps: c.apps, hasta })
    .then(r => { if (r?.error) toast("El bloqueo no ha podido arrancar: " + r.error); })
    .catch(() => {}); // APK antiguo: sin el plugin
}
export const bloqueando = P => esNativo() && conf().activo && conf().apps.length && P.estado === "corriendo" && (P.modo === "foco" || conf().descansos);
export const nombresBloqueadas = () => {
  const c = conf(); if (!lista) return c.apps.length ? `${c.apps.length} apps` : "";
  const n = lista.filter(a => c.apps.includes(a.app)).map(a => a.nombre);
  return n.length <= 3 ? n.join(", ") : `${n.slice(0, 2).join(", ")} y ${n.length - 2} más`;
};

// ---------------- Ajustes ----------------
export const caja = () => `<section class="caja" id="bloqueo"><h2>Bloqueo de distracciones</h2><div data-bloqueo>${esNativo() ? `<p class="suave">Cargando…</p>` : `<p class="suave">Mientras estudias, tapa Instagram, YouTube, los juegos y las apps que elijas. Funciona en la app de Android (en el navegador no se puede).</p>`}</div></section>`;

export async function rellenar(el) {
  if (!el || !esNativo()) return;
  let est;
  try { est = await llamar("Bloqueo", "estado"); }
  catch { el.innerHTML = `<p class="aviso">Para bloquear apps hace falta la app nueva: descarga otra vez el APK e instálalo encima.</p><a class="btn" href="https://github.com/pmorenod16/organizador/releases/download/tasca/tasca.apk">Descargar el APK</a>`; return; }
  const c = conf();
  let ls = [];
  try { ls = await apps(); } catch {}
  const elegidas = ls.filter(a => conf().apps.includes(a.app));
  el.innerHTML = `
    <p class="suave">Mientras estudias, si abres una de estas apps sale la pantalla «Ahora toca estudiar» con el tiempo que queda. Al acabar el bloque se desbloquean solas.</p>
    <label class="fila-ajuste"><span>Bloquear apps mientras estudio</span><input type="checkbox" class="sw" data-bloq="activo" ${c.activo ? "checked" : ""}></label>
    ${c.activo && !est.activo ? `<div class="aviso permiso-bloqueo">
      <b>Faltan permisos de Android</b>
      <ol>
        <li class="${est.uso ? "hecho" : ""}">${est.uso ? "✓ " : ""}<b>Acceso al uso</b>: para saber qué app tienes delante. Pulsa el botón, busca <b>Tasca</b> y actívalo.
          ${est.uso ? "" : `<div class="botones-izq"><button class="btn primario peque" data-bloq-uso>Dar acceso al uso</button></div>`}</li>
        <li class="${est.superponer ? "hecho" : ""}">${est.superponer ? "✓ " : ""}<b>Mostrar sobre otras apps</b>: para taparla con la pantalla de estudio.
          ${est.superponer ? "" : `<div class="botones-izq"><button class="btn primario peque" data-bloq-superponer>Permitir</button></div>`}</li>
        ${/xiaomi|redmi|poco/i.test(est.fabricante || "") ? `<li class="${est.fondoXiaomi ? "hecho" : ""}">${est.fondoXiaomi ? "✓ " : est.fondoXiaomi === false ? "<b>Falta este:</b> " : ""}En Xiaomi: en <b>Otros permisos</b> activa <b>Mostrar ventanas emergentes mientras se ejecuta en segundo plano</b>, y en la info de Tasca pon <b>Ahorro de batería → Sin restricciones</b>.
          <div class="botones-izq"><button class="btn peque" data-bloq-xiaomi>Otros permisos</button><button class="btn peque" data-bloq-info>Info de Tasca</button></div></li>` : ""}
      </ol>
      <p class="suave peque">Si sale <b>«Ajuste restringido»</b>: abre la info de Tasca → ⋮ arriba a la derecha → <b>Permitir ajustes restringidos</b>. Tasca solo mira qué app está abierta; no lee nada de lo que hay dentro.</p></div>` : c.activo ? `<p class="ok-bloqueo">✓ Permisos activados</p>` : ""}
    ${c.activo ? `<p class="suave peque">Importante: en la info de Tasca pon <b>Batería → Sin restricciones</b> (y el <b>Inicio automático</b> si sale). Si no, el móvil duerme a Tasca al salir y no bloquea. <button class="enlace" data-bloq-info>Abrir info de Tasca</button></p>` : ""}
    <div class="fila-ajuste"><span>Apps bloqueadas<small class="suave bloq-lista">${elegidas.length ? esc(elegidas.slice(0, 4).map(a => a.nombre).join(", ")) + (elegidas.length > 4 ? ` y ${elegidas.length - 4} más` : "") : "ninguna"}</small></span><button class="btn peque" data-bloq-elegir>Elegir</button></div>
    ${c.activo ? `<div class="fila-ajuste"><span>Probar el bloqueo<small class="suave">Bloquea 1 minuto las apps elegidas, sin reloj.${est.servicio ? ` Ahora está en marcha${est.ultimaApp ? ` (última app vista: ${esc(est.ultimaApp)})` : ""}.` : ""}</small></span><button class="btn peque" data-bloq-probar>Probar 1 min</button></div>` : ""}
    <label class="fila-ajuste"><span>Bloquear también en los descansos</span><input type="checkbox" class="sw" data-bloq="descansos" ${c.descansos ? "checked" : ""}></label>`;
}

export async function cambiar(campo, valor) { await guardar({ [campo]: valor }); ultima = ""; }
export const abrirUso = () => llamar("Bloqueo", "abrirUso");
export const abrirSuperponer = () => llamar("Bloqueo", "abrirSuperponer");
export const abrirXiaomi = () => llamar("Bloqueo", "abrirPermisosXiaomi");
export const abrirInfo = () => llamar("Bloqueo", "abrirInfoApp");

/** Hoja para elegir qué apps bloquear */
export async function elegir() {
  let ls;
  try { ls = await apps(); } catch { toast("No he podido leer las apps del móvil"); return; }
  const sel = new Set(conf().apps);
  const fila = a => `<li><label><img src="${a.icono}" alt="" width="36" height="36"><span>${esc(a.nombre)}${a.juego ? ` <small class="suave">juego</small>` : ""}</span><input type="checkbox" class="sw" data-app="${esc(a.app)}" ${sel.has(a.app) ? "checked" : ""}></label></li>`;
  const pintarLista = q => {
    const f = ls.filter(a => !q || normal(a.nombre).includes(normal(q)));
    const marcadas = f.filter(a => sel.has(a.app)), resto = f.filter(a => !sel.has(a.app));
    return (marcadas.length ? `<h3>Bloqueadas <span class="suave">${marcadas.length}</span></h3><ul class="apps-bloq">${marcadas.map(fila).join("")}</ul>` : "") +
      `<h3>Resto de apps</h3><ul class="apps-bloq">${resto.map(fila).join("") || `<li class="suave">Nada con ese nombre.</li>`}</ul>`;
  };
  const el = hoja(`<div class="elegir-apps"><h2>Apps que se bloquean</h2>
    <input type="search" data-q placeholder="Buscar app…">
    <div class="botones-izq"><button class="btn peque" data-juegos>Marcar todos los juegos</button><button class="btn peque" data-ninguna>Desmarcar todas</button></div>
    <div data-lista>${pintarLista("")}</div>
    <div class="botones"><button class="btn primario" data-listo>Listo</button></div></div>`, { alCerrar: () => guardar({ apps: [...sel] }).then(() => { ultima = ""; }) });
  const q = el.querySelector("[data-q]");
  q.oninput = () => { el.querySelector("[data-lista]").innerHTML = pintarLista(q.value); };
  el.addEventListener("change", e => { const a = e.target.dataset.app; if (a) e.target.checked ? sel.add(a) : sel.delete(a); });
  el.querySelector("[data-juegos]").onclick = () => { ls.filter(a => a.juego).forEach(a => sel.add(a.app)); el.querySelector("[data-lista]").innerHTML = pintarLista(q.value); };
  el.querySelector("[data-ninguna]").onclick = () => { sel.clear(); el.querySelector("[data-lista]").innerHTML = pintarLista(q.value); };
  el.querySelector("[data-listo]").onclick = () => el.cerrar();
}

/** Bloquea 1 minuto para comprobar que funciona */
export async function probar() {
  const c = conf();
  if (!c.apps.length) return toast("Primero elige qué apps bloquear");
  let est; try { est = await llamar("Bloqueo", "estado"); } catch { return toast("Hace falta el APK nuevo"); }
  if (!est.uso) return toast("Falta el permiso «Acceso al uso»");
  if (!est.superponer) return toast("Falta el permiso «Mostrar sobre otras apps»");
  const r = await llamar("Bloqueo", "configurar", { apps: c.apps, hasta: Date.now() + 60e3 });
  ultima = "";
  if (r?.error) return toast("No ha podido arrancar: " + r.error);
  toast("Bloqueo de prueba durante 1 minuto: abre ahora una de las apps");
}
