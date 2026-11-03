// src/pages/AuthCallback.tsx
// OAuth callback: exchanges the code for a session, then redirects.
// Shows only a spinner and error state.

import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FeatherPen, PenLoader, StatusMessage, Card } from '../ui'

export default function AuthCallback(): React.ReactElement {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signInWith, loading, error, clearError } = useAuth()
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const providerError = searchParams.get('error')

  React.useEffect(() => {
    if (providerError) {
      navigate(`/signin?next=${encodeURIComponent(searchParams.get('next') ?? '/projects')}`, { replace: true })
    }
    // In production, exchange the code via Supabase Auth here.
    // The fake provider handles sign-in through the context.
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--quil-bg)',
        color: 'var(--quil-text-100)',
        fontFamily: 'var(--quil-font-ui)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <Card padded style={{ width: 420, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--quil-space-2)', marginBottom: 'var(--quil-space-6)' }}>
          <FeatherPen size={24} />
          <span style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)' }}>Quil</span>
        </div>
        {loading ? (
          <>
            <PenLoader size={48} loading={true} />
            <p style={{ marginTop: 'var(--quil-space-4)', color: 'var(--quil-text-70)' }}>Signing you in…</p>
          </>
        ) : error ? (
          <StatusMessage variant="error" message={error} />
        ) : (
          <StatusMessage variant="default" message="Welcome to Quil. Redirecting…" />
        )}
      </Card>
    </div>
  )
}
