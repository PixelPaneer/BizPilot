import { useContext, useEffect, useState } from 'react'
import { AuthContext, ProfileContext } from './contextValues'
import { apiRequest } from '../utils/apiClient'

// The signed-in owner and their shop (name, email, shop name), loaded once after sign-in.
// `profile` is null until it has loaded, or when signed out.
export function ProfileProvider({ children }) {
  const isAuthenticated = Boolean(useContext(AuthContext)?.isAuthenticated)
  const [loadedProfile, setLoadedProfile] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return undefined

    let cancelled = false
    let retryTimer

    // If the server is briefly unreachable, try again a few times (after 3, 6 and 12 seconds)
    // so the name appears on its own instead of staying blank until the page is reloaded.
    function load(attempt) {
      apiRequest('/profile')
        .then((data) => {
          if (!cancelled) setLoadedProfile(data)
        })
        .catch((error) => {
          console.error('Unable to load the profile.', error)
          if (!cancelled && attempt < 3) {
            retryTimer = setTimeout(() => load(attempt + 1), 3000 * 2 ** attempt)
          }
        })
    }
    load(0)

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
  }, [isAuthenticated])

  const value = { profile: isAuthenticated ? loadedProfile : null }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
