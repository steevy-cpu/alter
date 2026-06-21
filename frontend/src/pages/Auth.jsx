import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getAgent } from '../services/api.js'

// Login / signup toggle backed by Supabase Auth. New users go to onboarding;
// returning users with an agent go to the dashboard.
export default function Auth() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password)
        navigate('/onboarding')
        return
      }

      await signIn(email, password)
      // Returning user: route to dashboard if they already have an agent,
      // otherwise send them to finish onboarding.
      try {
        const agent = await getAgent()
        navigate(agent && agent.id ? '/dashboard' : '/onboarding')
      } catch {
        navigate('/onboarding')
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ marginBottom: 'var(--space-2)' }}>
          {mode === 'login' ? 'Welcome back' : 'Create your Alter'}
        </h1>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-5)',
          }}
        >
          {mode === 'login'
            ? 'Sign in to watch your self live.'
            : 'Start by creating your account.'}
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>{error}</p>
          )}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Sign up'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
          }}
          style={{
            marginTop: 'var(--space-5)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.9rem',
          }}
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
