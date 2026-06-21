import { create } from 'zustand'

// Central game state. Most actions are atomic (one state change). addEvent is
// the exception: it also accepts a "daily_update" payload and applies the full
// day transition in one coherent set().
export const useGameStore = create((set) => ({
  // --- State ---
  user: null,
  agent: null,
  emotionalState: null,
  eventFeed: [],
  relationships: [],
  wsConnected: false,
  currentReflection: null,
  currentDayPlan: null,
  gameDay: 0,
  daysLived: 0,

  // --- Atomic actions ---
  setUser: (user) => set({ user }),
  setAgent: (agent) => set({ agent }),
  updateEmotionalState: (emotionalState) => set({ emotionalState }),
  updateRelationships: (relationships) => set({ relationships }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setReflection: (reflection) => set({ currentReflection: reflection }),
  setDayPlan: (plan) => set({ currentDayPlan: plan }),
  setGameDay: (day) => set({ gameDay: day }),
  setDaysLived: (daysLived) => set({ daysLived }),
  setEventFeed: (eventFeed) => set({ eventFeed }),

  // addEvent: a single event OR a full "daily_update" payload.
  addEvent: (event) =>
    set((state) => {
      // daily_update payloads carry an `events` array — apply the full day.
      if (event && Array.isArray(event.events)) {
        const dayEvents = event.events.map((e) => ({
          ...e,
          game_day: event.game_day,
        }))
        return {
          // Newest at top: this day's events prepended (evening first).
          eventFeed: [...dayEvents.slice().reverse(), ...state.eventFeed],
          emotionalState: event.emotional_state ?? state.emotionalState,
          currentReflection: {
            reflection: event.reflection,
            lesson: event.lesson,
            memory_to_keep: event.memory_to_keep,
            tomorrow_intention: event.tomorrow_intention,
            inner_thought: event.inner_thought,
          },
          currentDayPlan: {
            morning_mood: event.morning_mood,
            daily_intention: event.daily_intention,
            inner_thought: event.inner_thought,
          },
          gameDay: event.game_day ?? state.gameDay,
          daysLived: event.days_lived ?? state.daysLived,
        }
      }
      // Single event: prepend.
      return { eventFeed: [event, ...state.eventFeed] }
    }),
}))
