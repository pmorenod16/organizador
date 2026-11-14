import { test } from "node:test";
import assert from "node:assert/strict";
import { validar, describir, aplicar } from "../src/acciones.js";

const estado = () => ({
  perfil: { trabajo: [{ diaSemana: 0, inicio: 960, fin: 1200 }], sitios: [{ id: "casa", nombre: "Casa" }] },
  tareas: [{ id: "t1", titulo: "Pràctica 2", tipo: "entrega", fechaLimite: "2026-11-20", sitioId: null, pasos: [{ id: "t1.1", titulo: "x", minutos: 30, hecho: false }] }],
  dia: { fecha: "2026-11-16", retrasos: [], marcas: {}, eventos: [] },
  refs: ["t1", "t1.1", "ev1"],
});

test("JSON inválido → ok:false", () => assert.equal(validar("{no es json").ok, false));
test("sin lista de acciones → ok:false", () => assert.equal(validar({ hola: 1 }).ok, false));
test("acción con tipo desconocido → ok:false", () => assert.equal(validar({ acciones: [{ tipo: "borrar-todo" }] }).ok, false));
test("refId inexistente → ok:false", () =>
  assert.equal(validar({ acciones: [{ tipo: "hecho", refId: "nope" }] }, ["t1"]).ok, false));
test("tarea: normaliza pasos y horas", () => {
  const r = validar({ acciones: [{ tipo: "tarea", titulo: "Estudiar T3", tipoTarea: "estudio", pasos: [{ titulo: "Leer", minutos: 30 }] }] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.acciones[0], { tipo: "tarea", tarea: { titulo: "Estudiar T3", tipo: "estudio", fechaLimite: null, sitioId: null, pasos: [{ titulo: "Leer", minutos: 30 }] } });
});
test("evento repetido: 'HH:MM' → minutos", () => {
  const r = validar({ acciones: [{ tipo: "evento", titulo: "Entreno", tipoEvento: "entreno", fecha: "2026-11-17", inicio: "20:00", fin: "21:30", diasSemana: [1, 3] }] });
  assert.deepEqual(r.acciones[0].evento, { titulo: "Entreno", tipo: "entreno", fecha: "2026-11-17", inicio: 1200, fin: 1290, repetir: { diasSemana: [1, 3] } });
});
test("aplicar tarea añade con id nuevo y pasos hecho:false", () => {
  const { acciones } = validar({ acciones: [{ tipo: "tarea", titulo: "N", tipoTarea: "estudio", pasos: [{ titulo: "a", minutos: 20 }] }] });
  const e = aplicar(estado(), acciones, { ahora: 600 });
  const t = e.tareas.at(-1);
  assert.ok(t.id && t.id !== "t1");
  assert.deepEqual(t.pasos.map(p => [p.hecho, p.minutos]), [[false, 20]]);
});
test("aplicar no muta el estado original", () => {
  const s = estado();
  aplicar(s, [{ tipo: "retraso", minutos: 20 }], { ahora: 600 });
  assert.equal(s.dia.retrasos.length, 0);
});
test("retraso → retrasos del día desde ahora", () =>
  assert.deepEqual(aplicar(estado(), [{ tipo: "retraso", minutos: 20 }], { ahora: 600 }).dia.retrasos, [{ desde: 600, minutos: 20 }]));
test("no-ir → marca asistir:false de esa instancia", () =>
  assert.deepEqual(aplicar(estado(), [{ tipo: "no-ir", refId: "ev1" }], { ahora: 0 }).dia.marcas.ev1, { asistir: false }));
test("hecho de un paso y de una tarea entera", () => {
  assert.equal(aplicar(estado(), [{ tipo: "hecho", refId: "t1.1" }], {}).tareas[0].pasos[0].hecho, true);
  assert.equal(aplicar(estado(), [{ tipo: "hecho", refId: "t1" }], {}).tareas[0].pasos.every(p => p.hecho), true);
});
test("aplazar → tarea.aplazadaHasta", () =>
  assert.equal(aplicar(estado(), [{ tipo: "aplazar", refId: "t1", fecha: "2026-11-18" }], {}).tareas[0].aplazadaHasta, "2026-11-18"));
test("trabajo-horario cambia perfil.trabajo; ninguna otra acción lo toca", () => {
  const otras = aplicar(estado(), [{ tipo: "retraso", minutos: 30 }, { tipo: "no-ir", refId: "ev1" }], { ahora: 900 });
  assert.deepEqual(otras.perfil.trabajo, estado().perfil.trabajo);
  const e = aplicar(estado(), validar({ acciones: [{ tipo: "trabajo-horario", diaSemana: 0, inicio: "15:00", fin: "19:00" }] }).acciones, {});
  assert.deepEqual(e.perfil.trabajo, [{ diaSemana: 0, inicio: 900, fin: 1140 }]);
});
test("describir", () => {
  assert.equal(describir({ tipo: "retraso", minutos: 20 }), "Retrasar el resto del día 20 min");
  assert.match(describir({ tipo: "trabajo-horario", diaSemana: 0, inicio: 900, fin: 1140 }), /lunes.*15:00.*19:00/);
});
test("evento → perfil.eventosManuales (sirve para días futuros y repetidos)", () => {
  const { acciones } = validar({ acciones: [{ tipo: "evento", titulo: "Entreno", tipoEvento: "entreno", fecha: "2026-11-17", inicio: "20:00", fin: "21:30", diasSemana: [1] }] });
  const e = aplicar(estado(), acciones, {});
  assert.deepEqual((({ titulo, tipo, inicio, repetir }) => ({ titulo, tipo, inicio, repetir }))(e.perfil.eventosManuales[0]), { titulo: "Entreno", tipo: "entreno", inicio: 1200, repetir: { diasSemana: [1] } });
});
test("hecho de un objetivo (gym) → dia.hechosObjetivo", () => {
  const s = estado(); s.perfil.objetivos = [{ id: "gym" }]; s.refs.push("gym");
  assert.equal(aplicar(s, [{ tipo: "hecho", refId: "gym" }], {}).dia.hechosObjetivo.gym, true);
});
