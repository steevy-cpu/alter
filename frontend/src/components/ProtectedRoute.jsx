import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from './LoadingSpinner.jsx'

// Gate for authenticated-only routes. While the session is resolving we show
// a spinner; once resolved, unauthenticated users are redirected to /auth.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner label="Waking up…" />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return children
}
