// src/pages/Projects.tsx
// Projects page: list projects, start a new one.

import * as React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, Card, FeatherPen, StatusMessage } from '../ui'
import { projectRepository } from '../persistence'

export default function Projects(): React.ReactElement {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = React.useState<Array<{ id: string; name: string; updatedAt: string }>>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await projectRepository.listProjects()
      if (cancelled) return
      setProjects(
        list.map((p) => ({
          id: p.id,
          name: p.name,
          updatedAt: new Date(p.updatedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
        }))
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleNewProject = (): void => {
    navigate('/new/1')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--quil-bg)',
        color: 'var(--quil-text-100)',
        fontFamily: 'var(--quil-font-ui)',
      }}
    >
      <header style={{ padding: 'var(--quil-space-4) var(--quil-space-8)', display: 'flex', alignItems: 'center', gap: 'var(--quil-space-3)', borderBottom: `1px solid var(--quil-line)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--quil-space-2)' }}>
          <FeatherPen size={24} />
          <span style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)' }}>Quil</span>
        </div>
        <span style={{ flex: 1 }} />
        {user && (
          <span style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)' }}>
            {user.email}
          </span>
        )}
      </header>

      <div style={{ padding: 'var(--quil-space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-3)', marginBottom: 'var(--quil-space-6)' }}>
          <h1 style={{ fontSize: 'var(--quil-heading-1)', fontFamily: 'var(--quil-font-head)' }}>Projects</h1>
          <Button variant="primary" onClick={handleNewProject}>
            New project
          </Button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Loading projects…</div>
        ) : projects.length === 0 ? (
          <Card padded style={{ maxWidth: 500, textAlign: 'center' }}>
            <StatusMessage variant="default" message="No projects yet. Create your first one." />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-3)' }}>
            {projects.map((p) => (
              <Card
                key={p.id}
                padded
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color var(--quil-duration-press)',
                }}
                onClick={() => navigate(`/p/${p.id}`)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--quil-text-base)' }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>Updated {p.updatedAt}</div>
                </div>
                <span style={{ color: 'var(--quil-text-70)' }}>&gt;</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
