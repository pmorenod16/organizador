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
