import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useGameStore } from '../stores/gameStore.js'
import { getAgent } from '../services/api.js'
import IsometricWorld from '../world/IsometricWorld.jsx'

export default function World() {
  const navigate = useNavigate()
  const { user } = useAuth()
  useWebSocket(user?.id)

  const agent = useGameStore((s) => s.agent)
  const eventFeed = useGameStore((s) => s.eventFeed)
  const setAgent = useGameStore((s) => s.setAgent)

  const [currentActivity, setCurrentActivity] = useState(null)

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
      } catch (err) {
        console.error('World load failed', err)
      }
    })()
    return () => { active = false }
  }, [navigate, setAgent])

  // Derive current activity from newest event in feed
  useEffect(() => {
    if (eventFeed && eventFeed.length > 0) {
      const newest = eventFeed[0]
      setCurrentActivity(`${newest.title} ${newest.description || ''}`)
    }
  }, [eventFeed])

  const avatarUrl = agent?.name
    ? `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(agent.name)}&backgroundColor=12121a&radius=50&size=128`
    : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-4) var(--space-6)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div>
          <h3 style={{ marginBottom: 2 }}>{agent?.name || 'Your Alter'}'s World</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            {agent?.city || 'Miami'} · Apartment
          </p>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/dashboard')}>
          Story view
        </button>
      </div>

      {/* Isometric canvas */}
      <div style={{
        width: '100%',
        height: 'calc(100vh - 80px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {agent && (
          <IsometricWorld
            agentName={agent.name}
            avatarUrl={avatarUrl}
            currentActivity={currentActivity}
          />
        )}
      </div>
    </div>
  )
}
