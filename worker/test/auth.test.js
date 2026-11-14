import { test, expect } from "vitest";
import { SignJWT, generateKeyPair } from "jose";
import { verificarToken } from "../src/auth.js";

const projectId = "organizador-test";
const { publicKey, privateKey } = await generateKeyPair("RS256");
const claves = async () => publicKey;
const firmar = (sub, aud = projectId) => new SignJWT({}).setProtectedHeader({ alg: "RS256", kid: "k" })
  .setSubject(sub).setIssuer(`https://securetoken.google.com/${projectId}`).setAudience(aud)
  .setIssuedAt().setExpirationTime("1h").sign(privateKey);

test("token del dueño → true", async () => {
  expect(await verificarToken(await firmar("dueno"), { projectId, ownerUid: "dueno", claves })).toBe(true);
});
test("token de otro UID → false", async () => {
  expect(await verificarToken(await firmar("otro"), { projectId, ownerUid: "dueno", claves })).toBe(false);
});
test("token de otro proyecto → false", async () => {
  expect(await verificarToken(await firmar("dueno", "otro-proyecto"), { projectId, ownerUid: "dueno", claves })).toBe(false);
});
test("basura → false", async () => {
  expect(await verificarToken("no-es-un-token", { projectId, ownerUid: "dueno", claves })).toBe(false);
});
