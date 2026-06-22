import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

// Supabase client — auth source of truth, also used by useAuth.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
})

// Request interceptor: attach the current Supabase access token.
api.interceptors.request.use(async (config) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch (err) {
    console.error('Failed to attach auth token', err)
  }
  return config
})

// Response interceptor: handle auth expiry and network errors.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.error('signOut during 401 handling failed', e)
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
        window.location.assign('/auth')
      }
    } else if (!error?.response) {
      console.error('Network error', error?.message || error)
    }
    return Promise.reject(error)
  }
)

// --- Typed API functions -------------------------------------------------

export async function createAgent(profile) {
  const { data } = await api.post('/agent/create', profile)
  return data
}

// Returns null on 404 (no agent yet) instead of throwing.
export async function getAgent() {
  try {
    const { data } = await api.get('/agent/me')
    return data
  } catch (err) {
    if (err?.response?.status === 404) return null
    throw err
  }
}

export async function getAgentState() {
  const { data } = await api.get('/agent/state')
  return data
}

export async function getEventFeed(limit = 50) {
  const { data } = await api.get('/simulation/feed', { params: { limit } })
  return data
}

// Kept for compatibility with hooks/useSimulation.js (world status stub).
export async function getWorldStatus() {
  try {
    const { data } = await api.get('/world/status')
    return data
  } catch (err) {
    console.error('getWorldStatus failed', err)
    return null
  }
}

export async function getMemories(limit = 20) {
  try {
    const res = await api.get(`/simulation/memories?limit=${limit}`)
    return res.data || []
  } catch {
    return []
  }
}

export async function getWorldAgents() {
  try {
    const res = await api.get('/world/agents')
    return res.data || []
  } catch {
    return []
  }
}

export default api
