import { llamarGemini } from "../worker/src/gemini.js";
import * as G from "../worker/src/gemini.js";
const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s });
const casos = [
  { texto: "Hoy de 18:00 a 20:00 he quedado con mi hermana para lo de su boda", fecha: "2026-11-15", ahora: 555, contexto: { objetivos: [{ refId: "abuelos", titulo: "Ver a los abuelos" }] } },
  { texto: "tengo que entregar la pràctica 2 de Teoria de Circuits el viernes", fecha: "2026-11-15", ahora: 556, contexto: { asignaturas: ["Teoria de Circuits"] } },
  { texto: "hoy no voy a ver a los abuelos", fecha: "2026-11-15", ahora: 556, contexto: { objetivos: [{ refId: "abuelos", titulo: "Ver a los abuelos" }] } },
];
for (const m of ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-flash-lite-latest"]) {
  for (const c of casos) {
    const t0 = Date.now();
    const r = await G.rutasIA["/ia/entrada"](null, c, { ...env, GEMINI_MODEL: m }, { json, fetchFn: fetch });
    console.log("R", m, r.status, `${Date.now() - t0}ms`, (await r.text()).slice(0, 600));
  }
}
