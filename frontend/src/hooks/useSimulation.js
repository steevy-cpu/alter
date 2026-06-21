import { useState, useEffect, useCallback } from 'react'
import { getAgent, getEventFeed, getWorldStatus } from '../services/api.js'
import { useGameStore } from '../stores/gameStore.js'

// Loads the agent, event feed, and world status once, and exposes a refresh
// function. The live stream of updates arrives via useWebSocket; this hook
// handles the initial REST hydration.
export function useSimulation() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const setAgent = useGameStore((s) => s.setAgent)
  const updateRelationships = useGameStore((s) => s.updateRelationships)

  const hydrate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [agent, feed, world] = await Promise.all([
        getAgent(),
        getEventFeed(),
        getWorldStatus(),
      ])
      setAgent(agent)
      // Feed/relationships wiring fills in as the backend returns real data.
      return { agent, feed, world }
    } catch (err) {
      console.error('useSimulation hydrate failed', err)
      setError(err)
      return null
    } finally {
      setLoading(false)
    }
  }, [setAgent])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return { loading, error, refresh: hydrate }
}
