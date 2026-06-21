import { useEffect, useState, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useGameStore } from '../stores/gameStore.js'
import { getAgent, getEventFeed } from '../services/api.js'

// Stat → color mapping. Two stats use inline hex per the design spec
// (amber + muted purple); the rest use CSS custom properties.
const STAT_META = [
  { key: 'energy', label: 'Energy', color: 'var(--color-secondary)' },
  { key: 'happiness', label: 'Happiness', color: '#F9CB42' },
  { key: 'stress', label: 'Stress', color: 'var(--color-danger)' },
  { key: 'motivation', label: 'Motivation', color: 'var(--color-primary)' },
  { key: 'loneliness', label: 'Loneliness', color: '#9B99B5' },
]

const KEYFRAMES = `
@keyframes slideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
`

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Live updates flow into the store via this hook.
  useWebSocket(user?.id)

  const agent = useGameStore((s) => s.agent)
  const emotionalState = useGameStore((s) => s.emotionalState)
  const eventFeed = useGameStore((s) => s.eventFeed)
  const relationships = useGameStore((s) => s.relationships)
  const wsConnected = useGameStore((s) => s.wsConnected)
  const currentReflection = useGameStore((s) => s.currentReflection)
  const currentDayPlan = useGameStore((s) => s.currentDayPlan)
  const gameDay = useGameStore((s) => s.gameDay)

  const setAgent = useGameStore((s) => s.setAgent)
  const setEventFeed = useGameStore((s) => s.setEventFeed)
  const updateEmotionalState = useGameStore((s) => s.updateEmotionalState)
  const setGameDay = useGameStore((s) => s.setGameDay)

  const [toast, setToast] = useState(null)

  // Initial load: agent + past feed. Redirect to onboarding if no agent.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const loaded = await getAgent()
        if (!active) return
        if (!loaded) {
          navigate('/onboarding')
          return
        }
        setAgent(loaded)
        if (loaded.state) updateEmotionalState(loaded.state)

        const feed = await getEventFeed()
        if (!active) return
        // Normalize game_events rows into the feed shape the UI renders.
        const normalized = (feed || []).map((row) => ({
          id: row.id,
          title: row.title,
          description: row.content,
          event_type: row.event_type,
          game_day: row.game_day,
          time_of_day: row.metadata?.time_of_day || null,
        }))
        setEventFeed(normalized)
        const latestDay = normalized.reduce((m, e) => Math.max(m, e.game_day || 0), 0)
        if (latestDay) setGameDay(latestDay)
      } catch (err) {
        console.error('Dashboard load failed', err)
      }
    })()
    return () => {
      active = false
    }
  }, [navigate, setAgent, setEventFeed, updateEmotionalState, setGameDay])

  // Show a "Day N complete" toast whenever a new day lands via WebSocket.
  useEffect(() => {
    if (!gameDay) return
    setToast(`Day ${gameDay} complete`)
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [gameDay])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '280px 1fr 260px',
        gap: 'var(--space-5)',
        padding: 'var(--space-6)',
        background: 'var(--color-bg)',
        alignItems: 'start',
      }}
    >
      <style>{KEYFRAMES}</style>

      <EmotionalStatePanel
        agent={agent}
        emotionalState={emotionalState}
        wsConnected={wsConnected}
      />

      <EventFeed events={eventFeed} gameDay={gameDay} />

      <ReflectionPanel
        reflection={currentReflection}
        dayPlan={currentDayPlan}
        relationships={relationships}
      />

      {toast && <Toast message={toast} />}
    </div>
  )
}

// --- Left panel: emotional state + identity --------------------------------
const EmotionalStatePanel = memo(function EmotionalStatePanel({
  agent,
  emotionalState,
  wsConnected,
}) {
  return (
    <aside className="card" style={{ position: 'sticky', top: 'var(--space-6)' }}>
      <h3 style={{ marginBottom: 'var(--space-1)' }}>{agent?.name || 'Your Alter'}</h3>
      <p
        style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.85rem',
          marginBottom: 'var(--space-5)',
        }}
      >
        {agent?.occupation || 'waking up…'}
        {agent?.city ? ` · ${agent.city}` : ''}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {STAT_META.map((stat) => {
          const value = emotionalState?.[stat.key] ?? 0
          return (
            <div key={stat.key}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.85rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                <span>{stat.label}</span>
                <span>{value}</span>
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
                    width: `${value}%`,
                    height: '100%',
                    background: stat.color,
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-6)',
          fontSize: '0.85rem',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: wsConnected ? 'var(--color-success)' : 'var(--color-text-muted)',
            boxShadow: wsConnected ? '0 0 10px var(--color-success)' : 'none',
          }}
        />
        {wsConnected ? 'Live' : 'Connecting...'}
      </div>
    </aside>
  )
})

// --- Center panel: narrative feed ------------------------------------------
const EventFeed = memo(function EventFeed({ events, gameDay }) {
  if (!events || events.length === 0) {
    return (
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          minHeight: '60vh',
          gap: 'var(--space-3)',
        }}
      >
        <h2>Your Alter is waking up...</h2>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: 360 }}>
          The first tick runs every 30 seconds. Stay here.
        </p>
      </section>
    )
  }

  // Render the feed, inserting a "Day N" badge whenever the day changes.
  let lastDay = null
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        maxHeight: 'calc(100vh - 96px)',
        overflowY: 'auto',
        paddingRight: 'var(--space-2)',
      }}
    >
      {events.map((event, i) => {
        const showDay = event.game_day != null && event.game_day !== lastDay
        if (showDay) lastDay = event.game_day
        return (
          <div key={event.id || i}>
            {showDay && <DayBadge day={event.game_day} />}
            <EventCard event={event} />
          </div>
        )
      })}
      {gameDay > 0 && events.length > 0 && lastDay == null && <DayBadge day={gameDay} />}
    </section>
  )
})

const DayBadge = memo(function DayBadge({ day }) {
  return (
    <div
      style={{
        display: 'inline-block',
        margin: 'var(--space-2) 0',
        padding: '2px 10px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-secondary)',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      Day {day}
    </div>
  )
})

const EventCard = memo(function EventCard({ event }) {
  return (
    <article
      className="card"
      style={{
        borderLeft: '3px solid var(--color-primary)',
        animation: 'slideIn 0.4s ease forwards',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {event.time_of_day && <Tag>{event.time_of_day}</Tag>}
      </div>
      <h4 style={{ marginBottom: 'var(--space-2)' }}>{event.title}</h4>
      <p style={{ color: 'var(--color-text-secondary)' }}>{event.description}</p>
      {event.event_type && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Tag muted>{event.event_type}</Tag>
        </div>
      )}
    </article>
  )
})

const Tag = memo(function Tag({ children, muted }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.72rem',
        textTransform: 'capitalize',
        background: 'var(--color-surface-raised)',
        color: muted ? 'var(--color-text-muted)' : 'var(--color-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      {children}
    </span>
  )
})

// --- Right panel: reflection + tomorrow + relationships --------------------
const ReflectionPanel = memo(function ReflectionPanel({ reflection, dayPlan, relationships }) {
  return (
    <aside
      className="card"
      style={{
        position: 'sticky',
        top: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}
    >
      {dayPlan?.inner_thought && (
        <div>
          <Label>Inner thought</Label>
          <p
            style={{
              fontStyle: 'italic',
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
            }}
          >
            “{dayPlan.inner_thought}”
          </p>
        </div>
      )}

      {reflection ? (
        <>
          <div>
            <Label>Today's reflection</Label>
            <p style={{ fontStyle: 'italic', color: 'var(--color-text-primary)' }}>
              {reflection.reflection}
            </p>
          </div>

          {reflection.lesson && (
            <p style={{ color: 'var(--color-secondary)', fontSize: '0.9rem' }}>
              ✦ {reflection.lesson}
            </p>
          )}

          {reflection.memory_to_keep && (
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.82rem',
              }}
            >
              {reflection.memory_to_keep}
            </p>
          )}

          {reflection.tomorrow_intention && (
            <div>
              <Label>Tomorrow</Label>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {reflection.tomorrow_intention}
              </p>
            </div>
          )}
        </>
      ) : (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Reflections will appear here as your Alter lives each day.
        </p>
      )}

      <div>
        <Label>Relationships</Label>
        {relationships && relationships.length > 0 ? (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {relationships.map((rel, i) => (
              <li key={rel.id || i} style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                {rel.name || 'Someone'} · {rel.relationship_type}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            No connections yet.
          </p>
        )}
      </div>
    </aside>
  )
})

const Label = memo(function Label({ children }) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: '0.72rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--color-text-muted)',
        marginBottom: 'var(--space-2)',
      }}
    >
      {children}
    </span>
  )
})

// --- Toast -----------------------------------------------------------------
const Toast = memo(function Toast({ message }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        right: 'var(--space-6)',
        padding: 'var(--space-3) var(--space-5)',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-primary)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-primary)',
        boxShadow: '0 8px 30px rgba(124, 111, 224, 0.25)',
        animation: 'toastIn 0.3s ease forwards',
        zIndex: 50,
      }}
    >
      {message}
    </div>
  )
})
