// src/router.tsx
// Client-side router for Quil. Routes:
//   /             — Landing (public)
//   /p/:projectId — Workspace (public)
//   /settings     — Settings (public)
//   /new          — Intake wizard (public)

import * as React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import { Workspace } from './pages/Workspace'
import Settings from './pages/Settings'
import { IntakeWizard } from './pages/IntakeWizard'

export function Router(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/p/:projectId" element={<Workspace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/new" element={<IntakeWizard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
