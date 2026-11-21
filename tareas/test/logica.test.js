import { test } from "node:test";
import assert from "node:assert/strict";
import { siguienteFecha, deVista, hijosPorPadre, progreso, racha, siguienteTarea } from "../src/logica.js";

const hoy = "2026-11-21";
test("repeticiones", () => {
  assert.equal(siguienteFecha("2026-11-21", { cada: "dia", n: 1 }, hoy), "2026-11-22");
  assert.equal(siguienteFecha("2026-11-21", { cada: "semana", n: 2 }, hoy), "2026-12-05");
  assert.equal(siguienteFecha("2026-01-31", { cada: "mes", n: 1 }, "2026-01-31"), "2026-02-28");
  assert.equal(siguienteFecha("2026-11-20", { cada: "laborables" }, hoy), "2026-11-23"); // viernes → lunes
  assert.equal(siguienteFecha("2026-11-01", { cada: "dia", n: 1 }, hoy), "2026-11-21"); // atrasada: salta a hoy
});
test("vistas y subtareas", () => {
  const t = [
    { id: "a", titulo: "Sesión", fecha: hoy, prioridad: 3 },
    { id: "a1", titulo: "Paso", padreId: "a", fecha: hoy, hecha: true },
    { id: "a2", titulo: "Paso 2", padreId: "a", fecha: "2026-11-25" },
    { id: "b", titulo: "Atrasada", fecha: "2026-11-19", prioridad: 1 },
    { id: "c", titulo: "Bandeja" },
  ];
  assert.deepEqual(deVista("hoy", t, hoy).map(x => x.id), ["b", "a"]);
  assert.deepEqual(deVista("proximos", t, hoy).map(x => x.id), ["b", "a", "a2"]);
  assert.deepEqual(deVista("bandeja", t, hoy).map(x => x.id), ["a", "b", "c"]);
  assert.deepEqual(progreso("a", hijosPorPadre(t)), { hechas: 1, total: 2 });
  assert.equal(siguienteTarea(t, hoy, "10:00").id, "b");
  assert.deepEqual(deVista("buscar", t, hoy, { q: "sesion" }).map(x => x.id), ["a"]);
});
test("racha", () => {
  assert.equal(racha(["2026-11-19", "2026-11-20", "2026-11-21"], hoy), 3);
  assert.equal(racha(["2026-11-19", "2026-11-20"], hoy), 2);
  assert.equal(racha(["2026-11-18"], hoy), 0);
});
