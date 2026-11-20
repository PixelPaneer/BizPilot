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

export function normalizeWhatsAppNumber(value) {
  const number = value.trim().replace(/[\s()-]/g, '')
  if (/^[6-9]\d{9}$/.test(number)) return `+91${number}`
  if (/^\+91[6-9]\d{9}$/.test(number)) return number
  return null
}

// Returns { user, accessToken }.
export function loginOwner(identifier, password) {
  const whatsappNumber = normalizeWhatsAppNumber(identifier)
  const credentials = whatsappNumber
    ? { whatsappNumber, password }
    : { email: identifier.trim().toLowerCase(), password }

  return apiRequest('/auth/login', { method: 'POST', body: credentials })
}

export function sendWhatsAppOtp(whatsappNumber) {
  return apiRequest('/auth/whatsapp/send-otp', {
    method: 'POST',
    body: { whatsappNumber },
  })
}

export function verifyWhatsAppOtp(whatsappNumber, otp) {
  return apiRequest('/auth/whatsapp/verify-otp', {
    method: 'POST',
    body: { whatsappNumber, otp },
  })
}

// Ends the sign-in on the server (the refresh cookie stops working).
export function logoutOwner() {
  return apiRequest('/auth/logout', { method: 'POST' })
}
