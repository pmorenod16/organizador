import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expandir } from "../src/ical.js";

const fx = n => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");
const semanal = fx("semanal.ics");
const inicios = (txt, a, b) => expandir(txt, new Date(a), new Date(b)).filter(e => !e.todoElDia).map(e => e.inicio);

test("clase semanal con EXDATE y una instancia movida", () => {
  assert.deepEqual(inicios(semanal, "2026-11-16", "2026-12-01"), ["2026-11-16T08:00:00.000Z", "2026-11-30T11:00:00.000Z"]);
});
test("cambio de hora: 09:00 local antes y después del 25/10/2026", () => {
  assert.deepEqual(inicios(semanal, "2026-10-19", "2026-10-27"), ["2026-10-19T07:00:00.000Z", "2026-10-26T08:00:00.000Z"]);
});
test("evento de todo el día", () => {
  const ev = expandir(semanal, new Date("2026-12-01"), new Date("2026-12-02")).filter(e => e.todoElDia);
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].inicio, ev[0].fin, ev[0].titulo], ["2026-12-01", "2026-12-02", "Entrega memòria"]);
});
test("campos de la instancia: título, ubicación, uid y recurrente", () => {
  const [e] = expandir(semanal, new Date("2026-11-16"), new Date("2026-11-17"));
  assert.deepEqual([e.uid, e.titulo, e.ubicacion, e.todoElDia, e.fin, e.recurrente], ["clase1@google.com", "Teoria de Circuits", "Campus Montilivi, P4", false, "2026-11-16T10:00:00.000Z", true]);
});
const raro = fx("raro.ics");
test("instancia cancelada (RECURRENCE-ID + STATUS:CANCELLED) no aparece", () => {
  assert.deepEqual(inicios(raro, "2026-11-16", "2026-11-24").filter(i => i.startsWith("2026-11-16") || i.startsWith("2026-11-23")), ["2026-11-16T08:00:00.000Z"]);
});
test("hora flotante y TZID sin VTIMEZONE se leen como hora de Madrid", () => {
  const ev = expandir(raro, new Date("2026-11-18"), new Date("2026-11-20")).map(e => [e.titulo, e.inicio]);
  assert.deepEqual(ev, [["Examen flotante", "2026-11-18T09:00:00.000Z"], ["Examen sin zona", "2026-11-19T09:00:00.000Z"]]);
});
