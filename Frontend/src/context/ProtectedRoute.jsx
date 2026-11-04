import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contextValues'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/signIn" replace state={{ from: location }} />
  }

  return children
}

export default ProtectedRoute
