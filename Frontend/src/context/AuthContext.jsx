import { useEffect, useState } from 'react'
import { AuthContext } from './contextValues'

const AUTH_STORAGE_KEY = 'bizpilot-authenticated'

function loadAuthenticated() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  } catch (error) {
    console.error('Unable to read authentication state from local storage.', error)
    return false
  }
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(loadAuthenticated)

  useEffect(() => {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, String(isAuthenticated))
    } catch (error) {
      console.error('Unable to save authentication state to local storage.', error)
    }
  }, [isAuthenticated])

  const value = {
    isAuthenticated,
    signIn: () => setIsAuthenticated(true),
    signOut: () => setIsAuthenticated(false),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
