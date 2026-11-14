// Comprueba que la petición viene del dueño de la app (ID token de Firebase).
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let remotas;

/**
 * @param {string} token
 * @param {{projectId: string, ownerUid: string, claves?: any}} opciones
 * @returns {Promise<boolean>}
 */
export async function verificarToken(token, { projectId, ownerUid, claves }) {
  if (!token || !ownerUid) return false;
  try {
    const { payload } = await jwtVerify(token, claves || (remotas ||= createRemoteJWKSet(new URL(JWKS_URL))), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });
    return payload.sub === ownerUid;
  } catch {
    return false;
  }
}
