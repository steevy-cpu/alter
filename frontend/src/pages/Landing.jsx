import { useNavigate } from 'react-router-dom'
import WorldCanvas from '../components/WorldCanvas.jsx'

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
        zIndex: 1,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <WorldCanvas
        emotionalState={{ energy: 65, loneliness: 30, stress: 20 }}
        hasEncounter={false}
      />
      <div className="vignette" />

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
