import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { signAiToken } from "../utils/serviceToken.js";

const DEFAULT_TIMEOUT_MS = 15000;

// The only way this backend calls the Python AI service. Each call carries a fresh service token
// naming the shop. A service that is down, slow or answering nonsense becomes one error the owner
// can be told about: 502 AI_UNAVAILABLE.
export async function callAi(businessId, path, { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const token = signAiToken(businessId);

  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${env.aiServiceUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError(502, "The AI service could not be reached.", [], "AI_UNAVAILABLE");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(502, "The AI service could not handle the request.", [], "AI_UNAVAILABLE");
  }

  return payload;
}

// Foundation check, Node -> AI: proves the shared secret works in this direction.
export function pingAi(businessId) {
  return callAi(businessId, "/internal/ping", { method: "POST" });
}
