// Datos de prueba comunes para el planificador.
export const perfilBase = () => ({
  casaId: "casa",
  sitios: [{ id: "casa", nombre: "Casa" }, { id: "udg", nombre: "UdG" }, { id: "geieg", nombre: "GEiEG" }, { id: "gym", nombre: "Gym" }],
  trayectos: { "casa|udg": 15, "casa|geieg": 15, "casa|gym": 10 },
  rutinaManana: [{ titulo: "Ducha", minutos: 20 }, { titulo: "Desayuno", minutos: 20 }],
  horaDormir: 23 * 60 + 30, horasSueno: 8, minSleepHours: 4, margen: 10, descansoMinDia: 60,
  levantarseDefecto: 8 * 60 + 30, trabajo: [], trabajoSitioId: "geieg", objetivos: [], asignaturas: [],
});
export const fijo = (id, inicio, fin, extra = {}) => ({ id, uid: id, titulo: id, inicio, fin, tipo: "clase", obligatorio: false, sitioId: "udg", asistir: true, ...extra });
export const tarea = (id, tipo, fechaLimite, minutos, extra = {}) => ({
  id, titulo: id, tipo, fechaLimite, sitioId: null,
  pasos: minutos.map((m, i) => ({ id: `${id}.${i + 1}`, titulo: `${id} paso ${i + 1}`, minutos: m, hecho: false })), ...extra });
export const LUNES = "2026-11-16";
export const caso = (extra = {}) => ({ fecha: LUNES, fijos: [], tareas: [], perfil: perfilBase(), semana: { hechosObjetivo: {} }, overrides: {}, ...extra });
export const solapan = bloques => {
  const b = [...bloques].sort((x, y) => x.inicio - y.inicio);
  return b.some((x, i) => i > 0 && x.inicio < b[i - 1].fin);
};
