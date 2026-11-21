import { test } from "node:test";
import assert from "node:assert/strict";
import { enlazar, parecido } from "../src/sesiones.js";

const proyectos = [{ id: "tc", nombre: "Teoria de Circuits" }, { id: "fe", nombre: "Fonaments d'Electrònica" }, { id: "em", nombre: "Equips de Monitorització" }];
const ev = (id, titulo, ini = "15:45", fin = "17:45") => ({ id, titulo, ini: "2026-11-23T" + ini, fin: "2026-11-23T" + fin, todoElDia: false });
const tareas = [
  { id: "t1", titulo: "Conceptes bàsics", fecha: "2026-11-23", proyectoId: "tc" },
  { id: "t2", titulo: "Components passius", fecha: "2026-11-23", proyectoId: "fe" },
  { id: "t3", titulo: "Lleis fonamentals (1/2)", fecha: "2026-11-24", proyectoId: "tc" },
  { id: "p1", titulo: "Teoria", fecha: "2026-11-23", proyectoId: "tc", padreId: "t1" },
];

test("enlaza cada sesión del calendario con su tarea del mismo día", () => {
  const evs = [ev("a", "TC – Conceptes bàsics"), ev("b", "FE – Components passius", "18:00", "20:00"), ev("c", "Treball", "09:00", "13:00"), ev("g", "Gym", "20:20", "21:50")];
  const { porEvento, porTarea } = enlazar("2026-11-23", evs, tareas, proyectos);
  assert.equal(porEvento.get("a").id, "t1");
  assert.equal(porEvento.get("b").id, "t2");
  assert.equal(porEvento.has("c"), false);
  assert.equal(porEvento.has("g"), false);
  assert.equal(porTarea.get("t1").id, "a");
});
test("no enlaza tareas de otro día ni eventos de todo el día", () => {
  const evs = [ev("x", "TC – Lleis fonamentals (1/2)"), { ...ev("y", "TC – Conceptes bàsics"), todoElDia: true }];
  const r = enlazar("2026-11-23", evs, tareas, proyectos);
  assert.equal(r.porEvento.size, 0);
});
test("el enlace hecho a mano manda", () => {
  const t = [{ id: "m", titulo: "Repàs", fecha: "2026-11-23", enlace: "z" }, ...tareas];
  const r = enlazar("2026-11-23", [ev("z", "Estudi a la biblioteca")], t, proyectos);
  assert.equal(r.porEvento.get("z").id, "m");
});
test("la asignatura desempata", () => {
  const ts = [{ id: "a", titulo: "Problemes", fecha: "2026-11-23", proyectoId: "fe" }, { id: "b", titulo: "Problemes", fecha: "2026-11-23", proyectoId: "tc" }];
  assert.equal(enlazar("2026-11-23", [ev("e", "TC – Problemes")], ts, proyectos).porEvento.get("e").id, "b");
  assert.ok(parecido(ev("e", "EMD – Introducció i mostreig"), { titulo: "Introducció i mostreig" }, proyectos[2]) >= 3);
});
