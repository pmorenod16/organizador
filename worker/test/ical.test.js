import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { expandir } from "../src/ical.js";

const semanal = readFileSync(new URL("./fixtures/semanal.ics", import.meta.url), "utf8");
const inicios = (a, b) => expandir(semanal, new Date(a), new Date(b)).filter(e => !e.todoElDia).map(e => e.inicio);

test("clase semanal con EXDATE y una instancia movida", () => {
  expect(inicios("2026-11-16", "2026-12-01")).toEqual([
    "2026-11-16T08:00:00.000Z", "2026-11-30T11:00:00.000Z"]);
});

test("cambio de hora: 09:00 local antes y después del 25/10/2026", () => {
  expect(inicios("2026-10-19", "2026-10-27")).toEqual([
    "2026-10-19T07:00:00.000Z", "2026-10-26T08:00:00.000Z"]);
});

test("evento de todo el día", () => {
  const ev = expandir(semanal, new Date("2026-12-01"), new Date("2026-12-02")).filter(e => e.todoElDia);
  expect(ev).toHaveLength(1);
  expect(ev[0]).toMatchObject({ inicio: "2026-12-01", fin: "2026-12-02", titulo: "Entrega memòria" });
});

test("campos de la instancia: título, ubicación y uid", () => {
  const [e] = expandir(semanal, new Date("2026-11-16"), new Date("2026-11-17"));
  expect(e).toMatchObject({ uid: "clase1@google.com", titulo: "Teoria de Circuits", ubicacion: "Campus Montilivi, P4", todoElDia: false, fin: "2026-11-16T10:00:00.000Z" });
});
