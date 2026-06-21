import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-6)',
      }}
    >
      <h1 style={{ fontSize: '4rem', color: 'var(--color-primary)' }}>404</h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        This part of the world doesn’t exist yet.
      </p>
      <Link to="/" className="btn-ghost" style={{ marginTop: 'var(--space-4)' }}>
        Back to the beginning
      </Link>
    </div>
  )
}
