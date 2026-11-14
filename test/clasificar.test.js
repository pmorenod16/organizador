import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificar, entregas } from "../src/clasificar.js";

const F = "2026-11-16";
const perfil = {
  sitios: [{ id: "casa", nombre: "Casa" }, { id: "montilivi", nombre: "Montilivi" }, { id: "barri", nombre: "Barri Vell" }],
  asignaturas: [{ nombre: "Teoria de Circuits", sitioId: "montilivi" }, { nombre: "Imatge Mèdica", sitioId: "barri" }],
  calendarios: { moodle: "https://moodle/cal.ics" },
};
let n = 0;
const ev = (titulo, extra = {}) => ({ uid: `u${++n}`, titulo, desc: "", ubicacion: "", inicio: "2026-11-16T08:00:00.000Z", fin: "2026-11-16T10:00:00.000Z", todoElDia: false, origen: "https://g/cal.ics", ...extra });
const uno = (e, marcas = {}) => clasificar([e], F, perfil, marcas)[0];

test("Pràctica → practica obligatoria", () => assert.deepEqual(
  (({ tipo, obligatorio }) => ({ tipo, obligatorio }))(uno(ev("Pràctica 2 Teoria de Circuits"))), { tipo: "practica", obligatorio: true }));
test("Laboratori → practica", () => assert.equal(uno(ev("Laboratori Fonaments d'Electrònica")).tipo, "practica"));
test("Examen / Prova / Parcial → examen obligatorio", () => {
  for (const t of ["Examen final TC", "Prova parcial", "Parcial Imatge"]) {
    const e = uno(ev(t)); assert.equal(e.tipo, "examen", t); assert.equal(e.obligatorio, true);
  }
});
test("clase normal → clase, obligatorio false, asistir true", () => {
  const e = uno(ev("Teoria de Circuits"));
  assert.deepEqual([e.tipo, e.obligatorio, e.asistir, e.inicio, e.fin], ["clase", false, true, 540, 660]);
});
test("Entreno handbol / Partit → entreno / partido", () => {
  assert.equal(uno(ev("Entreno handbol")).tipo, "entreno");
  assert.equal(uno(ev("Partit futbol UdG")).tipo, "partido");
});
test("marca manual gana a la heurística", () => {
  const e = ev("Pràctica 3");
  const r = uno(e, { [e.uid]: { obligatorio: false, tipo: "clase" } });
  assert.deepEqual([r.tipo, r.obligatorio], ["clase", false]);
});
test("marca por instancia (id) para no ir solo ese día", () => {
  const e = ev("Teoria de Circuits");
  const id = uno(e).id;
  assert.equal(uno(e, { [id]: { asistir: false } }).asistir, false);
});
test("sitio: ubicación con 'Montilivi' → montilivi; si no, el de la asignatura", () => {
  assert.equal(uno(ev("Algo", { ubicacion: "Campus Montilivi, P4" })).sitioId, "montilivi");
  assert.equal(uno(ev("Imatge Mèdica teoria")).sitioId, "barri");
  assert.equal(uno(ev("Cena")).sitioId, null);
});
test("mismo examen en dos calendarios → uno", () => {
  const a = ev("Examen Teoria de Circuits"), b = ev("EXAMEN  teoria de circuits", { origen: "https://ext/cal.ics" });
  assert.equal(clasificar([a, b], F, perfil, {}).length, 1);
});
test("eventos de otro día y de todo el día no son bloques", () => {
  assert.equal(clasificar([ev("x", { inicio: "2026-11-17T08:00:00.000Z", fin: "2026-11-17T09:00:00.000Z" }),
    ev("y", { todoElDia: true, inicio: "2026-11-16", fin: "2026-11-17" })], F, perfil, {}).length, 0);
});
test("entregas: eventos del Moodle y títulos de entrega → tareas con fecha límite", () => {
  const t = entregas([ev("Pràctica 2 venciment", { origen: "https://moodle/cal.ics", inicio: "2026-11-20T22:59:00.000Z" }),
    ev("Entrega memòria", { todoElDia: true, inicio: "2026-12-01", fin: "2026-12-02" }), ev("Teoria de Circuits")], perfil);
  assert.deepEqual(t.map(x => [x.tipo, x.fechaLimite]), [["entrega", "2026-11-20"], ["entrega", "2026-12-01"]]);
  assert.ok(t[0].id.startsWith("ical:"));
  assert.equal(t[0].pasos.length, 1);
});
test("Feina / Treball / Trabajo del calendario → trabajo obligatorio", () => {
  for (const t of ["Feina – Sant Ponç", "Treball (POL) – Sant Ponç", "Trabajo GEiEG"]) {
    const e = uno(ev(t));
    assert.deepEqual([e.tipo, e.obligatorio], ["trabajo", true], t);
  }
});
