// Small fetch wrapper for the BizPilot API (all routes live under /api/v1).
// The Vite dev server proxies /api to the Express backend (see vite.config.js).

const API_BASE = '/api/v1'

export class ApiRequestError extends Error {
  constructor(message, { status = 0, code = null, errors = [] } = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

// Sends a request, unwraps `response.data`, and throws ApiRequestError on any failure.
export async function apiRequest(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      // FormData (file uploads) is sent as is, so the browser sets its own multipart header.
      headers:
        body === undefined || body instanceof FormData
          ? undefined
          : { 'Content-Type': 'application/json' },
      body:
        body === undefined || body instanceof FormData ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiRequestError('Unable to reach the server. Please check your connection.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok || !payload?.success) {
    throw new ApiRequestError(payload?.message || `Request failed (${response.status}).`, {
      status: response.status,
      code: payload?.code ?? null,
      errors: Array.isArray(payload?.errors) ? payload.errors : [],
    })
  }

  return payload.data
}
