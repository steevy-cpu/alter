import { memo } from 'react'

// Minimal centered spinner using the primary accent.
function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        minHeight: '40vh',
        color: 'var(--color-text-secondary)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          animation: 'alter-spin 0.8s linear infinite',
        }}
      />
      <span>{label}</span>
      <style>{`@keyframes alter-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default memo(LoadingSpinner)
