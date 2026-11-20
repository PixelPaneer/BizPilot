// Small fetch wrapper for the BizPilot API (all routes live under /api/v1).
// The Vite dev server proxies /api to the Express backend (see vite.config.js).

import {
  clearAccessToken,
  getAccessToken,
  hasSessionHint,
  setAccessToken,
  UNAUTHORIZED_EVENT,
} from './session'

const API_BASE = '/api/v1'

// Calls that must not trigger a refresh and a retry when they answer 401.
const AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/whatsapp/send-otp',
  '/auth/whatsapp/verify-otp',
]

export class ApiRequestError extends Error {
  constructor(message, { status = 0, code = null, errors = [] } = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

// ---- refreshing the access token -------------------------------------------------------------

let refreshInFlight = null

// Asks the server for a new access token using the refresh cookie. Resolves to:
//   'refreshed'    a new access token is now in use
//   'ended'        the server says the sign-in is over (expired, signed out elsewhere, revoked)
//   'unavailable'  the server could not be reached or had a problem; the sign-in may still be good
// Calls that overlap share one request, because the server accepts each refresh token once.
export function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = requestRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// For Refresh token functionality (When the user revisits BizPilot, the frontend tries to restore their session using the refresh token.)
async function requestRefresh() {
  let response
  try {
    response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
  } catch {
    return 'unavailable'
  }

  if (response.status === 401 || response.status === 403) return 'ended'
  if (!response.ok) return 'unavailable'

  try {
    const payload = await response.json()
    if (!payload?.data?.accessToken) return 'unavailable'
    setAccessToken(payload.data.accessToken)
    return 'refreshed'
  } catch {
    return 'unavailable'
  }
}

// ---- requests ---------------------------------------------------------------------------------

async function send(path, { method = 'GET', body } = {}) {
  const headers = {}
  // FormData (file uploads) is sent as is, so the browser sets its own multipart header.
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiRequestError('Unable to reach the server. Please check your connection.')
  }
}

// Sends a request, unwraps `response.data`, and throws ApiRequestError on any failure.
// If the access token has expired (401), it is refreshed once and the request is sent again.
export async function apiRequest(path, options = {}) {
  let response = await send(path, options)

  if (response.status === 401 && !AUTH_PATHS.includes(path) && hasSessionHint()) {
    const outcome = await refreshAccessToken()
    if (outcome === 'refreshed') {
      response = await send(path, options)
    } else if (outcome === 'ended') {
      clearAccessToken()
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
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
