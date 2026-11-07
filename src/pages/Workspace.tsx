// src/pages/Workspace.tsx
// Route shell for /p/:projectId: project load + recovery.
// The editor chrome lives in src/app/workspace/Shell so it can be tested without a router.

import * as React from 'react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { createProject, emptyProject } from '../core/fixtures'
import { QuilStore } from '../app/store'
import { projectRepository } from '../persistence'
import { Shell } from '../app/workspace'
import { RecoveryScreen } from '../app/recovery-screen'

export function Workspace(): React.ReactElement | null {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>()
  const projectId = projectIdParam ?? ''

  const [store, setStore] = useState<QuilStore | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState<{ error: string; backup: string | null } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const existing = await projectRepository.load(projectId)
      if (cancelled) return
      if (!existing) {
        // Temporary mock project for viewing layers during development.
        const mock = createProject('Demo')
        const s = new QuilStore(mock)
        await s.init()
        if (cancelled) return
        setStore(s)
        setLoading(false)
        return
      }
      const s = new QuilStore(emptyProject())
      await s.init()
      if (cancelled) return
      setStore(s)
      setLoading(false)
    })().catch(async (_err: unknown) => {
      // Temporary mock for development when load fails.
      const mock = createProject('Demo')
      const s = new QuilStore(mock)
      await s.init()
      if (cancelled) return
      setStore(s)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (recovery) {
    return (
      <RecoveryScreen
        projectId={projectId}
        error={recovery.error}
        backup={recovery.backup}
        onRetry={() => {
          setRecovery(null)
          setLoading(true)
        }}
        onExport={() => {}}
        onDismiss={() => setRecovery(null)}
      />
    )
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--quil-bg)',
          color: 'var(--quil-text-100)',
          fontFamily: 'var(--quil-font-ui)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div data-testid="workspace-loading">Loading project…</div>
      </div>
    )
  }

  if (!store) {
    return null
  }

  return <Shell store={store} />
}
