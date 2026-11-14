// Lee un calendario .ics y devuelve las instancias que caen entre dos fechas,
// con las repeticiones (RRULE), los días quitados (EXDATE) y las instancias movidas
// (RECURRENCE-ID) ya resueltas.
import ICAL from "ical.js";

const MAX_INSTANCIAS = 2000;

function aSalida(ev, inicio, fin, origen) {
  const todoElDia = inicio.isDate;
  return {
    uid: ev.uid,
    titulo: (ev.summary || "").trim(),
    desc: (ev.description || "").trim(),
    ubicacion: (ev.location || "").trim(),
    inicio: todoElDia ? inicio.toString() : inicio.toJSDate().toISOString(),
    fin: todoElDia ? fin.toString() : fin.toJSDate().toISOString(),
    todoElDia,
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
  const cal = new ICAL.Component(ICAL.parse(textoIcs));
  for (const tz of cal.getAllSubcomponents("vtimezone")) {
    const zona = new ICAL.Timezone(tz);
    if (!ICAL.TimezoneService.has(zona.tzid)) ICAL.TimezoneService.register(zona.tzid, zona);
  }

  const maestros = new Map();
  const excepciones = [];
  for (const comp of cal.getAllSubcomponents("vevent")) {
    if ((comp.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") continue;
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
      const det = ev.getOccurrenceDetails(sig);
      if (solapa(det.startDate, det.endDate)) salida.push(aSalida(det.item, det.startDate, det.endDate, origen));
    }
  }
  return salida.sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
}
