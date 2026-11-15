import { test } from "node:test";
import assert from "node:assert/strict";
import { planDay } from "../src/planificador.js";
import { caso, fijo, perfilBase, tarea, solapan } from "./helpers.js";

const de = (p, id) => p.bloques.filter(b => b.refId === id);
const minutosDe = (p, id) => de(p, id).reduce((s, b) => s + b.fin - b.inicio, 0);
const conGym = () => ({ ...perfilBase(), objetivos: [{ id: "gym", titulo: "Gym", tipo: "gym", vecesSemana: 3, minutos: 60, sitioId: "gym" }] });
// lunes casi lleno: clase 9-14, trabajo 16-20 → huecos cortos
const lleno = () => [fijo("c1", 540, 840), fijo("w", 960, 1200, { tipo: "trabajo", obligatorio: true, sitioId: "geieg" })];

test("entrega de mañana antes que examen de la semana que viene", () => {
  const p = planDay(caso({ tareas: [tarea("ex", "examen", "2026-11-25", [60]), tarea("en", "entrega", "2026-11-17", [60])] }));
  assert.ok(de(p, "en")[0].inicio < de(p, "ex")[0].inicio);
});

test("bloque de estudio ≤ 90 min y respeta el orden de los pasos", () => {
  const p = planDay(caso({ tareas: [tarea("t", "estudio", null, [50, 50, 30])] }));
  const bs = de(p, "t");
  assert.ok(bs.every(b => b.fin - b.inicio <= 90));
  assert.deepEqual(bs.flatMap(b => b.pasoIds), ["t.1", "t.2", "t.3"]);
});

test("los pasos hechos no se planifican", () => {
  const t = tarea("t", "estudio", null, [30, 30]); t.pasos[0].hecho = true;
  assert.deepEqual(de(planDay(caso({ tareas: [t] })), "t").flatMap(b => b.pasoIds), ["t.2"]);
});

test("se reserva el descanso diario", () => {
  const p = planDay(caso());
  assert.equal(p.bloques.filter(b => b.tipo === "descanso").reduce((s, b) => s + b.fin - b.inicio, 0), 60);
});

test("gym se coloca si falta para el objetivo semanal, con trayectos", () => {
  const p = planDay(caso({ perfil: conGym() }));
  const g = de(p, "gym");
  assert.equal(g.length, 1);
  assert.equal(g[0].sitioId, "gym");
  assert.ok(p.bloques.some(b => b.tipo === "trayecto" && b.sitioId === "gym" && b.fin <= g[0].inicio));
});

test("gym no se coloca si el objetivo semanal ya está cumplido", () => {
  assert.equal(de(planDay(caso({ perfil: conGym(), semana: { hechosObjetivo: { gym: 3 } } })), "gym").length, 0);
});

test("objetivo imposible esta semana → sin aviso (decidido por el usuario: no pasa nada)", () => {
  const p = planDay(caso({ fecha: "2026-11-22", perfil: conGym() })); // domingo, 0 hechos de 3
  assert.equal(p.avisos.some(a => a.tipo === "objetivo-incumplible"), false);
});

test("entrega urgente quita el gym antes que el descanso", () => {
  const p = planDay(caso({ perfil: conGym(), fijos: lleno(), tareas: [tarea("en", "entrega", "2026-11-17", [90, 90, 60])] }));
  assert.equal(de(p, "gym").length, 0);
  assert.equal(minutosDe(p, "en"), 240);
});

test("entrega urgente recorta descanso y avisa", () => {
  const p = planDay(caso({ fijos: lleno(), tareas: [tarea("en", "entrega", "2026-11-17", [90, 90, 90])] }));
  assert.equal(minutosDe(p, "en"), 270);
  assert.ok(p.avisos.some(a => a.tipo === "descanso-recortado"));
});

test("entrega urgente que choca con entreno → propuesta no-ir, el entreno sigue en el plan", () => {
  const fijos = [...lleno(), fijo("ent", 1230, 1350, { tipo: "entreno", sitioId: null })];
  const p = planDay(caso({ fijos, tareas: [tarea("en", "entrega", "2026-11-17", [90, 90, 90, 90])] }));
  assert.ok(p.propuestas.some(x => x.tipo === "no-ir" && x.refId === "ent"));
  assert.ok(p.bloques.some(b => b.refId === "ent"));
});

test("entrega urgente recorta sueño hasta 4 h, nunca por debajo", () => {
  const p = planDay(caso({ fijos: lleno(), tareas: [tarea("en", "entrega", "2026-11-17", Array(12).fill(90))] }));
  assert.ok(p.avisos.some(a => a.tipo === "sueno-recortado"));
  assert.ok(p.avisos.some(a => a.tipo === "entrega-no-cabe"));
  const ultimo = Math.max(...p.bloques.map(b => b.fin));
  assert.ok(ultimo <= 23 * 60 + 30 + 4 * 60, `termina a ${ultimo}`);
});

test("nunca se solapa nada con el trabajo ni entre sí", () => {
  const p = planDay(caso({ perfil: conGym(), fijos: lleno(), tareas: [tarea("en", "entrega", "2026-11-17", Array(8).fill(90)), tarea("s", "estudio", null, [60])] }));
  assert.equal(solapan(p.bloques), false);
  const w = p.bloques.find(b => b.tipo === "trabajo");
  assert.deepEqual([w.inicio, w.fin], [960, 1200]);
});

test("lo no urgente que no cabe va a sinColocar", () => {
  const p = planDay(caso({ fijos: lleno(), tareas: [tarea("s", "estudio", null, Array(10).fill(90))] }));
  assert.ok(p.sinColocar.some(x => x.refId === "s" && x.minutos > 0));
  assert.equal(p.avisos.some(a => a.tipo === "descanso-recortado"), false);
});

test("una tarea aplazada no se planifica antes de su fecha", () => {
  const t = tarea("t", "estudio", null, [30], { aplazadaHasta: "2026-11-18" });
  assert.equal(de(planDay(caso({ tareas: [t] })), "t").length, 0);
  assert.equal(de(planDay(caso({ fecha: "2026-11-18", tareas: [t] })), "t").length, 1);
});

test("no se deja un trozo suelto de menos de 15 min al partir un paso", () => {
  // primer hueco: 30 min útiles y paso de 40 → no se parte (quedarían 10); va entero a otro hueco
  const fijos = [fijo("a", 600, 660, { sitioId: null }), fijo("b", 710, 780, { sitioId: null })];
  const p = planDay(caso({ fecha: "2026-11-22", fijos, tareas: [tarea("t", "estudio", null, [40])] }));
  assert.ok(de(p, "t").every(b => b.fin - b.inicio >= 15));
  assert.equal(de(p, "t").length, 1);
  assert.equal(minutosDe(p, "t"), 40);
});

test("el gym solo se coloca cuando está abierto (horario por día)", () => {
  const perfil = { ...conGym(), objetivos: [{ ...conGym().objetivos[0], horario: [{ diaSemana: 6, inicio: 9 * 60, fin: 14 * 60 }] }] };
  // domingo: solo de 9 a 14; la mañana está ocupada hasta las 13:30 → no cabe
  const ocupado = [fijo("x", 8 * 60 + 40, 13 * 60 + 30, { sitioId: null, tipo: "otro" })];
  const p = planDay(caso({ fecha: "2026-11-22", perfil, fijos: ocupado }));
  assert.equal(de(p, "gym").length, 0);
  // domingo libre → dentro del horario
  const p2 = planDay(caso({ fecha: "2026-11-22", perfil }));
  const g = de(p2, "gym")[0];
  assert.ok(g.inicio >= 9 * 60 && g.fin <= 14 * 60, `${g.inicio}-${g.fin}`);
  // un día sin horario apuntado → cerrado
  assert.equal(de(planDay(caso({ fecha: "2026-11-16", perfil })), "gym").length, 0);
});

test("abuelos: llegar como muy tarde a las 20:00", () => {
  const perfil = { ...perfilBase(), objetivos: [{ id: "ab", titulo: "Abuelos", tipo: "flexible", vecesSemana: 1, minutos: 120, sitioId: null, llegarAntesDe: 20 * 60 }] };
  // día ocupado hasta las 20:30 → no cabe
  const p = planDay(caso({ fecha: "2026-11-22", perfil, fijos: [fijo("x", 8 * 60 + 40, 20 * 60 + 30, { sitioId: null, tipo: "otro" })] }));
  assert.equal(de(p, "ab").length, 0);
  // ocupado hasta las 19:00 → empieza antes de las 20:00
  const p2 = planDay(caso({ fecha: "2026-11-22", perfil, fijos: [fijo("x", 8 * 60 + 40, 19 * 60, { sitioId: null, tipo: "otro" })] }));
  assert.ok(de(p2, "ab")[0].inicio <= 20 * 60);
});
test("un objetivo marcado 'hoy no' no se coloca ese día", () => {
  const p = planDay(caso({ perfil: conGym(), overrides: { objetivosNo: ["gym"] } }));
  assert.equal(de(p, "gym").length, 0);
});

test("el tiempo libre reservado va al final del día, no justo antes de una cita", () => {
  const fijos = [fijo("cita", 18 * 60, 20 * 60, { sitioId: null, tipo: "otro" })];
  const p = planDay(caso({ fecha: "2026-11-22", fijos, tareas: [tarea("t", "estudio", null, [90, 90])] }));
  const d = p.bloques.filter(b => b.tipo === "descanso");
  assert.ok(d.length && d.every(b => b.inicio >= 20 * 60), JSON.stringify(d));
});
