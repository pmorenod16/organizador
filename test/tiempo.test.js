import { test } from "node:test";
import assert from "node:assert/strict";
import { aMinutos, deMinutos, diaSemana, sumarDias } from "../src/tiempo.js";

test("09:00 en Madrid en invierno → 540", () => assert.equal(aMinutos("2026-11-16T08:00:00.000Z", "2026-11-16"), 540));
test("09:00 en Madrid en verano → 540", () => assert.equal(aMinutos("2026-10-19T07:00:00.000Z", "2026-10-19"), 540));
test("23:30 del día anterior → -30", () => assert.equal(aMinutos("2026-11-15T22:30:00.000Z", "2026-11-16"), -30));
test("00:30 del día siguiente → 1470", () => assert.equal(aMinutos("2026-11-16T23:30:00.000Z", "2026-11-16"), 1470));
test("deMinutos invierte aMinutos", () => assert.equal(deMinutos(540, "2026-11-16").toISOString(), "2026-11-16T08:00:00.000Z"));
test("diaSemana: lunes 16/11/2026 → 0, domingo → 6", () => {
  assert.equal(diaSemana("2026-11-16"), 0);
  assert.equal(diaSemana("2026-11-22"), 6);
});
test("sumarDias cruza meses", () => assert.equal(sumarDias("2026-11-30", 1), "2026-12-01"));
