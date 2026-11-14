// Conversión entre instantes y «minutos locales»: minutos desde las 00:00 del día
// planificado en Europe/Madrid (negativos = noche anterior, > 1440 = pasada la medianoche).
export const ZONA = "Europe/Madrid";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

function partes(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}

const diasEntre = (a, b) => Math.round((Date.UTC(...b.split("-").map((v, i) => +v - (i === 1))) - Date.UTC(...a.split("-").map((v, i) => +v - (i === 1)))) / 86400000);

/** @returns {string} fecha local "YYYY-MM-DD" de un instante */
export const fechaLocal = (date = new Date()) => partes(date).fecha;

/** @param {string} iso instante ISO (o "YYYY-MM-DD" para todo el día) @param {string} fecha */
export function aMinutos(iso, fecha) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return diasEntre(fecha, iso) * 1440;
  const p = partes(new Date(iso));
  return diasEntre(fecha, p.fecha) * 1440 + p.min;
}

/** Instante correspondiente a unos minutos locales de una fecha. */
export function deMinutos(min, fecha) {
  const [y, m, d] = fecha.split("-").map(Number);
  let t = Date.UTC(y, m - 1, d, 0, min);
  for (let i = 0; i < 2; i++) t += (min - aMinutos(new Date(t).toISOString(), fecha)) * 60000;
  return new Date(t);
}

/** 0 = lunes … 6 = domingo */
export const diaSemana = fecha => (new Date(fecha + "T12:00:00Z").getUTCDay() + 6) % 7;

export function sumarDias(fecha, n) {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "HH:MM" para mostrar unos minutos locales */
export function hhmm(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
