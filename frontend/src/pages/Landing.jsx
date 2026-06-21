import { useNavigate } from 'react-router-dom'

// Full-viewport cinematic landing. Minimal by design — enhanced later.
export default function Landing() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-6)',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(124,111,224,0.18), transparent 60%), radial-gradient(900px 500px at 50% 120%, rgba(78,205,196,0.10), transparent 55%), var(--color-bg)',
      }}
    >
      <p
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.35em',
          fontSize: '0.8rem',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-5)',
        }}
      >
        Alter
      </p>

      <h1
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 5rem)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(180deg, #ffffff, #b9b5e6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Watch yourself live.
      </h1>

      <p
        style={{
          marginTop: 'var(--space-5)',
          maxWidth: 540,
          fontSize: 'clamp(1rem, 2.4vw, 1.25rem)',
          color: 'var(--color-text-secondary)',
        }}
      >
        Create your AI self. Set it free. See what it becomes.
      </p>

      <button
        className="btn-primary"
        style={{ marginTop: 'var(--space-8)', fontSize: '1.05rem' }}
        onClick={() => navigate('/auth')}
      >
        Create your Alter
      </button>
    </div>
  )
}
