// WebSocket helper — builds the per-user socket URL from the API base.
// The actual connection lifecycle (reconnect, dispatch) lives in
// hooks/useWebSocket.js; this module just centralizes URL construction.

export function buildSocketUrl(userId) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const wsBase = apiUrl.replace(/^http/, 'ws')
  return `${wsBase}/ws/${userId}`
}

export function createSocket(userId) {
  return new WebSocket(buildSocketUrl(userId))
}
