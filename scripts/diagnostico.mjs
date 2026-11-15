// Diagnóstico: modelos disponibles con la clave y prueba de cada «flash» (no imprime la clave)
const key = process.env.GEMINI_API_KEY;
const lista = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`)).json();
const modelos = (lista.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent")).map(m => m.name.replace("models/", ""));
console.log("MODELOS:", modelos.join(", "));
const probar = modelos.filter(m => /flash/.test(m) && !/image|tts|audio|live|embedding/.test(m)).slice(0, 12);
for (const m of probar) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 60000);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: 'Responde solo {"ok":true}' }] }], generationConfig: { responseMimeType: "application/json" } }), signal: ctrl.signal });
    const txt = await r.text();
    console.log("PRUEBA", m, "→", r.status, `${Date.now() - t0} ms`, r.ok ? "" : txt.replace(/\s+/g, " ").slice(0, 160));
  } catch (e) { console.log("PRUEBA", m, "→ ERROR", e.name, `${Date.now() - t0} ms`); }
}
