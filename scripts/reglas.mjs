// Publica firestore.rules en Firebase con tu OWNER_UID (lo lee de config.js). Lo ejecuta GitHub Actions.
import { readFileSync } from "node:fs";

const { default: admin } = await import("firebase-admin");
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const cred = admin.credential.cert(sa);
const uid = (readFileSync("config.js", "utf8").match(/OWNER_UID\s*=\s*"([^"]*)"/) || [])[1];
if (!uid) { console.log("OWNER_UID vacío en config.js: todavía no publico las reglas."); process.exit(0); }
const reglas = readFileSync("firestore.rules", "utf8").replace(/OWNER_UID/g, uid);

const api = async (method, url, body) => {
  const { access_token } = await cred.getAccessToken();
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
};
const base = `https://firebaserules.googleapis.com/v1/projects/${sa.project_id}`;
const rs = await api("POST", `${base}/rulesets`, { source: { files: [{ name: "firestore.rules", content: reglas }] } });
const release = { name: `projects/${sa.project_id}/releases/cloud.firestore`, rulesetName: rs.name };
try { await api("PATCH", `${base}/releases/cloud.firestore`, { release }); }
catch { await api("POST", `${base}/releases`, release); }
console.log("✓ Reglas de Firestore publicadas para", uid);
