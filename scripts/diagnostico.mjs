// Diagnóstico: ¿responde Gemini con la clave y cuánto tarda? (no imprime la clave)
const key = process.env.GEMINI_API_KEY;
const modelos = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
for (const m of modelos) {
  for (const think of [null, 0]) {
    const t0 = Date.now();
    try {
      const body = { contents: [{ role: "user", parts: [{ text: 'Responde solo {"ok":true}' }] }], generationConfig: { responseMimeType: "application/json" } };
      if (think !== null) body.generationConfig.thinkingConfig = { thinkingBudget: think };
      const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
      const txt = await r.text();
      console.log(m, "thinking:", think, "→", r.status, `${Date.now() - t0} ms`, r.ok ? (JSON.parse(txt).modelVersion || "") : txt.slice(0, 200));
    } catch (e) { console.log(m, "thinking:", think, "→ ERROR", e.name, `${Date.now() - t0} ms`); }
  }
}
const t0 = Date.now();
const w = await fetch("https://organizador.pmorenod16.workers.dev/ia/entrada", { method: "POST", headers: { Origin: "https://pmorenod16.github.io" }, body: "{}" }).catch(e => ({ status: "ERROR " + e.message }));
console.log("worker sin token →", w.status, `${Date.now() - t0} ms`);
