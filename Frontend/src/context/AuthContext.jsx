import { useEffect, useState } from 'react'
import { AuthContext } from './contextValues'
import { refreshAccessToken } from '../utils/apiClient'
import { loginOwner, logoutOwner, registerOwner } from '../utils/authApi'
import {
  clearAccessToken,
  hasSessionHint,
  setAccessToken,
  UNAUTHORIZED_EVENT,
} from '../utils/session'

// status:
//   'checking'     this browser was signed in; asking the server for a fresh access token
//   'signedIn'     there is an access token
//   'signedOut'    no sign-in
//   'unavailable'  the server could not be reached while checking; the sign-in may still be good
//
// The owner stays signed in through the refresh cookie (see utils/session.js). When the server
// ends the sign-in, apiClient clears the state and sends UNAUTHORIZED_EVENT, which signs out here.
export function AuthProvider({ children }) {
  const [status, setStatus] = useState(() => (hasSessionHint() ? 'checking' : 'signedOut'))

  useEffect(() => {
    if (status !== 'checking') return undefined

    let cancelled = false
    refreshAccessToken().then((outcome) => {
      if (cancelled) return
      if (outcome === 'refreshed') {
        setStatus('signedIn')
      } else if (outcome === 'ended') {
        clearAccessToken()
        setStatus('signedOut')
      } else {
        setStatus('unavailable')
      }
    })
    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    const handleUnauthorized = () => setStatus('signedOut')
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  // Throws ApiRequestError (wrong password, inactive account, server down) for the form to show.
  async function signIn(email, password) {
    const { accessToken } = await loginOwner(email, password)
    setAccessToken(accessToken)
    setStatus('signedIn')
  }

  // Creates the account and its business, then signs in with the same details.
  async function signUp(details) {
    await registerOwner(details)
    await signIn(details.email, details.password)
  }

  function signOut() {
    // Ends the sign-in on the server too (so the refresh cookie stops working); the screen does
    // not wait for it.
    logoutOwner().catch((error) => console.error('Unable to end the session on the server.', error))
    clearAccessToken()
    setStatus('signedOut')
  }

  if (status === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (status === 'unavailable') {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center" role="alert">
        <div>
          <p className="text-muted">Could not reach the server. Please check your connection.</p>
          <button
            type="button"
            onClick={() => setStatus('checking')}
            className="mt-3 rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-deep"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const value = { isAuthenticated: status === 'signedIn', signIn, signUp, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
