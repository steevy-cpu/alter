import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/api.js'
import { useGameStore } from '../stores/gameStore.js'

// Auth hook wrapping Supabase Auth. Exposes the current session/user plus
// signUp / signIn / signOut helpers.
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const setUser = useGameStore((s) => s.setUser)

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setUser(data.session?.user ?? null)
        setLoading(false)
      })
      .catch((err) => {
        console.error('getSession failed', err)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [setUser])

  const signUp = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      return { data, isNewUser: true }
    } catch (err) {
      console.error('signUp failed', err)
      throw err
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return { data, isNewUser: false }
    } catch (err) {
      console.error('signIn failed', err)
      throw err
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('signOut failed', err)
    }
  }, [])

  return { session, user: session?.user ?? null, loading, signUp, signIn, signOut }
}
