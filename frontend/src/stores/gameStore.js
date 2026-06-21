import { create } from 'zustand'

// Central game state. Actions are atomic — one state change per action.
export const useGameStore = create((set) => ({
  // --- State ---
  user: null,
  agent: null,
  emotionalState: null,
  eventFeed: [],
  relationships: [],
  wsConnected: false,

  // --- Actions ---
  setUser: (user) => set({ user }),
  setAgent: (agent) => set({ agent }),
  addEvent: (event) =>
    set((state) => ({ eventFeed: [event, ...state.eventFeed] })),
  updateEmotionalState: (emotionalState) => set({ emotionalState }),
  updateRelationships: (relationships) => set({ relationships }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
}))
