// Lee un calendario .ics y devuelve las instancias que caen entre dos fechas,
// con las repeticiones (RRULE), los días quitados (EXDATE), las instancias movidas
// (RECURRENCE-ID) y las canceladas ya resueltas. Se ejecuta en el móvil (no en el Worker:
// expandir calendarios grandes se pasaría del tiempo de CPU gratuito de Cloudflare).
// Las horas sin zona («flotantes») se leen en la hora del dispositivo (Madrid).
import ICAL from "../vendor/ical.min.js?v=202611150839";

const MADRID = `BEGIN:VTIMEZONE
TZID:Europe/Madrid
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;
let madridListo = false;
function registrarMadrid() {
  if (madridListo) return;
  madridListo = true;
  if (!ICAL.TimezoneService.has("Europe/Madrid")) {
    ICAL.TimezoneService.register("Europe/Madrid", new ICAL.Timezone(new ICAL.Component(ICAL.parse(MADRID))));
  }
}

const MAX_INSTANCIAS = 20000;

function aSalida(ev, inicio, fin, origen, recurrente = false) {
  const todoElDia = inicio.isDate;
  return {
    uid: ev.uid,
    titulo: (ev.summary || "").trim(),
    desc: (ev.description || "").trim(),
    ubicacion: (ev.location || "").trim(),
    inicio: todoElDia ? inicio.toString() : inicio.toJSDate().toISOString(),
    fin: todoElDia ? fin.toString() : fin.toJSDate().toISOString(),
    todoElDia,
    recurrente,
    origen,
  };
}

/**
 * @param {string} textoIcs
 * @param {Date} desde  inicio del rango (incluido)
 * @param {Date} hasta  fin del rango (excluido)
 * @param {string} [origen]
 */
export function expandir(textoIcs, desde, hasta, origen = "") {
  registrarMadrid();
  const cal = new ICAL.Component(ICAL.parse(textoIcs));
  for (const tz of cal.getAllSubcomponents("vtimezone")) {
    const zona = new ICAL.Timezone(tz);
    if (!ICAL.TimezoneService.has(zona.tzid)) ICAL.TimezoneService.register(zona.tzid, zona);
  }

  const maestros = new Map();
  const excepciones = [];
  const canceladas = new Set();
  for (const comp of cal.getAllSubcomponents("vevent")) {
    if ((comp.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") {
      const rid = comp.getFirstPropertyValue("recurrence-id");
      if (rid) canceladas.add(`${comp.getFirstPropertyValue("uid")}|${rid.toJSDate().getTime()}`);
      continue;
    }
    const ev = new ICAL.Event(comp);
    if (comp.hasProperty("recurrence-id")) excepciones.push(ev);
    else maestros.set(ev.uid, ev);
  }
  const sueltas = [];
  for (const ex of excepciones) {
    const m = maestros.get(ex.uid);
    if (m) m.relateException(ex);
    else sueltas.push(ex);
  }

  const t0 = desde.getTime(), t1 = hasta.getTime();
  const solapa = (ini, fin) => {
    const a = ini.toJSDate().getTime();
    const b = Math.max(fin.toJSDate().getTime(), a + 1);
    return a < t1 && b > t0;
  };

  const salida = [];
  for (const ev of [...maestros.values(), ...sueltas]) {
    if (!ev.isRecurring()) {
      if (solapa(ev.startDate, ev.endDate)) salida.push(aSalida(ev, ev.startDate, ev.endDate, origen));
      continue;
    }
    const it = ev.iterator();
    for (let n = 0, sig; (sig = it.next()) && n < MAX_INSTANCIAS; n++) {
      if (sig.toJSDate().getTime() >= t1) break;
      if (canceladas.has(`${ev.uid}|${sig.toJSDate().getTime()}`)) continue;
      const det = ev.getOccurrenceDetails(sig);
      if (solapa(det.startDate, det.endDate)) salida.push(aSalida(det.item, det.startDate, det.endDate, origen, true));
    }
  }
  return salida.sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
}
