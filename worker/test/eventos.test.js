import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { crearApp } from "../src/index.js";

const ics = readFileSync(new URL("./fixtures/semanal.ics", import.meta.url), "utf8");
const env = { FIREBASE_PROJECT_ID: "p", OWNER_UID: "u" };
const pedir = (app, body, token = "ok") => app.fetch(new Request("https://w/eventos", {
  method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: "https://pmorenod16.github.io" }, body: JSON.stringify(body) }), env);

const app = crearApp({
  verificar: async t => t === "ok",
  fetchFn: async url => url.includes("roto") ? new Response("", { status: 404 }) : new Response(ics),
});

test("sin token válido → 401", async () => {
  expect((await pedir(app, { urls: [] }, "malo")).status).toBe(401);
});
test("un calendario roto no impide los demás", async () => {
  const r = await pedir(app, { urls: ["https://a/ok.ics", "https://a/roto.ics"], desde: "2026-11-16", hasta: "2026-11-17" });
  expect(r.status).toBe(200);
  const j = await r.json();
  expect(j.eventos.map(e => e.titulo)).toEqual(["Teoria de Circuits"]);
  expect(j.fallidos).toEqual(["https://a/roto.ics"]);
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("https://pmorenod16.github.io");
});
test("webcal:// se convierte en https://", async () => {
  const vistos = [];
  const a = crearApp({ verificar: async () => true, fetchFn: async u => (vistos.push(u), new Response(ics)) });
  await pedir(a, { urls: ["webcal://x/cal.ics"], desde: "2026-11-16", hasta: "2026-11-17" });
  expect(vistos).toEqual(["https://x/cal.ics"]);
});
