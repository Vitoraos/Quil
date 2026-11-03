// src/router.tsx
// Client-side router for Quil. Routes:
//   /             — Landing (public)
//   /signin       — Sign-in (public)
//   /auth/callback — OAuth callback (public)
//   /projects     — Projects (signed in)
//   /p/:projectId — Workspace (signed in, owner only)
//   /settings     — Settings (signed in)

import * as React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import AuthCallback from './pages/AuthCallback'
import Projects from './pages/Projects'
import { Workspace } from './pages/Workspace'
import Settings from './pages/Settings'
import { IntakeWizard } from './pages/IntakeWizard'

// Guard: redirect unauthenticated users to sign-in with a next param.
function RequireAuth({ children }: { children: React.ReactElement }): React.ReactElement | null {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return null // still checking session
  }

  if (!user) {
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <>{children}</>
}

export function Router(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/projects"
          element={
            <RequireAuth>
              <Projects />
            </RequireAuth>
          }
        />
        <Route
          path="/p/:projectId"
          element={
            <RequireAuth>
              <Workspace />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/new/:step"
          element={
            <RequireAuth>
              <IntakeWizard />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
