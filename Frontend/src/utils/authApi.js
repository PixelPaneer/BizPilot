// Sign-up and sign-in calls (/api/v1/auth/*).
import { apiRequest } from './apiClient'

// Creates the owner and their business in one request. Returns { user, business }; there is no
// token yet, so the caller signs in next.
export function registerOwner({ firstName, lastName, email, whatsappNumber, password, business }) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { firstName, lastName, email, whatsappNumber, password, business },
  })
}

// Returns { user, accessToken }.
export function loginOwner(email, password) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password } })
}

// Ends the sign-in on the server (the refresh cookie stops working).
export function logoutOwner() {
  return apiRequest('/auth/logout', { method: 'POST' })
}
