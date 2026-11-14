// Tests de los fallos encontrados en la revisión final.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planDay } from "../src/planificador.js";
import { clasificar, entregas } from "../src/clasificar.js";
import { caso, fijo, perfilBase, tarea, solapan } from "./helpers.js";

const de = (p, id) => p.bloques.filter(b => b.refId === id);
const min = (p, id) => de(p, id).reduce((s, b) => s + b.fin - b.inicio, 0);

// C2
test("C2: con 'ahora', las tareas se colocan a partir de ahora", () => {
  const p = planDay(caso({ fecha: "2026-11-22", ahora: 18 * 60, tareas: [tarea("t", "estudio", null, [45])] }));
  assert.ok(de(p, "t")[0].inicio >= 18 * 60);
});
test("C2: los pasos hechos no hacen retroceder el plan", () => {
  const t = tarea("t", "estudio", null, [45, 45, 60]); t.pasos[0].hecho = true;
  const p = planDay(caso({ fecha: "2026-11-22", ahora: 10 * 60, tareas: [t] }));
  assert.ok(de(p, "t").every(b => b.inicio >= 600));
});

// C3
test("C3: entre una clase con sitio y otra sin sitio no se vuelve a casa (no se solapa)", () => {
  const p = planDay(caso({ fijos: [fijo("a", 540, 660), fijo("b", 660, 780, { sitioId: null })] }));
  assert.equal(solapan(p.bloques), false);
});
test("C3: trabajo y luego entreno sin sitio: sin solapes", () => {
  const perfil = { ...perfilBase(), trabajo: [{ diaSemana: 0, inicio: 960, fin: 1200 }] };
  const p = planDay(caso({ perfil, fijos: [fijo("e", 1200, 1290, { tipo: "entreno", sitioId: null })] }));
  assert.equal(solapan(p.bloques), false);
});
test("C3: clase sin sitio reconocible → campus por defecto (con trayecto)", () => {
  const perfil = { ...perfilBase(), campusDefecto: "udg" };
  const ev = { uid: "x", titulo: "Algo raro", desc: "", ubicacion: "", inicio: "2026-11-16T08:00:00.000Z", fin: "2026-11-16T10:00:00.000Z", todoElDia: false, origen: "g", recurrente: true };
  assert.equal(clasificar([ev], "2026-11-16", perfil, {})[0].sitioId, "udg");
  const man = { ...ev, origen: "manual", tipoManual: "entreno" };
  assert.equal(clasificar([man], "2026-11-16", perfil, {})[0].sitioId, null);
});

// I1
test("I1: la noche se alarga como mucho hasta dejar el sueño mínimo antes de mañana", () => {
  const fijos = [fijo("c1", 540, 840), fijo("w", 960, 1200, { tipo: "trabajo", obligatorio: true, sitioId: "geieg" })];
  const p = planDay(caso({ fijos, levantarseManana: 6 * 60 + 55, tareas: [tarea("en", "entrega", "2026-11-17", Array(12).fill(90))] }));
  const fin = Math.max(...p.bloques.map(b => b.fin));
  assert.ok(fin <= 1440 + 6 * 60 + 55 - 4 * 60, `acaba a ${fin}`);
});

// I2
test("I2: un paso de 100 min se puede colocar", () => {
  const p = planDay(caso({ fecha: "2026-11-22", tareas: [tarea("t", "entrega", "2026-11-23", [100])] }));
  assert.equal(min(p, "t"), 100);
  assert.equal(p.avisos.some(a => a.tipo === "entrega-no-cabe"), false);
  assert.equal(p.avisos.some(a => a.tipo === "descanso-recortado"), false);
});

// I8
test("I8: el estudio para el examen de mañana va antes que una entrega dentro de 20 días", () => {
  const p = planDay(caso({ tareas: [tarea("en", "entrega", "2026-12-06", [60]), tarea("ex", "examen", "2026-11-17", [60])] }));
  assert.ok(de(p, "ex")[0].inicio < de(p, "en")[0].inicio);
});
test("I8: el día de la entrega no se trabaja después de la hora límite", () => {
  const p = planDay(caso({ fecha: "2026-11-22", tareas: [tarea("en", "entrega", "2026-11-22", [60, 60, 60], { horaLimite: 11 * 60 })] }));
  assert.ok(de(p, "en").every(b => b.fin <= 11 * 60));
});
test("I8: una entrega vencida no desaparece: aviso", () => {
  const p = planDay(caso({ tareas: [tarea("en", "entrega", "2026-11-15", [30])] }));
  assert.ok(p.avisos.some(a => a.tipo === "entrega-vencida"));
});
test("I8: hora límite del Moodle a las 00:00 → el día anterior", () => {
  const ev = { uid: "m", titulo: "Pràctica 3 venciment", desc: "", ubicacion: "", inicio: "2026-11-19T23:00:00.000Z", fin: "2026-11-19T23:00:00.000Z", todoElDia: false, origen: "moodle" };
  const [t] = entregas([ev], { calendarios: { moodle: "moodle" } });
  assert.deepEqual([t.fechaLimite, t.horaLimite], ["2026-11-19", 1440]);
});

// I3
test("I3: una entrega apuntada a mano se convierte en tarea", () => {
  const ev = { uid: "manual:1", titulo: "Pràctica 3", desc: "", ubicacion: "", inicio: "2026-11-20T09:00:00.000Z", fin: "2026-11-20T10:00:00.000Z", todoElDia: false, origen: "manual", tipoManual: "entrega" };
  assert.equal(entregas([ev], {}).length, 1);
  assert.equal(clasificar([ev], "2026-11-20", {}, {}).length, 0);
});

// I9
test("I9: una cena que acaba a la 01:00 no cambia la hora de levantarse", () => {
  const ev = { uid: "c", titulo: "Cena amigos", desc: "", ubicacion: "", inicio: "2026-11-15T21:00:00.000Z", fin: "2026-11-16T00:00:00.000Z", todoElDia: false, origen: "g" };
  const fijos = clasificar([ev], "2026-11-16", perfilBase(), {});
  assert.equal(fijos.length, 0);
});

// I11
test("I11: excepción de trabajo para una fecha (día libre)", () => {
  const perfil = { ...perfilBase(), trabajo: [{ diaSemana: 0, inicio: 960, fin: 1200 }], trabajoExcepciones: { "2026-11-16": null } };
  assert.equal(planDay(caso({ perfil })).bloques.some(b => b.tipo === "trabajo"), false);
  const p2 = planDay(caso({ perfil: { ...perfil, trabajoExcepciones: { "2026-11-16": { inicio: 1000, fin: 1100 } } } }));
  assert.deepEqual(p2.bloques.filter(b => b.tipo === "trabajo").map(b => [b.inicio, b.fin]), [[1000, 1100]]);
});

// I12
test("I12: un retraso durante una clase no se solapa con nada y empuja lo siguiente", () => {
  const p = planDay(caso({ fijos: [fijo("a", 540, 660), fijo("b", 670, 780)], tareas: [tarea("t", "estudio", null, [30])], overrides: { retrasos: [{ desde: 630, minutos: 30 }] } }));
  assert.equal(solapan(p.bloques), false);
});

test("C3: un evento suelto que no es de la uni (cena) no va al campus", () => {
  const ev = { uid: "y", titulo: "Cena con Marc", desc: "", ubicacion: "", inicio: "2026-11-16T19:00:00.000Z", fin: "2026-11-16T21:00:00.000Z", todoElDia: false, origen: "g" };
  const [f] = clasificar([ev], "2026-11-16", { ...perfilBase(), campusDefecto: "udg" }, {});
  assert.deepEqual([f.tipo, f.sitioId], ["otro", null]);
});
