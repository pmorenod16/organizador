// Entrada por texto/voz: Gemini convierte lo que dices en acciones estructuradas.
// La app las valida y las enseña en una tarjeta antes de aplicarlas.

const DIAS = "0=lunes, 1=martes, 2=miércoles, 3=jueves, 4=viernes, 5=sábado, 6=domingo";

const SISTEMA = `Eres el organizador del día de un estudiante de ingeniería de la UdG que también trabaja.
Convierte lo que escribe o dice en acciones JSON: {"acciones":[...]}. Cada dato va en SU campo; "titulo" es corto (máximo 6 palabras) y nunca lleva fechas, horas ni explicaciones.
Tipos de acción:
- "tarea": algo que hay que hacer. Campos: titulo, tipoTarea ("entrega"|"examen"|"estudio"|"otro"), fechaLimite ("YYYY-MM-DD" o ""), pasos: lista de 3 a 8 pasos CONCRETOS y pequeños, en orden, cada uno con titulo (una acción clara: "Leer apuntes del tema 3, apartado Thévenin") y minutos (entre 10 y 90).
- "evento": algo con hora fija (quedar con alguien, entreno, partido, examen…). Campos: titulo, tipoEvento ("entreno"|"partido"|"examen"|"clase"|"practica"|"otro"), fecha ("YYYY-MM-DD"), inicio y fin ("HH:MM"; si no dice cuándo acaba, pon 1 hora), diasSemana solo si se repite (${DIAS}).
- "retraso": algo ha durado más de lo previsto o va tarde. Campo: minutos.
- "no-ir": no va a ir a un bloque del plan o a un objetivo (p. ej. los abuelos) hoy. Campo: refId (de "bloques" u "objetivos" del contexto).
- "hecho": ha terminado una tarea o un paso. Campo: refId.
- "aplazar": mover una tarea a otro día. Campos: refId, fecha.
- "trabajo-horario": SOLO si dice que le han cambiado el horario fijo del trabajo (todas las semanas). Campos: diaSemana (${DIAS}), inicio, fin.
- "trabajo-dia": SOLO si dice que un día concreto no trabaja o trabaja en otro horario. Campos: fecha; inicio y fin si trabaja (vacíos = no trabaja).
Una entrega con fecha es una "tarea" (tipoTarea "entrega", fechaLimite) con sus pasos, no un "evento".
Las fechas relativas ("hoy", "mañana", "el viernes") se calculan desde la fecha de hoy que se te da. No inventes nada que no se deduzca del mensaje. Usa solo refId del contexto. Si el mensaje no pide nada, {"acciones":[]}.

Ejemplos (hoy es domingo 2026-11-15):
«hoy de 18 a 20 he quedado con mi hermana para lo de su boda» →
{"acciones":[{"tipo":"evento","titulo":"Boda: quedar con mi hermana","tipoEvento":"otro","fecha":"2026-11-15","inicio":"18:00","fin":"20:00"}]}
«tengo que entregar la pràctica 2 de Teoria de Circuits el viernes» →
{"acciones":[{"tipo":"tarea","titulo":"Pràctica 2 Teoria de Circuits","tipoTarea":"entrega","fechaLimite":"2026-11-20","pasos":[{"titulo":"Leer el enunciado y apuntar qué piden","minutos":15},{"titulo":"Repasar la teoría necesaria en los apuntes","minutos":45},{"titulo":"Hacer los cálculos y simulaciones","minutos":90},{"titulo":"Redactar el informe con los resultados","minutos":60},{"titulo":"Revisar y subir al Moodle","minutos":15}]}]}
«la clase ha acabado 20 minutos tarde» → {"acciones":[{"tipo":"retraso","minutos":20}]}`;

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    acciones: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tipo: { type: "STRING", enum: ["tarea", "evento", "retraso", "no-ir", "hecho", "aplazar", "trabajo-horario", "trabajo-dia"] },
          titulo: { type: "STRING", description: "Corto, máximo 6 palabras. Sin fechas, horas ni explicaciones." },
          tipoTarea: { type: "STRING", enum: ["entrega", "examen", "estudio", "otro"] },
          tipoEvento: { type: "STRING", enum: ["entreno", "partido", "entrega", "examen", "clase", "practica", "otro"] },
          fechaLimite: { type: "STRING", description: "YYYY-MM-DD o vacío" },
          fecha: { type: "STRING", description: "YYYY-MM-DD" },
          inicio: { type: "STRING", description: "HH:MM" },
          fin: { type: "STRING", description: "HH:MM" },
          diasSemana: { type: "ARRAY", items: { type: "INTEGER" } },
          diaSemana: { type: "INTEGER" },
          minutos: { type: "INTEGER" },
          refId: { type: "STRING" },
          pasos: { type: "ARRAY", items: { type: "OBJECT", properties: { titulo: { type: "STRING" }, minutos: { type: "INTEGER" } }, required: ["titulo", "minutos"] } },
        },
        required: ["tipo"],
      },
    },
  },
  required: ["acciones"],
};

export class ErrorIA extends Error {
  constructor(mensaje, status) { super(mensaje); this.status = status; }
}

const ESPERA_MAX = 20000;

/** Prueba los modelos en orden (GEMINI_MODEL = "a,b,c"): si uno falla o tarda más de 20 s, el siguiente. */
export async function llamarGemini({ apiKey, model, ...resto }) {
  const modelos = String(model || "gemini-3.5-flash").split(",").map(m => m.trim()).filter(Boolean);
  let ultimo;
  for (const m of modelos) {
    try { return await llamarModelo({ apiKey, model: m, ...resto }); }
    catch (e) { ultimo = e; if (e.status === 400) break; }
  }
  throw ultimo;
}

async function llamarModelo({ apiKey, model, sistema, texto, esquema, fetchFn }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ESPERA_MAX);
  const r = await fetchFn(url, {
    signal: ctrl.signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: [{ role: "user", parts: [{ text: texto }] }],
      // sin responseSchema: con él, los modelos rellenan solo el primer campo y meten todo en el título
      // (comprobado el 15/11/2026). Las instrucciones con ejemplos dan JSON correcto; la app lo valida.
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  }).catch(e => { throw new ErrorIA(e.name === "AbortError" ? "La IA está tardando demasiado." : "No se ha podido contactar con la IA.", 504); })
    .finally(() => clearTimeout(t));
  if (r.status === 429) throw new ErrorIA("Se ha agotado el límite gratuito de Gemini por ahora. Prueba en un minuto.", 503);
  if (!r.ok) throw new ErrorIA(`Gemini ha respondido ${r.status}`, 502);
  const datos = await r.json().catch(() => null);
  const txt = datos?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  try {
    return JSON.parse(txt);
  } catch {
    throw new ErrorIA("La IA no ha devuelto una respuesta válida.", 502);
  }
}

async function entrada(req, body, env, { json, fetchFn }) {
  const { texto, fecha, fechaVista, ahora, contexto = {} } = body;
  if (!texto || !fecha) return json({ error: "falta texto o fecha" }, 400);
  const h = Math.floor((ahora ?? 0) / 60), m = (ahora ?? 0) % 60;
  const DS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const dia = f => DS[new Date(f + "T12:00:00Z").getUTCDay()];
  const vista = fechaVista && fechaVista !== fecha ? ` Está mirando el plan del ${dia(fechaVista)} ${fechaVista}.` : "";
  const mensaje = `Hoy es ${dia(fecha)} ${fecha} y son las ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}.${vista}
Contexto (JSON): ${JSON.stringify(contexto)}
Mensaje: «${texto}»`;
  try {
    const res = await llamarGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || "gemini-3-flash-preview,gemini-3.5-flash,gemini-3.5-flash-lite", sistema: SISTEMA, texto: mensaje, esquema: ESQUEMA, fetchFn });
    if (!Array.isArray(res?.acciones)) return json({ error: "La IA no ha devuelto acciones." }, 502);
    return json({ acciones: res.acciones });
  } catch (e) {
    return json({ error: e.message }, e.status || 502);
  }
}

export const rutasIA = { "/ia/entrada": entrada };
