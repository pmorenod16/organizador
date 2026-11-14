import { test } from "node:test";
import assert from "node:assert/strict";
import { eventosManualesDelDia, combinarTareas, contarSemana, montarDia } from "../src/montar.js";
import { perfilBase } from "./helpers.js";

test("evento manual repetido aparece los días que toca, con hora local", () => {
  const perfil = { ...perfilBase(), eventosManuales: [{ id: "m1", titulo: "Entreno handbol", tipo: "entreno", fecha: "2026-11-17", inicio: 1200, fin: 1290, repetir: { diasSemana: [1, 3] } }] };
  assert.equal(eventosManualesDelDia(perfil, "2026-11-16").length, 0);
  const [e] = eventosManualesDelDia(perfil, "2026-11-19");
  assert.deepEqual([e.uid, e.inicio, e.tipoManual], ["manual:m1", "2026-11-19T19:00:00.000Z", "entreno"]);
});
test("evento manual repetido no aparece antes de su fecha de inicio", () => {
  const perfil = { ...perfilBase(), eventosManuales: [{ id: "m1", titulo: "x", tipo: "entreno", fecha: "2026-11-17", inicio: 1200, fin: 1290, repetir: { diasSemana: [0] } }] };
  assert.equal(eventosManualesDelDia(perfil, "2026-11-16").length, 0);
  assert.equal(eventosManualesDelDia(perfil, "2026-11-23").length, 1);
});
test("tarea guardada gana a la entrega generada del calendario con el mismo id", () => {
  const gen = [{ id: "ical:a", titulo: "A", pasos: [{ id: "p", hecho: false }] }, { id: "ical:b", titulo: "B", pasos: [] }];
  const guardadas = [{ id: "ical:a", titulo: "A", pasos: [{ id: "p", hecho: true }] }, { id: "t1", titulo: "T", pasos: [] }];
  assert.deepEqual(combinarTareas(gen, guardadas).map(t => [t.id, t.pasos[0]?.hecho]), [["ical:a", true], ["t1", undefined], ["ical:b", undefined]]);
});
test("contarSemana suma los días con el objetivo hecho de lunes a hoy", () => {
  const dias = { "2026-11-16": { hechosObjetivo: { gym: true } }, "2026-11-18": { hechosObjetivo: { gym: true, abuelos: true } }, "2026-11-09": { hechosObjetivo: { gym: true } } };
  assert.deepEqual(contarSemana(dias, "2026-11-19"), { gym: 2, abuelos: 1 });
});
test("montarDia junta fijos, marcas del perfil y del día, retrasos y tareas", () => {
  const perfil = { ...perfilBase(), marcas: { s1: { tipo: "practica" } } };
  const ev = [{ uid: "s1", titulo: "Sesión 4", desc: "", ubicacion: "", inicio: "2026-11-16T08:00:00.000Z", fin: "2026-11-16T10:00:00.000Z", todoElDia: false, origen: "g" }];
  const e = montarDia({ fecha: "2026-11-16", eventos: ev, perfil, tareas: [], dias: { "2026-11-16": { retrasos: [{ desde: 600, minutos: 10 }], marcas: {} } } });
  assert.equal(e.fijos[0].tipo, "practica");
  assert.deepEqual(e.overrides.retrasos, [{ desde: 600, minutos: 10 }]);
});
test("el lunes no cuenta lo hecho la semana anterior", () => {
  const perfil = perfilBase();
  const e = montarDia({ fecha: "2026-11-16", eventos: [], perfil, tareas: [], dias: { "2026-11-15": { hechosObjetivo: { gym: true } } } });
  assert.deepEqual(e.semana.hechosObjetivo, {});
});
