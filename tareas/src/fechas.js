// Fechas en hora local como texto "AAAA-MM-DD" (y horas "HH:MM"). Sin dependencias.
const pad = n => String(n).padStart(2, "0");

export const fechaDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoyISO = (ahora = new Date()) => fechaDe(ahora);
export const aDate = (f, h = "00:00") => { const [a, m, d] = f.split("-").map(Number); const [hh, mm] = h.split(":").map(Number); return new Date(a, m - 1, d, hh || 0, mm || 0); };
export const sumarDias = (f, n) => { const d = aDate(f); d.setDate(d.getDate() + n); return fechaDe(d); };
export const sumarMeses = (f, n) => {
  const [a, m, d] = f.split("-").map(Number);
  const x = new Date(a, m - 1 + n, 1);
  const ultimo = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d, ultimo));
  return fechaDe(x);
};
export const diasEntre = (a, b) => Math.round((aDate(b) - aDate(a)) / 864e5);
/** 0 = lunes … 6 = domingo */
export const diaSemana = f => (aDate(f).getDay() + 6) % 7;
export const lunesDe = f => sumarDias(f, -diaSemana(f));
export const esFecha = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const esHora = s => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "Hoy", "Mañana", "Ayer", "lunes 23", "23 nov", "23 nov 2027" */
export function fechaBonita(f, hoy = hoyISO()) {
  if (!f) return "";
  const d = diasEntre(hoy, f);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  const [a, m, dia] = f.split("-").map(Number);
  if (d > 1 && d < 7) return `${DIAS[diaSemana(f)]} ${dia}`;
  return `${dia} ${MESES[m - 1].slice(0, 3)}${a !== Number(hoy.slice(0, 4)) ? " " + a : ""}`;
}
export function fechaLarga(f) {
  const [, m, d] = f.split("-").map(Number);
  return `${DIAS[diaSemana(f)]} ${d} de ${MESES[m - 1]}`;
}
export const minutosTexto = min => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? " " + (min % 60) + " min" : ""}` : `${min} min`);
