import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

// Supabase client — used here for auth token retrieval and across hooks.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Axios instance pointed at the backend.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach the current Supabase access token to every request.
api.interceptors.request.use(async (config) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch (err) {
    // Non-fatal: request proceeds unauthenticated and the backend rejects it.
    console.error('Failed to attach auth token', err)
  }
  return config
})

// --- Typed API functions -------------------------------------------------

export async function createAgent(profile) {
  try {
    const { data } = await api.post('/agent/create', profile)
    return data
  } catch (err) {
    console.error('createAgent failed', err)
    throw err
  }
}

export async function getAgent() {
  try {
    const { data } = await api.get('/agent/')
    return data
  } catch (err) {
    console.error('getAgent failed', err)
    throw err
  }
}

export async function getEventFeed() {
  try {
    const { data } = await api.get('/simulation/feed')
    return data
  } catch (err) {
    console.error('getEventFeed failed', err)
    throw err
  }
}

export async function getWorldStatus() {
  try {
    const { data } = await api.get('/world/status')
    return data
  } catch (err) {
    console.error('getWorldStatus failed', err)
    throw err
  }
}

export default api
