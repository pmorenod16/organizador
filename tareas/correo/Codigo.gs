/**
 * Tasca · correo de la mañana
 * Cada hora mira si ya es la hora que pusiste en Tasca (Ajustes → Correo de la mañana) y, si hoy aún no lo
 * ha mandado, te envía las tareas del día desde tu Gmail. Lee tus datos de Firebase con tu propia cuenta de
 * Google, así que no hace falta ninguna contraseña.
 *
 * Instalación: pega este código, pega también appsscript.json y ejecuta «instalar» una vez.
 */
const PROYECTO = "organizador-52dec";
const UID = "muiVgEMaG1UfYOjXx3lSNF4kZ3U2";
const WEB = "https://pmorenod16.github.io/organizador/tareas/";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents/usuarios/${UID}`;

/** Ejecútalo una vez: crea el aviso de cada hora y manda un correo de prueba */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("cadaHora").timeBased().everyHours(1).create();
  const c = ajustes();
  if (!c.direccion) throw new Error("Pon primero tu correo en Tasca → Ajustes → Correo de la mañana");
  enviar(c, true);
}

/** Lo lanza el aviso de cada hora */
function cadaHora() {
  const c = ajustes();
  if (!c.activo || !c.direccion) return;
  const hoy = fecha(new Date()), hora = Utilities.formatDate(new Date(), "Europe/Madrid", "HH:mm");
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("enviado") === hoy || hora < (c.hora || "07:00")) return;
  props.setProperty("enviado", hoy);
  enviar(c, false);
}

/** Para probarlo a mano cuando quieras */
function probar() { enviar(ajustes(), true); }

// ---------------------------------------------------------------------------------------------------------

function enviar(c, siempre) {
  const hoy = fecha(new Date());
  const proyectos = {};
  leerTodo("tasca_proyectos").forEach(p => { proyectos[p.id] = p; });
  const todas = leerTodo("tasca_tareas");
  const porId = {}; todas.forEach(t => { porId[t.id] = t; });
  const suelta = t => !t.padreId || !porId[t.padreId] || (t.fecha && t.fecha !== porId[t.padreId].fecha);
  const lista = todas.filter(t => !t.hecha && t.fecha && t.fecha <= hoy && suelta(t))
    .sort((a, b) => ((b.fecha < hoy) - (a.fecha < hoy)) || (a.hora || "99:99").localeCompare(b.hora || "99:99") || (a.prioridad || 4) - (b.prioridad || 4));
  const vencidas = lista.filter(t => t.fecha < hoy), deHoy = lista.filter(t => t.fecha === hoy);
  if (!lista.length && !siempre) return; // sin tareas, no molesta

  const dia = Utilities.formatDate(new Date(), "Europe/Madrid", "EEEE d 'de' MMMM");
  const n = lista.length;
  const asunto = n ? `Tasca · ${n} ${n === 1 ? "tarea" : "tareas"} para hoy` : "Tasca · hoy no tienes tareas";
  const PRIO = { 1: "#D1453B", 2: "#EB8909", 3: "#246FE0" };
  const fila = t => {
    const p = proyectos[t.proyectoId];
    const extra = [t.fecha < hoy ? `<span style="color:#C8553D">Vencida (${t.fecha.slice(8)}/${t.fecha.slice(5, 7)})</span>` : "", t.hora || "",
      p ? `<span style="color:${p.color || "#888"}">●</span> ${esc(p.nombre)}` : ""].filter(Boolean).join(" · ");
    const borde = PRIO[t.prioridad] || "#BDBDC4";
    return `<tr><td style="padding:9px 0;border-bottom:1px solid #EEEDEA">
      <span style="display:inline-block;width:12px;height:12px;border:2px solid ${borde};border-radius:50%;vertical-align:-2px;margin-right:10px"></span>
      <span style="font-size:15px;color:#1D1E22">${esc(t.titulo || "")}</span>
      ${extra ? `<div style="font-size:12px;color:#7A7C84;margin:3px 0 0 26px">${extra}</div>` : ""}</td></tr>`;
  };
  const bloque = (titulo, ts) => ts.length ? `<h3 style="font-size:13px;color:#7A7C84;margin:22px 0 4px;text-transform:uppercase;letter-spacing:.04em">${titulo} · ${ts.length}</h3><table style="width:100%;border-collapse:collapse">${ts.map(fila).join("")}</table>` : "";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px 20px;background:#F7F6F3;border-radius:16px">
    <div style="font-size:22px;font-weight:700;color:#1D1E22">Buenos días ☀️</div>
    <div style="font-size:14px;color:#7A7C84;margin-top:2px">${dia.charAt(0).toUpperCase() + dia.slice(1)}</div>
    ${n ? bloque("Vencidas", vencidas) + bloque("Hoy", deHoy) : `<p style="font-size:15px;color:#1D1E22;margin-top:20px">Hoy no tienes tareas pendientes 🎉</p>`}
    <p style="margin-top:26px"><a href="${WEB}" style="background:#8E80C4;color:#fff;text-decoration:none;padding:10px 18px;border-radius:20px;font-size:14px">Abrir Tasca</a></p>
    <p style="font-size:11px;color:#A0A2A8;margin-top:18px">Lo puedes cambiar o quitar en Tasca → Ajustes → Correo de la mañana.</p></div>`;
  const texto = n ? lista.map(t => `- ${t.titulo}${t.hora ? " (" + t.hora + ")" : ""}${t.fecha < hoy ? " [vencida]" : ""}`).join("\n") : "Hoy no tienes tareas pendientes.";
  MailApp.sendEmail({ to: c.direccion, subject: asunto, body: texto + "\n\n" + WEB, htmlBody: html, name: "Tasca" });
}

function ajustes() {
  const d = pedir(`${BASE}/tasca_config/ajustes`);
  const a = d && d.fields ? valor({ mapValue: { fields: d.fields } }) : {};
  return a.correo || {};
}

function leerTodo(coleccion) {
  const out = []; let token = "";
  do {
    const r = pedir(`${BASE}/${coleccion}?pageSize=300${token ? "&pageToken=" + encodeURIComponent(token) : ""}`);
    (r.documents || []).forEach(d => { const x = valor({ mapValue: { fields: d.fields || {} } }); x.id = x.id || d.name.split("/").pop(); out.push(x); });
    token = r.nextPageToken || "";
  } while (token);
  return out;
}

function pedir(url) {
  const r = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken(), "x-goog-user-project": PROYECTO }, muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return {};
  if (r.getResponseCode() === 403) throw new Error("Firebase no deja leer con esta cuenta. ¿Es la misma cuenta de Google con la que creaste el proyecto de Firebase? Detalle: " + r.getContentText().slice(0, 300));
  if (r.getResponseCode() !== 200) throw new Error("Firebase respondió " + r.getResponseCode() + ": " + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText());
}

/** Valor de Firestore (REST) a JavaScript normal */
function valor(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valor);
  if ("mapValue" in v) { const o = {}; const f = v.mapValue.fields || {}; Object.keys(f).forEach(k => { o[k] = valor(f[k]); }); return o; }
  return null;
}

const fecha = d => Utilities.formatDate(d, "Europe/Madrid", "yyyy-MM-dd");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
