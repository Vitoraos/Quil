// src/pages/SignIn.tsx
// Sign-in page: Google or Apple only. FeatherPen typing adornment in
// email/password fields; PenLoader behind submit during OAuth redirect.

import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, Input, FeatherPen, PenLoader, StatusMessage, Card } from '../ui'

export default function SignIn(): React.ReactElement {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next') ?? undefined
  const { signInWith, loading, error, clearError } = useAuth()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [providerError, setProviderError] = React.useState<string | null>(null)

  const handleGoogle = async (): Promise<void> => {
    setProviderError(null)
    try {
      await signInWith('google')
      if (next) navigate(next, { replace: true })
      else navigate('/projects', { replace: true })
    } catch {
      // error already set by context
    }
  }

  const handleApple = async (): Promise<void> => {
    setProviderError(null)
    try {
      await signInWith('apple')
      if (next) navigate(next, { replace: true })
      else navigate('/projects', { replace: true })
    } catch {
      // error already set by context
    }
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    setProviderError(null)
    // Email/password sign-up is not supported in the MVP; only OAuth providers.
    setProviderError('Email and password sign-in is not available. Use Continue with Google or Continue with Apple.')
  }

  const alreadySignedIn = false // session state would be checked by the auth context in production

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
      }}
    >
      {alreadySignedIn ? (
        <Card padded style={{ width: 420 }}>
          <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>Already signed in</h2>
          <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>You are already signed in. Redirecting to your projects.</p>
          <StatusMessage variant="default" message="Redirecting…" />
        </Card>
      ) : (
        <Card padded style={{ width: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-2)', marginBottom: 'var(--quil-space-6)' }}>
            <FeatherPen size={24} />
            <span style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)' }}>Quil</span>
          </div>

          <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-1)' }}>Start designing</h2>
          <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-6)' }}>
            Sign in to continue. Quil remembers every design decision you approve.
          </p>

          {error && (
            <StatusMessage variant="error" message={error} style={{ marginBottom: 'var(--quil-space-4)' }} />
          )}
          {providerError && (
            <StatusMessage variant="error" message={providerError} style={{ marginBottom: 'var(--quil-space-4)' }} />
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-3)', marginBottom: 'var(--quil-space-6)' }}>
            <div style={{ position: 'relative' }}>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                spellCheck={false}
                autoCapitalize="none"
              />
              <FeatherPen style={{ position: 'absolute', right: 'var(--quil-space-3)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} size={16} />
            </div>
            <div style={{ position: 'relative' }}>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                spellCheck={false}
                autoCapitalize="none"
              />
              <FeatherPen style={{ position: 'absolute', right: 'var(--quil-space-3)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} size={16} />
            </div>
            <Button
              variant="primary"
              type="submit"
              disabled={loading}
              style={{ position: 'relative' }}
            >
              {loading ? <PenLoader size={20} loading={true} /> : 'Continue'}
            </Button>
          </form>

          <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-4)', textAlign: 'center' }}>
            — Or continue with —
          </p>

          <Button
            variant="primary"
            onClick={handleGoogle}
            disabled={loading}
            style={{ width: '100%', marginBottom: 'var(--quil-space-2)', position: 'relative' }}
          >
            {loading ? <PenLoader size={20} loading={true} /> : 'Continue with Google'}
          </Button>
          <Button
            variant="neutral"
            onClick={handleApple}
            disabled={loading}
            style={{ width: '100%', position: 'relative' }}
          >
            {loading ? <PenLoader size={20} loading={true} /> : 'Continue with Apple'}
          </Button>

          <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-xs)', marginTop: 'var(--quil-space-4)', textAlign: 'center' }}>
            Signing in means agreeing to the terms. No email and password sign-up in the MVP.
          </p>
        </Card>
      )}
    </div>
  )
}
