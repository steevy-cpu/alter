import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'
import World from './pages/World.jsx'
import WorldScene from './world/WorldScene.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/world"
        element={
          <ProtectedRoute>
            <World />
          </ProtectedRoute>
        }
      />
      {/* 3D city (Steeve test flow). Public so the render/animation path can be
          tested without auth; the /ws/world stream is for the single test player. */}
      <Route path="/world3d" element={<WorldScene />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
