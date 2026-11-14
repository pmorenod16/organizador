// Entrada por texto/voz: Gemini convierte lo que dices en acciones estructuradas.
// La app las valida y las enseña en una tarjeta antes de aplicarlas.

const DIAS = "0=lunes, 1=martes, 2=miércoles, 3=jueves, 4=viernes, 5=sábado, 6=domingo";

const SISTEMA = `Eres el organizador del día de un estudiante de ingeniería de la UdG que también trabaja.
Convierte lo que escribe o dice en acciones JSON. Responde SOLO con {"acciones":[...]}.
Tipos de acción:
- "tarea": algo que hay que hacer. Campos: titulo, tipoTarea ("entrega"|"examen"|"estudio"|"otro"), fechaLimite ("YYYY-MM-DD" o vacío), pasos: lista de pasos CONCRETOS y pequeños, en orden, cada uno con titulo y minutos estimados (entre 10 y 90). Un paso dice exactamente qué hacer ("Leer apuntes del tema 3, apartado Thévenin", no "Estudiar").
- "evento": algo con hora fija (entreno, partido, examen, entrega con hora). Campos: titulo, tipoEvento ("entreno"|"partido"|"entrega"|"examen"|"clase"|"practica"|"otro"), fecha, inicio y fin "HH:MM", diasSemana si se repite (${DIAS}).
- "retraso": algo ha durado más de lo previsto o vas tarde. Campo: minutos.
- "no-ir": no va a ir a un bloque del plan. Campo: refId (de los bloques del contexto).
- "hecho": ha terminado una tarea o un paso. Campo: refId.
- "aplazar": mover una tarea a otro día. Campos: refId, fecha.
- "trabajo-horario": SOLO si dice explícitamente que le han cambiado el horario fijo del trabajo (todas las semanas). Campos: diaSemana (${DIAS}), inicio, fin.
- "trabajo-dia": SOLO si dice explícitamente que un día concreto no trabaja o trabaja en otro horario. Campos: fecha; inicio y fin si trabaja (vacíos = no trabaja ese día).
- Una entrega con fecha es una "tarea" (tipoTarea "entrega", fechaLimite) con sus pasos, no un "evento".
Reglas: no inventes fechas ni horas que no se deduzcan del mensaje; las fechas relativas ("el viernes", "mañana") se calculan desde la fecha de hoy. Usa solo refId que aparezcan en el contexto. Si el mensaje no pide nada, devuelve {"acciones":[]}.`;

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    acciones: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tipo: { type: "STRING", enum: ["tarea", "evento", "retraso", "no-ir", "hecho", "aplazar", "trabajo-horario", "trabajo-dia"] },
          titulo: { type: "STRING" },
          tipoTarea: { type: "STRING", enum: ["entrega", "examen", "estudio", "otro"] },
          tipoEvento: { type: "STRING", enum: ["entreno", "partido", "entrega", "examen", "clase", "practica", "otro"] },
          fechaLimite: { type: "STRING" },
          fecha: { type: "STRING" },
          inicio: { type: "STRING" },
          fin: { type: "STRING" },
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

/** Llama a Gemini y devuelve el JSON que genera. */
export async function llamarGemini({ apiKey, model, sistema, texto, esquema, fetchFn }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const r = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: [{ role: "user", parts: [{ text: texto }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: esquema, temperature: 0.2 },
    }),
  });
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
    const res = await llamarGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || "gemini-flash-latest", sistema: SISTEMA, texto: mensaje, esquema: ESQUEMA, fetchFn });
    if (!Array.isArray(res?.acciones)) return json({ error: "La IA no ha devuelto acciones." }, 502);
    return json({ acciones: res.acciones });
  } catch (e) {
    return json({ error: e.message }, e.status || 502);
  }
}

export const rutasIA = { "/ia/entrada": entrada };
