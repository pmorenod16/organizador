import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCSV, deTodoist, leerFechaTodoist, nombreDeArchivo } from "../src/csv.js";

const hoy = "2026-11-21";
test("leerCSV con comillas, saltos de línea y punto y coma", () => {
  assert.deepEqual(leerCSV('a,b\n"x, y","línea 1\nlínea 2"\n'), [["a", "b"], ["x, y", "línea 1\nlínea 2"]]);
  assert.deepEqual(leerCSV("﻿a;b\r\n1;2\r\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(leerCSV('a,b\n"di ""hola""",2'), [["a", "b"], ['di "hola"', "2"]]);
});
test("fechas de Todoist", () => {
  assert.deepEqual(leerFechaTodoist("2026-11-23 10:00", hoy), { fecha: "2026-11-23", hora: "10:00", repetir: null });
  assert.equal(leerFechaTodoist("23/11/2026", hoy).fecha, "2026-11-23");
  assert.equal(leerFechaTodoist("Nov 23 2026", hoy).fecha, "2026-11-23");
  assert.equal(leerFechaTodoist("23 nov", hoy).fecha, "2026-11-23");
  assert.equal(leerFechaTodoist("13 Jan", hoy).fecha, "2027-01-13");
  assert.equal(leerFechaTodoist("tomorrow", hoy).fecha, "2026-11-22");
  assert.deepEqual(leerFechaTodoist("23 nov 2026 10am", hoy), { fecha: "2026-11-23", hora: "10:00", repetir: null });
  assert.deepEqual(leerFechaTodoist("every day", hoy).repetir, { cada: "dia", n: 1 });
  assert.deepEqual(leerFechaTodoist("every monday", hoy), { fecha: "2026-11-23", hora: null, repetir: { cada: "semana", n: 1 } });
  assert.equal(leerFechaTodoist("2026-11-23T09:30:00Z", hoy).hora, "09:30");
  assert.equal(leerFechaTodoist("cuando pueda", hoy).fecha, null);
});
test("deTodoist: sesiones con pasos (INDENT), secciones, notas, prioridad y etiquetas", () => {
  const csv = [
    "TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT",
    "section,Primera vuelta,,,,,,,,,,",
    'task,"Sesión 1 · Conceptos básicos @tc","Leer tema 1, apartados 1.1–1.3",2,1,,,2026-11-23 10:00,es,Europe/Madrid,120,minute',
    "task,Teoría 1.1,,4,2,,,,,,,",
    "task,Problemas 1-3,,4,2,,,,,,,",
    "task,Problema 1,,4,3,,,,,,,",
    "note,Ojo con la errata,,,,,,,,,,",
    "task,Corrección con el solucionario,,4,2,,,,,,,",
    "task,Sesión 2,,1,1,,,24/11/2026,es,,,",
  ].join("\n");
  const { tareas, avisos } = deTodoist(csv, hoy);
  assert.equal(avisos.length, 0);
  assert.equal(tareas.length, 6);
  const [s1, t11, p13, p1, corr, s2] = tareas;
  assert.equal(s1.titulo, "Sesión 1 · Conceptos básicos"); assert.deepEqual(s1.etiquetas, ["tc"]);
  assert.equal(s1.notas, "Leer tema 1, apartados 1.1–1.3");
  assert.equal(s1.fecha, "2026-11-23"); assert.equal(s1.hora, "10:00"); assert.equal(s1.duracion, 120);
  assert.equal(s1.seccion, "Primera vuelta"); assert.equal(s1.prioridad, 2);
  assert.equal(t11.padreRef, s1.ref); assert.equal(p13.padreRef, s1.ref);
  assert.equal(p1.padreRef, p13.ref); assert.equal(p1.notas, "Ojo con la errata");
  assert.equal(corr.padreRef, s1.ref);
  assert.equal(s2.padreRef, null); assert.equal(s2.fecha, "2026-11-24"); assert.equal(s2.prioridad, 1);
});
test("CSV que no es de Todoist", () => {
  assert.match(deTodoist("a,b\n1,2", hoy).avisos[0], /No parece/);
});
test("nombre del proyecto desde el archivo", () => {
  assert.equal(nombreDeArchivo("Teoria_de_Circuits (1).csv"), "Teoria de Circuits");
});
