import { memo } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore.js'

// App chrome: a slim top bar with the wordmark and live-connection dot,
// wrapping page content on the dark background.
function Layout({ children }) {
  const wsConnected = useGameStore((s) => s.wsConnected)

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <Link
          to="/dashboard"
          style={{
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--color-text-primary)',
          }}
        >
          ALTER
        </Link>
        <span
          title={wsConnected ? 'Live' : 'Disconnected'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: wsConnected
                ? 'var(--color-secondary)'
                : 'var(--color-text-muted)',
              boxShadow: wsConnected ? '0 0 10px var(--color-secondary)' : 'none',
            }}
          />
          {wsConnected ? 'Live' : 'Offline'}
        </span>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  )
}

export default memo(Layout)
