// Calcula la versión de Tasca (huella de sus archivos) y la escribe en version.json.
// La app la compara al abrirse, al volver a primer plano y cada 30 min: si cambia, se recarga sola.
// Uso: node tareas/scripts/version.mjs   (los tests fallan si se te olvida)
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const archivos = [];
const recorrer = d => { for (const f of readdirSync(d).sort()) { const p = join(d, f); statSync(p).isDirectory() ? recorrer(p) : archivos.push(p); } };
recorrer(join(RAIZ, "src"));
for (const f of ["index.html", "styles.css", "sw.js", "manifest.webmanifest"]) archivos.push(join(RAIZ, f));
const h = createHash("sha256");
for (const p of archivos) h.update(p.slice(RAIZ.length) + "\0").update(readFileSync(p));
export const huella = h.digest("hex").slice(0, 10);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ruta = join(RAIZ, "version.json");
  let antes = null; try { antes = JSON.parse(readFileSync(ruta, "utf8")).build; } catch {}
  if (antes === huella) console.log("version.json ya está al día:", huella);
  else { writeFileSync(ruta, JSON.stringify({ build: huella, fecha: new Date().toISOString() }) + "\n"); console.log("versión nueva:", huella); }
}
