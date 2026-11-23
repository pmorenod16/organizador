// Comprueba el ID token de Firebase: quién hace la petición (y si es el dueño de la app).
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let remotas;

/**
 * UID de la cuenta del token (cualquier cuenta de Google que haya entrado en la app), o null si no es válido.
 * @param {string} token
 * @param {{projectId: string, claves?: any}} opciones
 * @returns {Promise<string|null>}
 */
export async function usuarioDe(token, { projectId, claves }) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, claves || (remotas ||= createRemoteJWKSet(new URL(JWKS_URL))), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });
    return payload.sub || null;
  } catch {
    return null;
  }
}

/** ¿El token es del dueño? */
export async function verificarToken(token, { projectId, ownerUid, claves }) {
  if (!ownerUid) return false;
  return (await usuarioDe(token, { projectId, claves })) === ownerUid;
}
