import { useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useGameStore } from '../stores/gameStore.js'
import { statColor } from '../utils/helpers.js'

// Placeholder emotional state until the simulation streams real values.
const PLACEHOLDER_STATE = [
  { key: 'energy', label: 'Energy', value: 75 },
  { key: 'happiness', label: 'Happiness', value: 70 },
  { key: 'stress', label: 'Stress', value: 30 },
  { key: 'motivation', label: 'Motivation', value: 80 },
  { key: 'loneliness', label: 'Loneliness', value: 40 },
]

const PLACEHOLDER_EVENT = {
  title: 'A quiet morning',
  content:
    'Your Alter wakes before the alarm, makes coffee, and stares out at the city deciding what kind of day to have.',
  time: '08:14',
}

export default function Dashboard() {
  const { user } = useAuth()

  // Connect to the WebSocket; incoming messages are dispatched into the store.
  useWebSocket(user?.id)

  const emotionalState = useGameStore((s) => s.emotionalState)
  const eventFeed = useGameStore((s) => s.eventFeed)
  const relationships = useGameStore((s) => s.relationships)

  // Log live messages to the console for now (per spec).
  useEffect(() => {
    if (eventFeed.length) {
      console.log('Latest event', eventFeed[0])
    }
  }, [eventFeed])

  const stats =
    emotionalState
      ? Object.entries(emotionalState)
          .filter(([k]) =>
            ['energy', 'happiness', 'stress', 'motivation', 'loneliness'].includes(k)
          )
          .map(([key, value]) => ({ key, label: key, value }))
      : PLACEHOLDER_STATE

  const events = eventFeed.length ? eventFeed : [PLACEHOLDER_EVENT]

  return (
    <Layout>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 280px',
          gap: 'var(--space-5)',
          padding: 'var(--space-6)',
          maxWidth: 1400,
          margin: '0 auto',
          alignItems: 'start',
        }}
      >
        {/* Left — emotional state */}
        <aside className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Emotional state</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {stats.map((stat) => (
              <div key={stat.key}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--space-1)',
                    textTransform: 'capitalize',
                  }}
                >
                  <span>{stat.label}</span>
                  <span>{stat.value}</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--color-surface-raised)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${stat.value}%`,
                      height: '100%',
                      background: statColor(stat.value),
                      transition: 'width 300ms ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center — narrative feed */}
        <section>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>
            Your Alter is waking up…
          </h2>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-5)',
            }}
          >
            The world turns one tick at a time. Watch what unfolds.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {events.map((event, i) => (
              <article key={event.id || i} className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <h4 style={{ color: 'var(--color-secondary)' }}>
                    {event.title}
                  </h4>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {event.time || ''}
                  </span>
                </div>
                <p style={{ color: 'var(--color-text-primary)' }}>{event.content}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Right — relationships */}
        <aside className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Relationships</h3>
          {relationships.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              No connections yet. As your Alter lives, it will meet others.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {relationships.map((rel, i) => (
                <li key={rel.id || i}>
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    {rel.name || 'Someone'}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {rel.relationship_type} · {rel.strength}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </Layout>
  )
}
