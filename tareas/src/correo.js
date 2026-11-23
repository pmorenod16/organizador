// Correo de la mañana: lo envía un pequeño script de Google (Apps Script) en tu cuenta, que lee estos ajustes.
import * as D from "./datos.js";
import { S } from "./datos.js";
import { esc, toast } from "./ui.js";

const conf = () => ({ activo: false, direccion: "", hora: "07:00", ...(S.ajustes.correo || {}) });
const HORAS = ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "10:00"];

export const caja = () => {
  const c = conf();
  return `<section class="caja" id="correo"><h2>Correo de la mañana</h2>
    <p class="suave">Cada mañana te llega un correo con las tareas del día (y las vencidas). Si no tienes ninguna, no se envía.</p>
    <label class="fila-ajuste"><span>Enviarme el correo</span><input type="checkbox" class="sw" data-correo="activo" ${c.activo ? "checked" : ""}></label>
    <label class="fila-ajuste"><span>Correo</span><input type="email" data-correo="direccion" value="${esc(c.direccion)}" placeholder="tu@gmail.com" inputmode="email" autocomplete="email"></label>
    <label class="fila-ajuste"><span>Hora</span><select data-correo="hora">${HORAS.map(h => `<option ${c.hora === h ? "selected" : ""}>${h}</option>`).join("")}</select></label>
    <details class="instrucciones"${c.activo && !S.ajustes.correoInstalado ? " open" : ""}><summary>Activarlo (una sola vez, 3 minutos)</summary>
      <ol>
        <li>Entra en <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> con la <b>misma cuenta de Google</b> con la que entras en Tasca. Se abre un proyecto nuevo: ponle de nombre «Tasca correo».</li>
        <li>Borra lo que hay en <b>Código.gs</b> y pega el código: <button class="btn peque" data-correo-copiar="Codigo.gs">Copiar código</button></li>
        <li>En ⚙️ <b>Configuración del proyecto</b> activa <b>«Mostrar el archivo de manifiesto appsscript.json»</b>. Vuelve al editor, abre <b>appsscript.json</b>, borra lo que hay y pega esto: <button class="btn peque" data-correo-copiar="appsscript.json">Copiar manifiesto</button></li>
        <li>Guarda (💾), arriba elige la función <b>instalar</b> y pulsa <b>Ejecutar</b>. Google te pedirá permisos: <b>Revisar permisos</b> → tu cuenta → <b>Configuración avanzada</b> → <b>Ir a Tasca correo</b> → <b>Permitir</b>.</li>
        <li>Te llegará un correo de prueba. A partir de ahí, cada mañana a la hora que hayas puesto. <button class="btn peque" data-correo-hecho>Ya lo he hecho</button></li>
      </ol>
      <p class="suave peque">El correo sale de tu propio Gmail y el script solo lee tus tareas. Si cambias el correo o la hora aquí, el script lo coge solo.</p>
    </details></section>`;
};

export async function cambiar(x) {
  const campo = x.dataset.correo;
  let v = x.type === "checkbox" ? x.checked : x.value.trim();
  if (campo === "direccion" && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast("Ese correo no parece válido"); return; }
  const c = { ...conf(), [campo]: v };
  if (campo === "activo" && v && !c.direccion) toast("Pon también a qué correo lo envío");
  await D.guardarAjustes({ correo: c });
  if (campo === "direccion" && v) toast("Guardado");
}

export async function copiar(archivo) {
  try {
    const r = await fetch(new URL(`correo/${archivo}`, location.href), { cache: "no-store" });
    const t = await r.text();
    try { await navigator.clipboard.writeText(t); }
    catch { const ta = document.createElement("textarea"); ta.value = t; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    toast(archivo === "Codigo.gs" ? "Código copiado: pégalo en Código.gs" : "Manifiesto copiado: pégalo en appsscript.json");
  } catch { toast("No he podido copiarlo"); }
}

export const hecho = () => D.guardarAjustes({ correoInstalado: true }).then(() => toast("¡Perfecto! Mañana te llega el primero"));
