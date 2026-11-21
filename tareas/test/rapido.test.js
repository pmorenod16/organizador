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
