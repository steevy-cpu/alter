// WebSocket helper — builds the per-user socket URL from the API base and
// attaches the current Supabase session token as a query parameter so the
// backend can verify the connection matches the claimed user_id.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function buildSocketUrl(userId) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  // Strip trailing slash so VITE_API_URL ending in "/" doesn't produce a
  // double slash (wss://host//ws/...).
  const wsBase = apiUrl.replace(/\/+$/, '').replace(/^http/, 'ws')

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  return `${wsBase}/ws/${userId}?token=${token}`
}

export function createSocket(userId) {
  // buildSocketUrl is async — callers must await the returned Promise.
  return buildSocketUrl(userId).then((url) => new WebSocket(url))
}
