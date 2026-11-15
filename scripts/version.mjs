// Pone una versión nueva a la app y la añade a todos los imports (?v=…), para que el móvil
// no use archivos viejos de la caché de GitHub Pages (que los guarda hasta 10 min).
// Uso: node scripts/version.mjs   (antes de cada publicación)
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const d = new Date();
const v = d.toISOString().slice(0, 16).replace(/[-:T]/g, "");
const archivos = [];
const recorrer = dir => { for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? recorrer(p) : p.endsWith(".js") && archivos.push(p); } };
recorrer("src");
const IMPORT = /((?:from|import)\s*\(?\s*["'`])(\.{1,2}\/[^"'`?]+\.js)(\?v=[^"'`]*)?(["'`])/g;
for (const p of archivos) {
  let s = readFileSync(p, "utf8").replace(IMPORT, (_, a, ruta, __, c) => `${a}${ruta}?v=${v}${c}`);
  if (p.endsWith("main.js")) s = s.replace(/export const APP_VERSION = "[^"]*";/, `export const APP_VERSION = "${v}";`);
  writeFileSync(p, s);
}
const html = readFileSync("index.html", "utf8").replace(/src="src\/main\.js(\?v=[^"]*)?"/, `src="src/main.js?v=${v}"`);
writeFileSync("index.html", html);
console.log("versión", v);
