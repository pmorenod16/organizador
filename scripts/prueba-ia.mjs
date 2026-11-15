import { rutasIA } from "../worker/src/gemini.js";
const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: "gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest" };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s });
const t0 = Date.now();
const r = await rutasIA["/ia/entrada"](null, { texto: "Hoy de 18:00 a 20:00 he quedado con mi hermana para lo de su boda", fecha: "2026-11-15", fechaVista: "2026-11-15", ahora: 555,
  contexto: { asignaturas: ["Teoria de Circuits"], sitios: ["Casa", "UdG Montilivi"], tareas: [], bloques: [], objetivos: [{ refId: "abuelos", titulo: "Ver a los abuelos" }] } }, env, { json, fetchFn: fetch });
console.log("RESULTADO", r.status, `${Date.now() - t0} ms`, await r.text());
const r2 = await rutasIA["/ia/entrada"](null, { texto: "tengo que entregar la pràctica 2 de Teoria de Circuits el viernes", fecha: "2026-11-15", ahora: 556, contexto: { asignaturas: ["Teoria de Circuits"] } }, env, { json, fetchFn: fetch });
console.log("RESULTADO2", r2.status, (await r2.text()).slice(0, 900));
