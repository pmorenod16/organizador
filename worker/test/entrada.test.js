import { test, expect } from "vitest";
import { crearApp } from "../src/index.js";
import { rutasIA } from "../src/gemini.js";

const env = { GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-flash-latest" };
const pedir = (respuestaGemini, capturar) => {
  const app = crearApp({
    verificar: async () => true,
    rutas: rutasIA,
    fetchFn: async (url, opts) => { capturar?.(url, JSON.parse(opts.body)); return respuestaGemini(); },
  });
  return app.fetch(new Request("https://w/ia/entrada", { method: "POST", headers: { Authorization: "Bearer x" },
    body: JSON.stringify({ texto: "la clase ha acabado 20 min tarde", fecha: "2026-11-16", fechaVista: "2026-11-17", ahora: 660, contexto: { asignaturas: [], sitios: [], tareas: [], bloques: [] } }) }), env);
};
const gemini = texto => () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }));

test("respuesta de Gemini con JSON → 200 con las acciones", async () => {
  let enviado;
  const r = await pedir(gemini('{"acciones":[{"tipo":"retraso","minutos":20}]}'), (u, b) => (enviado = { u, b }));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ acciones: [{ tipo: "retraso", minutos: 20 }] });
  expect(enviado.u).toContain("models/gemini-flash-latest:generateContent");
  expect(enviado.u).toContain("key=k");
  expect(enviado.b.generationConfig.responseMimeType).toBe("application/json");
  expect(JSON.stringify(enviado.b.contents)).toContain("20 min tarde");
  expect(JSON.stringify(enviado.b.contents)).toContain("Hoy es lunes 2026-11-16 y son las 11:00");
  expect(JSON.stringify(enviado.b.contents)).toContain("mirando el plan del martes 2026-11-17");
  expect(JSON.stringify(enviado.b.systemInstruction)).toContain("trabajo-dia");
});
test("respuesta de Gemini no-JSON → 502 {error}", async () => {
  const r = await pedir(gemini("lo siento, no entiendo"));
  expect(r.status).toBe(502);
  expect((await r.json()).error).toBeTruthy();
});
test("Gemini con límite agotado (429) → 503 con mensaje claro", async () => {
  const r = await pedir(() => new Response("{}", { status: 429 }));
  expect(r.status).toBe(503);
  expect((await r.json()).error).toMatch(/límite/);
});
