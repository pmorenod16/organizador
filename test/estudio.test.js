import { test } from "node:test";
import assert from "node:assert/strict";
import { estudioDelDia, montarDia } from "../src/montar.js";
import { planDay } from "../src/planificador.js";
import { perfilPorDefecto } from "../src/perfil.js";
import { huecosLibres } from "../src/vistas/libre.js";

const perfil = () => ({ ...perfilPorDefecto(), asignaturas: [{ nombre: "Teoria de Circuits", sitioId: "udg" }, { nombre: "Imatge Mèdica", sitioId: "udg" }, { nombre: "Fonaments d'Electrònica", sitioId: "udg" }] });
const examen = (titulo, iso) => ({ uid: titulo, titulo, desc: "", ubicacion: "", inicio: iso, fin: iso, todoElDia: false, origen: "g" });

test("sin tareas dictadas, el día tiene estudio para examen (minutosDia por defecto 180)", () => {
  const t = estudioDelDia(perfil(), "2026-11-15", []);
  assert.equal(t.reduce((s, x) => s + x.pasos.reduce((a, p) => a + p.minutos, 0), 0), 180);
  assert.ok(t.every(x => x.tipo === "estudio" && x.id.startsWith("auto:2026-11-15:")));
});
test("la asignatura con examen más cercano va primero y se lleva más tiempo", () => {
  const t = estudioDelDia(perfil(), "2026-11-15", [examen("Examen Imatge Mèdica", "2026-11-19T08:00:00.000Z")]);
  assert.equal(t[0].titulo, "Estudiar Imatge Mèdica (examen el jueves 19)");
  const min = x => x.pasos.reduce((a, p) => a + p.minutos, 0);
  assert.ok(min(t[0]) > min(t[1]));
});
test("sin asignaturas configuradas: un bloque genérico que lo recuerda", () => {
  const t = estudioDelDia({ ...perfilPorDefecto(), asignaturas: [] }, "2026-11-15", []);
  assert.equal(t.length, 1);
  assert.match(t[0].titulo, /Estudiar/);
});
test("minutosDia 0 → sin estudio automático", () => {
  assert.equal(estudioDelDia({ ...perfil(), estudio: { minutosDia: 0 } }, "2026-11-15", []).length, 0);
});
test("el plan de un domingo vacío tiene horas de estudio", () => {
  const e = montarDia({ fecha: "2026-11-15", eventos: [], perfil: perfil(), tareas: [], dias: {} });
  e.ahora = 8 * 60 + 34;
  const p = planDay(e);
  const est = p.bloques.filter(b => b.tipo === "estudio").reduce((s, b) => s + b.fin - b.inicio, 0);
  assert.ok(est >= 170, `estudio ${est}`);
});
test("los pasos hechos del estudio automático se respetan (la tarea guardada gana)", () => {
  const p = perfil();
  const [t] = estudioDelDia(p, "2026-11-15", []);
  const guardada = { ...t, pasos: t.pasos.map(x => ({ ...x, hecho: true })) };
  const e = montarDia({ fecha: "2026-11-15", eventos: [], perfil: p, tareas: [guardada], dias: {} });
  assert.ok(e.tareas.find(x => x.id === t.id).pasos.every(x => x.hecho));
});
test("huecos libres: los tramos ≥ 20 min sin nada entre levantarse y dormir", () => {
  const plan = { horaLevantarse: 480, bloques: [{ inicio: 480, fin: 520 }, { inicio: 600, fin: 610 }, { inicio: 625, fin: 700 }] };
  assert.deepEqual(huecosLibres(plan, 720).map(h => [h.inicio, h.fin]), [[520, 600], [700, 720]]);
});
test("no quedan pasos de estudio de menos de 30 min si la asignatura tiene más tiempo", () => {
  const t = estudioDelDia(perfil(), "2026-11-15", [examen("Examen Imatge Mèdica", "2026-11-19T08:00:00.000Z")]);
  for (const x of t) {
    const total = x.pasos.reduce((a, p) => a + p.minutos, 0);
    if (total >= 30) assert.ok(x.pasos.every(p => p.minutos >= 30), JSON.stringify(x.pasos.map(p => p.minutos)));
  }
});
test("la primera semana de uso no avisa de objetivos incumplibles", () => {
  const p = { ...perfil(), creadoEl: "2026-11-15" };
  const e = montarDia({ fecha: "2026-11-15", eventos: [], perfil: p, tareas: [], dias: {} });
  assert.equal(planDay(e).avisos.some(a => a.tipo === "objetivo-incumplible"), false);
  const e2 = montarDia({ fecha: "2026-11-22", eventos: [], perfil: p, tareas: [], dias: {} });
  assert.equal(planDay(e2).avisos.some(a => a.tipo === "objetivo-incumplible"), true);
});
