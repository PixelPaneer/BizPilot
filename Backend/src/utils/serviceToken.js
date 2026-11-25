import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

// Service tokens: how this backend and the Python AI service prove who they are to each other.
//
// A token is a short-lived JWT (HS256) signed with SERVICE_JWT_SECRET. It names the shop the call
// is about (`business_id`), so the AI service can only ever see one shop's data per request.
//
//   Node -> AI:  iss "bizpilot-node", aud "bizpilot-ai"
//   AI -> Node:  iss "bizpilot-ai",   aud "bizpilot-node"
//
// These are not the owner's sign-in tokens (those use JWT_SECRET and a different audience).

export const NODE_ISSUER = "bizpilot-node";
export const AI_ISSUER = "bizpilot-ai";
const MAX_LIFETIME_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireSecret() {
  if (!env.serviceJwtSecret) {
    throw new ApiError(
      503,
      "Service tokens are not configured on this server (SERVICE_JWT_SECRET is missing).",
      [],
      "SERVICE_NOT_CONFIGURED"
    );
  }
  return env.serviceJwtSecret;
}

// A token for a call from this backend to the AI service, about one shop.
export function signAiToken(businessId) {
  const secret = requireSecret();
  const issuedAt = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: NODE_ISSUER,
      aud: AI_ISSUER,
      business_id: businessId,
      iat: issuedAt,
      exp: issuedAt + env.serviceTokenTtlSeconds,
    },
    secret,
    { algorithm: "HS256" }
  );
}

// Checks a token from the AI service and returns the shop it names. Throws ApiError(401) for
// anything wrong with it, without saying which part.
export function verifyAiToken(token) {
  const secret = requireSecret();
  const refuse = (message = "The service token is invalid or has expired.") =>
    new ApiError(401, message, [], "UNAUTHENTICATED");

  let claims;
  try {
    claims = jwt.verify(token, secret, {
      algorithms: ["HS256"], // never the algorithm the token asks for
      issuer: AI_ISSUER,
      audience: NODE_ISSUER,
    });
  } catch {
    throw refuse();
  }

  if (typeof claims.iat !== "number" || typeof claims.exp !== "number") throw refuse();
  // A token that lives longer than the contract allows is refused even if it is otherwise valid.
  if (claims.exp - claims.iat > MAX_LIFETIME_SECONDS) {
    throw refuse("The service token lives longer than allowed.");
  }
  if (typeof claims.business_id !== "string" || !UUID.test(claims.business_id)) {
    throw refuse("The service token does not name a shop.");
  }

  return { businessId: claims.business_id.toLowerCase() };
}
