import { test } from "node:test";
import assert from "node:assert/strict";
import { analizar, buscarProyecto } from "../src/rapido.js";

const hoy = "2026-11-21"; // sábado
const proyectos = [
  { id: "tc", nombre: "Teoria de Circuits" },
  { id: "fe", nombre: "Fonaments d'Electrònica" },
  { id: "emd", nombre: "Equips de Monitorització i Diagnòstic" },
];
const a = t => analizar(t, { hoy, proyectos });

test("fecha, hora, proyecto por iniciales y prioridad", () => {
  const r = a("Problemas 1-3 mañana 18:00 #TC !1");
  assert.equal(r.titulo, "Problemas 1-3");
  assert.equal(r.fecha, "2026-11-22");
  assert.equal(r.hora, "18:00");
  assert.equal(r.proyectoId, "tc");
  assert.equal(r.prioridad, 1);
});
test("apartados y rangos no se confunden con horas ni fechas", () => {
  const r = a("Apartat 3.2 i problemes 1-3 tema 2.15");
  assert.equal(r.fecha, null); assert.equal(r.hora, null);
  assert.equal(r.titulo, "Apartat 3.2 i problemes 1-3 tema 2.15");
});
test("días de la semana, dd/mm y meses", () => {
  assert.equal(a("Repaso el lunes").fecha, "2026-11-23");
  assert.equal(a("Repaso sábado").fecha, "2026-11-28");
  assert.equal(a("Examen 13/01").fecha, "2027-01-13");
  assert.equal(a("Examen 15 de enero").fecha, "2027-01-15");
  assert.equal(a("Algo 25/11/2026").fecha, "2026-11-25");
  assert.equal(a("Algo en 3 días").fecha, "2026-11-24");
  assert.equal(a("Algo pasado mañana").fecha, "2026-11-23");
});
test("horas variadas", () => {
  assert.equal(a("Gym a las 6").hora, "18:00");
  assert.equal(a("Gym 9h").hora, "09:00");
  assert.equal(a("Gym 7pm").hora, "19:00");
  assert.equal(a("Gym 9h").fecha, hoy);
  assert.equal(a("Estudiar 3 h").hora, null);
});
test("repeticiones y etiquetas", () => {
  const r = a("Repasar errores cada semana @repaso #fonaments");
  assert.deepEqual(r.repetir, { cada: "semana", n: 1 });
  assert.deepEqual(r.etiquetas, ["repaso"]);
  assert.equal(r.proyectoId, "fe");
  assert.equal(r.fecha, hoy);
  const v = a("Balonmano cada viernes 20:30");
  assert.deepEqual(v.repetir, { cada: "semana", n: 1 });
  assert.equal(v.fecha, "2026-11-27");
  assert.deepEqual(a("Leer cada 2 días").repetir, { cada: "dia", n: 2 });
});
test("un # que no es proyecto se queda en el título", () => {
  const r = a("Comprar #regalo");
  assert.equal(r.titulo, "Comprar #regalo"); assert.equal(r.proyectoId, null);
});
test("buscarProyecto por palabra", () => {
  assert.equal(buscarProyecto("#monitoritzacio", proyectos).id, "emd");
  assert.equal(buscarProyecto("emd", proyectos).id, "emd");
});

test("frases dichas: hora en letra, prioridad y asignatura sin #", () => {
  const r = a("Repasar la ley de Ohm mañana a las seis de la tarde con prioridad alta de teoría de circuitos");
  assert.equal(r.titulo, "Repasar la ley de Ohm");
  assert.equal(r.fecha, "2026-11-22"); assert.equal(r.hora, "18:00");
  assert.equal(r.prioridad, 2); assert.equal(r.proyectoId, "tc");
});
test("frases dichas: horas", () => {
  assert.equal(a("Llamar a las diez y media de la mañana").hora, "10:30");
  assert.equal(a("Llamar a las 6:00").hora, "18:00");          // el teclado escribe «6:00» al decir «a las seis»
  assert.equal(a("Llamar a las 9:00 de la mañana").hora, "09:00");
  assert.equal(a("Llamar a las ocho menos cuarto de la tarde").hora, "19:45");
  assert.equal(a("Comer a mediodía").hora, "12:00");
  assert.equal(a("Cena a las nueve de la noche").hora, "21:00");
});
test("frases dichas: fechas y repeticiones", () => {
  assert.equal(a("Entrega el lunes que viene").fecha, "2026-11-23");
  assert.equal(a("Revisar la semana que viene").fecha, "2026-11-23");
  assert.equal(a("Repasar dentro de tres días").fecha, "2026-11-24");
  assert.equal(a("Pagar el día 5").fecha, "2026-12-05");
  assert.equal(a("Pagar el día 28").fecha, "2026-11-28");
  assert.deepEqual(a("Leer cada dos días").repetir, { cada: "dia", n: 2 });
  assert.equal(a("Examen el 15 de enero").fecha, "2027-01-15");
});
test("frases dichas: puntuación, hashtag, urgente y mayúscula", () => {
  const r = a("comprar cable para la PCB mañana, urgente.");
  assert.equal(r.titulo, "Comprar cable para la PCB"); assert.equal(r.prioridad, 1); assert.equal(r.fecha, "2026-11-22");
  assert.equal(a("Problemas hashtag fonaments").proyectoId, "fe");
  assert.equal(a("Estudiar para fonaments d'electrònica").proyectoId, "fe");
  assert.equal(a("Ver monitorización proyecto equips").proyectoId, "emd");
  assert.equal(a("Una tarea cualquiera").titulo, "Una tarea cualquiera");
  assert.equal(a("Problemes de circuits elèctrics").proyectoId, null); // «circuits» suelto, sin «de teoria», no basta… salvo conector + palabra larga
});
