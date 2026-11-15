// Tramos sin nada entre levantarse y dormir (≥ 20 min), para enseñarlos como «Tiempo libre».
export function huecosLibres(plan, horaDormir, minimo = 20) {
  const bloques = [...plan.bloques].sort((a, b) => a.inicio - b.inicio);
  const huecos = [];
  let cursor = plan.horaLevantarse;
  for (const b of bloques) {
    if (b.inicio - cursor >= minimo) huecos.push({ inicio: cursor, fin: b.inicio });
    cursor = Math.max(cursor, b.fin);
  }
  if (horaDormir - cursor >= minimo) huecos.push({ inicio: cursor, fin: horaDormir });
  return huecos;
}
