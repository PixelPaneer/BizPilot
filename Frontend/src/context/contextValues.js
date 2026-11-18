import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export const InventoryContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) throw new Error('useInventory must be used within an InventoryProvider')
  return context
}
