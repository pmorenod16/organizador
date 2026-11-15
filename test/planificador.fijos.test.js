import { test } from "node:test";
import assert from "node:assert/strict";
import { planDay, trayecto } from "../src/planificador.js";
import { caso, fijo, perfilBase, solapan } from "./helpers.js";

test("hora de levantarse = primer fijo − trayecto − margen − rutina", () => {
  // clase 09:00 en UdG, casa→UdG 15, margen 10, rutina 20+20
  assert.equal(planDay(caso({ fijos: [fijo("c1", 540, 660)] })).horaLevantarse, 7 * 60 + 55);
});

test("si el primer fijo es tarde, se levanta a la hora por defecto", () => {
  assert.equal(planDay(caso({ fijos: [fijo("c1", 15 * 60, 17 * 60)] })).horaLevantarse, 8 * 60 + 30);
});

test("bloque de trayecto entre sitios distintos y margen antes de llegar", () => {
  const p = planDay(caso({ fijos: [fijo("c1", 540, 660)] }));
  const t = p.bloques.find(b => b.tipo === "trayecto" && b.fin <= 540);
  assert.deepEqual([t.inicio, t.fin, t.sitioId], [515, 530, "udg"]);
  const vuelta = p.bloques.find(b => b.tipo === "trayecto" && b.inicio >= 660);
  assert.deepEqual([vuelta.inicio, vuelta.fin, vuelta.sitioId], [670, 685, "casa"]);
  assert.equal(solapan(p.bloques), false);
});

test("trayecto: simétrico, 0 en el mismo sitio, 15 + aviso si falta", () => {
  const pf = perfilBase();
  assert.equal(trayecto(pf, "udg", "casa"), 15);
  assert.equal(trayecto(pf, "udg", "udg"), 0);
  assert.equal(trayecto(pf, "udg", "gym"), 15);
  const p = planDay(caso({ fijos: [fijo("c1", 540, 600), fijo("g", 700, 760, { sitioId: "gym" })] }));
  assert.ok(p.avisos.some(a => a.tipo === "trayecto-desconocido"));
});

test("trabajo del perfil aparece como bloque fijo aunque no esté en el calendario", () => {
  const perfil = { ...perfilBase(), trabajo: [{ diaSemana: 0, inicio: 16 * 60, fin: 20 * 60 }] };
  const p = planDay(caso({ perfil }));
  const w = p.bloques.find(b => b.tipo === "trabajo");
  assert.deepEqual([w.inicio, w.fin, w.sitioId], [960, 1200, "geieg"]);
});

test("día sin fijos → horaLevantarse = perfil.levantarseDefecto, sin errores", () => {
  const p = planDay(caso({ fecha: "2026-11-22" }));
  assert.equal(p.horaLevantarse, perfilBase().levantarseDefecto);
  assert.ok(p.bloques.some(b => b.tipo === "rutina"));
});

test("sueño < minSleepHours por una clase no obligatoria → propuesta saltar-clase", () => {
  const p = planDay(caso({ fijos: [fijo("c1", 540, 660)], overrides: { horaDormirAnterior: 4 * 60 } }));
  assert.deepEqual(p.propuestas[0], { tipo: "saltar-clase", refId: "c1", motivo: "sueno" });
});

test("la misma situación con una práctica → sin propuesta, aviso de sueño", () => {
  const p = planDay(caso({ fijos: [fijo("c1", 540, 660, { tipo: "practica", obligatorio: true })], overrides: { horaDormirAnterior: 4 * 60 } }));
  assert.equal(p.propuestas.length, 0);
  assert.ok(p.avisos.some(a => a.tipo === "sueno-recortado"));
});

test("evento con asistir:false no genera bloque ni trayecto", () => {
  const p = planDay(caso({ fijos: [fijo("c1", 540, 660, { asistir: false })] }));
  assert.equal(p.bloques.filter(b => b.tipo === "clase" || b.tipo === "trayecto").length, 0);
});

test("un retraso desplaza lo no fijo posterior", () => {
  const base = caso({ fecha: "2026-11-22", tareas: [] });
  const t = [{ id: "e", titulo: "e", tipo: "estudio", fechaLimite: null, sitioId: null, pasos: [{ id: "e1", titulo: "x", minutos: 60, hecho: false }] }];
  const sin = planDay({ ...base, tareas: t }).bloques.find(b => b.refId === "e");
  const con = planDay({ ...base, tareas: t, overrides: { retrasos: [{ desde: sin.inicio - 5, minutos: 30 }] } }).bloques.find(b => b.refId === "e");
  assert.ok(con.inicio >= sin.inicio + 25, `${con.inicio} vs ${sin.inicio}`);
});

test("comida y cena a su hora; si chocan con algo fijo, justo después", () => {
  const perfil = { ...perfilBase(), comidas: [{ titulo: "Comida", hora: 14 * 60, minutos: 45 }, { titulo: "Cena", hora: 21 * 60, minutos: 45 }] };
  const p = planDay(caso({ perfil, fijos: [fijo("c1", 13 * 60, 14 * 60 + 30, { sitioId: null })] }));
  const c = p.bloques.filter(b => b.tipo === "comida").map(b => [b.titulo, b.inicio, b.fin]);
  assert.deepEqual(c, [["Comida", 14 * 60 + 40, 15 * 60 + 25], ["Cena", 21 * 60, 21 * 60 + 45]]);
  assert.equal(solapan(p.bloques), false);
});

test("tras el último sitio fuera de casa se vuelve a casa enseguida, aunque luego haya comidas", () => {
  const perfil = { ...perfilBase(), comidas: [{ titulo: "Cena", hora: 21 * 60, minutos: 45 }], trabajo: [{ diaSemana: 0, inicio: 960, fin: 1140 }] };
  const p = planDay(caso({ perfil }));
  const vuelta = p.bloques.find(b => b.tipo === "trayecto" && b.sitioId === "casa");
  assert.deepEqual([vuelta.inicio, vuelta.fin], [1150, 1165]);
  assert.equal(p.bloques.find(b => b.titulo === "Cena").sitioId, "casa");
});
test("entre dos clases en el mismo campus te quedas allí", () => {
  const p = planDay(caso({ fijos: [fijo("a", 540, 660), fijo("b", 900, 1020)] }));
  assert.equal(p.bloques.filter(b => b.tipo === "trayecto").length, 2);
});

test("la comida no se solapa con el camino de vuelta: empieza al llegar", () => {
  const perfil = { ...perfilBase(), comidas: [{ titulo: "Comida", hora: 14 * 60, minutos: 45 }] };
  const p = planDay(caso({ perfil, fijos: [fijo("c", 720, 835)] }));
  assert.equal(solapan(p.bloques), false);
  const c = p.bloques.find(b => b.titulo === "Comida");
  assert.deepEqual([c.inicio, c.fin, c.sitioId], [860, 905, "casa"]);
});

test("margen al llegar: con margenLlegada 5 sales 20 min antes (15 de trayecto + 5)", () => {
  const perfil = { ...perfilBase(), margenLlegada: 5, trabajo: [{ diaSemana: 0, inicio: 16 * 60, fin: 20 * 60 }] };
  const p = planDay(caso({ perfil, fijos: [fijo("c1", 540, 660)] }));
  const ida = p.bloques.filter(b => b.tipo === "trayecto" && b.titulo.startsWith("Ir a"));
  assert.deepEqual(ida.map(b => [b.inicio, b.fin]), [[520, 535], [940, 955]]);
});
test("el descanso reservado se enseña como tiempo libre", () => {
  const p = planDay(caso());
  assert.ok(p.bloques.filter(b => b.tipo === "descanso").every(b => b.titulo === "Tiempo libre"));
});
