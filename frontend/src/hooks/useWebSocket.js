import { useEffect, useRef } from 'react'
import { buildSocketUrl } from '../services/websocket.js'
import { useGameStore } from '../stores/gameStore.js'

// Opens a per-user WebSocket, dispatches incoming messages into the game store
// by type, auto-reconnects on drop, and closes cleanly on unmount.
export function useWebSocket(userId) {
  const socketRef = useRef(null)
  const reconnectRef = useRef(null)
  const closedByUnmount = useRef(false)

  const setWsConnected = useGameStore((s) => s.setWsConnected)
  const addEvent = useGameStore((s) => s.addEvent)
  const updateEmotionalState = useGameStore((s) => s.updateEmotionalState)
  const updateRelationships = useGameStore((s) => s.updateRelationships)

  useEffect(() => {
    if (!userId) return

    closedByUnmount.current = false

    const connect = () => {
      const ws = new WebSocket(buildSocketUrl(userId))
      socketRef.current = ws

      ws.onopen = () => setWsConnected(true)

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          switch (message.type) {
            case 'daily_update':
              // addEvent applies the whole day transition (events, mood,
              // reflection, day plan, game day) in one update.
              addEvent(message.payload)
              if (message.payload.relationships) {
                updateRelationships(message.payload.relationships)
              }
              break
            case 'event':
              addEvent(message.payload)
              break
            case 'emotional_state':
              updateEmotionalState(message.payload)
              break
            case 'relationships':
              updateRelationships(message.payload)
              break
            default:
              console.log('Unhandled WS message', message)
          }
        } catch (err) {
          console.error('Failed to parse WS message', err)
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        if (!closedByUnmount.current) {
          reconnectRef.current = setTimeout(connect, 3000)
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket error', err)
        ws.close()
      }
    }

    connect()

    return () => {
      closedByUnmount.current = true
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (socketRef.current) socketRef.current.close()
      setWsConnected(false)
    }
  }, [userId, setWsConnected, addEvent, updateEmotionalState, updateRelationships])

  return socketRef
}
