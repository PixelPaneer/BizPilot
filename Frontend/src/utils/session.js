// The sign-in state kept in the browser.
//
// The access token (short-lived) is held only in memory: it is gone when the page is closed, and
// scripts cannot find it in storage. What keeps the owner signed in between visits is the refresh
// token, which the server keeps in an httpOnly cookie that scripts cannot read. All this file
// stores is a harmless hint that a sign-in exists, so the app knows to ask for a new access token
// on start-up instead of showing the sign-in page.

const HINT_KEY = 'bizpilot-signed-in'
const OLD_KEYS = ['bizpilot-access-token', 'bizpilot-authenticated'] // earlier versions
export const UNAUTHORIZED_EVENT = 'bizpilot:unauthorized'

let accessToken = null

export function getAccessToken() {
  return accessToken
}

// Call after a successful sign-in or refresh.
export function setAccessToken(token) {
  accessToken = token
  try {
    localStorage.setItem(HINT_KEY, 'true')
    OLD_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.error('Unable to save the sign-in hint.', error)
  }
}

// True when this browser was signed in and has not signed out (or been signed out by the server).
export function hasSessionHint() {
  try {
    return localStorage.getItem(HINT_KEY) === 'true'
  } catch (error) {
    console.error('Unable to read the sign-in hint.', error)
    return false
  }
}

export function clearAccessToken() {
  accessToken = null
  try {
    localStorage.removeItem(HINT_KEY)
    OLD_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.error('Unable to clear the sign-in hint.', error)
  }
}
