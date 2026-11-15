// Perfil por defecto: con esto la app ya funciona y todo se puede ajustar después.
export function perfilPorDefecto() {
  return {
    casaId: "casa",
    sitios: [
      { id: "casa", nombre: "Casa" },
      { id: "udg", nombre: "UdG Montilivi" },
      { id: "geieg", nombre: "GEiEG" },
      { id: "gym", nombre: "Gym" },
      { id: "abuelos", nombre: "Casa de los abuelos" },
      { id: "futbol", nombre: "Campo de fútbol" },
    ],
    trayectos: { "casa|udg": 15, "casa|geieg": 15, "casa|gym": 10 },
    rutinaManana: [{ titulo: "Ducha y vestirse", minutos: 20 }, { titulo: "Desayuno", minutos: 20 }],
    comidas: [{ titulo: "Comida", hora: 14 * 60, minutos: 45 }, { titulo: "Cena", hora: 21 * 60, minutos: 45 }],
    horaDormir: 23 * 60 + 30,
    horasSueno: 8,
    minSleepHours: 4,
    margen: 10,
    descansoMinDia: 60,
    levantarseDefecto: 8 * 60,
    trabajo: [],
    trabajoSitioId: "geieg",
    objetivos: [
      { id: "gym", titulo: "Gym", tipo: "gym", vecesSemana: 3, minutos: 75, sitioId: "gym" },
      { id: "abuelos", titulo: "Ver a los abuelos", tipo: "flexible", vecesSemana: 1, minutos: 120, sitioId: "abuelos" },
    ],
    asignaturas: [],
    campusDefecto: "udg",
    estudio: { minutosDia: 180 },
    trabajoExcepciones: {},
    calendarios: { google: "", google2: "", examenes: "", moodle: "" },
    marcas: {},
    eventosManuales: [],
  };
}

export function completarPerfil(p = {}) {
  const d = perfilPorDefecto();
  return { ...d, ...p, calendarios: { ...d.calendarios, ...(p.calendarios || {}) } };
}

export const urlsCalendario = p => Object.values(p.calendarios || {}).filter(u => u && u.trim());
