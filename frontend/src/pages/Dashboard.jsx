import { useEffect, useState, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useGameStore } from '../stores/gameStore.js'
import { getAgent, getEventFeed, getMemories, getWorldAgents } from '../services/api.js'
import AgentAvatar from '../components/AgentAvatar.jsx'
import WorldMap from '../components/WorldMap.jsx'
import LifeTimeline from '../components/LifeTimeline.jsx'
import WorldCanvas from '../components/WorldCanvas.jsx'
import AgentViewer from '../components/AgentViewer.jsx'

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

  useWebSocket(user?.id)

  const agent = useGameStore((s) => s.agent)
  const emotionalState = useGameStore((s) => s.emotionalState)
  const eventFeed = useGameStore((s) => s.eventFeed)
  const relationships = useGameStore((s) => s.relationships)
  const wsConnected = useGameStore((s) => s.wsConnected)
  const currentReflection = useGameStore((s) => s.currentReflection)
  const currentDayPlan = useGameStore((s) => s.currentDayPlan)
  const gameDay = useGameStore((s) => s.gameDay)
  const daysLived = useGameStore((s) => s.gameDay)
  const encounterToast = useGameStore((s) => s.encounterToast)

  const setAgent = useGameStore((s) => s.setAgent)
  const setEventFeed = useGameStore((s) => s.setEventFeed)
  const updateEmotionalState = useGameStore((s) => s.updateEmotionalState)
  const setGameDay = useGameStore((s) => s.setGameDay)

  const [toast, setToast] = useState(null)
  const [memories, setMemories] = useState([])
  const [worldAgents, setWorldAgents] = useState([])
  const [currentLocation, setCurrentLocation] = useState(null)
  const [hasEncounter, setHasEncounter] = useState(false)
  const isFirstLoad = useRef(true)

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
        if (loaded.state) {
          const s = loaded.state
          const looksValid = !(s.energy === 0 && s.stress === 0)
          if (looksValid) updateEmotionalState(s)
        }

        const feed = await getEventFeed()
        if (!active) return
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

        const [mems, wa] = await Promise.all([getMemories(20), getWorldAgents()])
        if (!active) return
        setMemories(mems)
        setWorldAgents(wa)
      } catch (err) {
        console.error('Dashboard load failed', err)
      }
    })()
    return () => {
      active = false
    }
  }, [navigate, setAgent, setEventFeed, updateEmotionalState, setGameDay])

  // Pick location hint from newest event in feed when day advances.
  useEffect(() => {
    if (eventFeed && eventFeed.length > 0) {
      const newest = eventFeed[0]
      if (newest?.location) setCurrentLocation(newest.location)
    }
  }, [eventFeed])

  useEffect(() => {
    if (!encounterToast) return
    const t = setTimeout(() => useGameStore.getState().setEncounterToast(null), 4000)
    return () => clearTimeout(t)
  }, [encounterToast])

  useEffect(() => {
    if (encounterToast) {
      setHasEncounter(true)
      const t = setTimeout(() => setHasEncounter(false), 5000)
      return () => clearTimeout(t)
    }
  }, [encounterToast])

  useEffect(() => {
    if (!gameDay) return
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    setToast(`Day ${gameDay} complete`)
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [gameDay])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '300px 1fr 280px',
        gap: 'var(--space-5)',
        padding: 'var(--space-6)',
        background: 'transparent',
        position: 'relative',
        zIndex: 1,
        alignItems: 'start',
      }}
    >
      <WorldCanvas emotionalState={emotionalState} hasEncounter={hasEncounter} />
      <style>{KEYFRAMES}</style>

      <AgentIdentityPanel
        agent={agent}
        emotionalState={emotionalState}
        wsConnected={wsConnected}
        daysLived={daysLived}
        worldAgents={worldAgents}
        currentLocation={currentLocation}
      />

      <EventFeed events={eventFeed} gameDay={gameDay} />

      <RightPanel
        reflection={currentReflection}
        dayPlan={currentDayPlan}
        relationships={relationships}
        memories={memories}
      />

      {toast && <Toast message={toast} />}
      {encounterToast && <EncounterToast message={encounterToast} />}
    </div>
  )
}

// --- Left panel: avatar + identity + stats + map ---------------------------
const AgentIdentityPanel = memo(function AgentIdentityPanel({
  agent,
  emotionalState,
  wsConnected,
  daysLived,
  worldAgents,
  currentLocation,
}) {
  return (
    <aside className="card" style={{ position: 'sticky', top: 'var(--space-6)' }}>
      {/* 3D Character Viewer */}
      <AgentViewer emotionalState={emotionalState} />

      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <AgentAvatar name={agent?.name} size={80} showRing glowColor="primary" />
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'text-shadow var(--transition)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textShadow = 'var(--glow-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.textShadow = 'none')}
          >
            {agent?.name || 'Your Alter'}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', marginBottom: 2 }}>
            {agent?.occupation || 'waking up…'}
          </p>
          {agent?.city && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              {agent.city}
            </p>
          )}
          {daysLived > 0 && (
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Day {daysLived} of their life
            </p>
          )}
        </div>
      </div>

      {/* Emotional state */}
      <Label>State</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {STAT_META.map((stat) => {
          const value = emotionalState?.[stat.key] ?? 0
          return (
            <div key={stat.key}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.82rem',
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

      {/* World map */}
      <Label>World</Label>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <WorldMap agents={worldAgents} currentLocation={currentLocation} />
      </div>

      {/* Connection status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: '0.82rem',
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
            flexShrink: 0,
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
          The first tick runs every 2 minutes. Stay here.
        </p>
      </section>
    )
  }

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
  const isCrossPlayer = event.event_type === 'cross_player'
  const borderColor = isCrossPlayer ? 'var(--color-secondary)' : 'var(--color-primary)'

  return (
    <article
      className="card"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        animation: 'slideIn 0.4s ease forwards',
      }}
    >
      {isCrossPlayer && (
        <div
          style={{
            display: 'inline-block',
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-secondary)22',
            color: 'var(--color-secondary)',
            border: '1px solid var(--color-secondary)44',
            marginBottom: 'var(--space-2)',
          }}
        >
          ✦ Encounter
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {event.time_of_day && <Tag>{event.time_of_day}</Tag>}
        {event.location && isCrossPlayer && <Tag>{event.location}</Tag>}
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

// --- Right panel: tabbed sections ------------------------------------------
const RightPanel = memo(function RightPanel({ reflection, dayPlan, relationships, memories }) {
  const [activeSection, setActiveSection] = useState('life')

  return (
    <aside
      className="card"
      style={{
        position: 'sticky',
        top: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        maxHeight: 'calc(100vh - 96px)',
        overflowY: 'auto',
      }}
    >
      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
        {[
          { id: 'life', label: 'Inner Life' },
          { id: 'relationships', label: 'People' },
          { id: 'memories', label: 'Life Moments' },
        ].map((tab) => {
          const isActive = activeSection === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: isActive ? '1px solid var(--color-primary)' : 'none',
                paddingBottom: 4,
                cursor: 'pointer',
                transition: 'color var(--transition)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--color-text-muted)'
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Inner Life section */}
      {activeSection === 'life' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {dayPlan?.inner_thought && (
            <div>
              <Label>Inner thought</Label>
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                "{dayPlan.inner_thought}"
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
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
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
        </div>
      )}

      {/* Relationships section */}
      {activeSection === 'relationships' && (
        <div>
          {relationships && relationships.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {relationships.map((rel, i) => (
                <div key={rel.name || i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
                    <AgentAvatar name={rel.name} size={28} showRing={false} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rel.name}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', flexShrink: 0, marginLeft: 'var(--space-2)' }}>
                          {rel.relationship_type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--color-surface-raised)', overflow: 'hidden' }}>
                    <div style={{ width: `${rel.strength}%`, height: '100%', background: 'var(--color-secondary)', transition: 'width 0.8s ease' }} />
                  </div>
                  {rel.summary && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                      {rel.summary.slice(0, 80)}{rel.summary.length > 80 ? '…' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Your Alter is meeting people...
            </p>
          )}
        </div>
      )}

      {/* Memories section */}
      {activeSection === 'memories' && (
        <div>
          <LifeTimeline memories={memories} />
        </div>
      )}
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

// --- Toasts ----------------------------------------------------------------
const EncounterToast = memo(function EncounterToast({ message }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        left: 'var(--space-6)',
        padding: 'var(--space-3) var(--space-5)',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-secondary)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-primary)',
        boxShadow: '0 8px 30px rgba(78, 205, 196, 0.2)',
        animation: 'toastIn 0.3s ease forwards',
        zIndex: 50,
        maxWidth: 300,
        fontSize: '0.9rem',
      }}
    >
      ✦ {message}
    </div>
  )
})

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
