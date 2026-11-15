import { test } from "node:test";
import assert from "node:assert/strict";
import { perfilPorDefecto, completarPerfil } from "../src/perfil.js";
import { trayecto } from "../src/planificador.js";

test("valores por defecto del spec", () => {
  const p = perfilPorDefecto();
  assert.equal(trayecto(p, "casa", "udg"), 15);
  assert.equal(trayecto(p, "casa", "geieg"), 15);
  assert.equal(trayecto(p, "casa", "gym"), 10);
  assert.equal(p.minSleepHours, 4);
  assert.equal(p.margen, 10);
  assert.equal(p.objetivos.find(o => o.id === "gym").vecesSemana, 3);
  assert.equal(p.trabajoSitioId, "geieg");
});
test("completarPerfil rellena lo que falte sin pisar lo guardado", () => {
  const p = completarPerfil({ margen: 5, calendarios: { google: "g" } });
  assert.equal(p.margen, 5);
  assert.equal(p.calendarios.google, "g");
  assert.equal(p.calendarios.moodle, "");
  assert.equal(p.minSleepHours, 4);
});
test("horario del gym: L-V 6:30-22, sábado 7-14, domingo 8-14; se añade a un perfil guardado sin horario", () => {
  const esperado = [0, 1, 2, 3, 4].map(d => ({ diaSemana: d, inicio: 390, fin: 1320 })).concat([{ diaSemana: 5, inicio: 420, fin: 840 }, { diaSemana: 6, inicio: 480, fin: 840 }]);
  assert.deepEqual(perfilPorDefecto().objetivos.find(o => o.id === "gym").horario, esperado);
  const guardado = completarPerfil({ objetivos: [{ id: "gym", titulo: "Gym", tipo: "gym", vecesSemana: 4, minutos: 75, sitioId: "gym" }] });
  const g = guardado.objetivos.find(o => o.id === "gym");
  assert.deepEqual([g.vecesSemana, g.horario], [4, esperado]);
  assert.deepEqual(completarPerfil({ objetivos: [{ id: "gym", tipo: "gym", horario: [] }] }).objetivos[0].horario, []);
});
