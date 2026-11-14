import { test, expect } from "vitest";
import { crearApp } from "../src/index.js";

const ICS = "BEGIN:VCALENDAR\nEND:VCALENDAR";
const env = { FIREBASE_PROJECT_ID: "p", OWNER_UID: "u" };
const pedir = (app, body, token = "ok") => app.fetch(new Request("https://w/calendarios", {
  method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: "https://pmorenod16.github.io" }, body: JSON.stringify(body) }), env);
const app = crearApp({
  verificar: async t => t === "ok",
  fetchFn: async url => url.includes("roto") ? new Response("", { status: 404 }) : url.includes("enorme") ? new Response("x".repeat(6e6)) : new Response(ICS),
});

test("sin token válido → 401", async () => {
  expect((await pedir(app, { urls: [] }, "malo")).status).toBe(401);
});
test("devuelve el texto de cada calendario; uno roto no impide los demás", async () => {
  const r = await pedir(app, { urls: ["https://a/ok.ics", "https://a/roto.ics"] });
  expect(r.status).toBe(200);
  const j = await r.json();
  expect(j.calendarios).toEqual([{ url: "https://a/ok.ics", texto: ICS }]);
  expect(j.fallidos).toEqual(["https://a/roto.ics"]);
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("https://pmorenod16.github.io");
});
test("webcal:// se convierte en https://; http y otras cosas se rechazan", async () => {
  const vistos = [];
  const a = crearApp({ verificar: async () => true, fetchFn: async u => (vistos.push(u), new Response(ICS)) });
  const j = await (await pedir(a, { urls: ["webcal://x/cal.ics", "http://x/cal.ics", "file:///etc/passwd"] })).json();
  expect(vistos).toEqual(["https://x/cal.ics"]);
  expect(j.fallidos).toEqual(["http://x/cal.ics", "file:///etc/passwd"]);
});
test("un calendario de más de 5 MB se rechaza", async () => {
  const j = await (await pedir(app, { urls: ["https://a/enorme.ics"] })).json();
  expect(j.fallidos).toEqual(["https://a/enorme.ics"]);
});
