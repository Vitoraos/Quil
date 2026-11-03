// src/pages/Settings.tsx
// Settings page: API key (BYOK) then Account section.
// Sticky in-page nav on wide screens.

import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, Card, Input, Segmented, Chip, StatusMessage, Textarea, FeatherPen, PenLoader } from '../ui'
import models from '../config/models.json'

export default function Settings(): React.ReactElement {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [provider, setProvider] = React.useState<'anthropic' | 'openai' | 'google' | 'openrouter'>('anthropic')
  const [key, setKey] = React.useState('')
  const [storage, setStorage] = React.useState<'session' | 'encrypted'>('session')
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ status: 'not-set' | 'connected' | 'invalid' | 'rate-limited' | 'network-error'; provider?: string; lastFour?: string }>({
    status: 'not-set',
  })

  const recommendedModels = models.models.filter((m) => m.provider === provider && m.recommended)

  const handleTestKey = async (): Promise<void> => {
    setTesting(true)
    setTestResult({ status: 'not-set' })
    try {
      // In production this calls the Edge Function with the key.
      // For tests, fake provider never hits the network.
      if (import.meta.env.VITE_TEST_FAKE_AUTH === 'true' && key.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        setTestResult({ status: 'connected', provider, lastFour: key.slice(-4) })
        return
      }
      setTestResult({ status: 'invalid' })
    } catch {
      setTestResult({ status: 'network-error' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = (): void => {
    // Save key (session-only or encrypted)
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
        <Button variant="neutral" onClick={() => signOut()}>
          Sign out
        </Button>
      </header>

      <div style={{ padding: 'var(--quil-space-8)', maxWidth: 700 }}>
        <nav style={{ position: 'sticky', top: 'var(--quil-space-4)', marginBottom: 'var(--quil-space-6)' }}>
          <Segmented
            items={[
              { value: 'api-key', label: 'API key' },
              { value: 'account', label: 'Account' },
            ]}
            value="api-key"
            onChange={() => {}}
          />
        </nav>

        {/* API Key Section */}
        <section>
          <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-1)' }}>Your AI provider key</h2>
          <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-6)' }}>
            Quil needs a key to generate design variants. It is held in memory only, never logged, and sent only to your provider through Quil's server function.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-4)', marginBottom: 'var(--quil-space-6)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-2)' }}>Provider</div>
            <Segmented
              items={[
                { value: 'anthropic', label: 'Anthropic' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'google', label: 'Google' },
                { value: 'openrouter', label: 'OpenRouter' },
              ]}
              value={provider}
              onChange={(v: string) => setProvider(v as 'anthropic' | 'openai' | 'google' | 'openrouter')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-4)', marginBottom: 'var(--quil-space-6)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-2)' }}>Model</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-2)' }}>
              {recommendedModels.map((m) => (
                <Chip key={m.apiId} variant="accent" style={{ display: 'inline-flex' }}>
                  {m.label} <span style={{ fontSize: 'var(--quil-text-xs)', opacity: 0.8, marginLeft: 'var(--quil-space-1)' }}>{m.why}</span>
                </Chip>
              ))}
              {!recommendedModels.length && <span style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>No recommended models for this provider.</span>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-4)', marginBottom: 'var(--quil-space-6)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-2)' }}>Key</div>
            <div style={{ position: 'relative' }}>
              <Input
                type="password"
                placeholder="sk-…"
                value={key}
                onChange={(e) => setKey(e.target.value.trim())}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                style={{ paddingRight: 'var(--quil-space-10)' }}
              />
              <FeatherPen style={{ position: 'absolute', right: 'var(--quil-space-3)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} size={16} />
            </div>
            <p style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
              Trim pasted whitespace. Turn off autocomplete, spellcheck and autocapitalize.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-4)', marginBottom: 'var(--quil-space-6)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-2)' }}>Storage</div>
            <Segmented
              items={[
                { value: 'session', label: 'This session only' },
                { value: 'encrypted', label: 'Save encrypted to my account' },
              ]}
              value={storage}
              onChange={(v: string) => setStorage(v as 'session' | 'encrypted')}
            />
            <p style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
              Default: forgotten when the tab closes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--quil-space-3)', marginBottom: 'var(--quil-space-6)' }}>
            <Button variant="primary" onClick={handleTestKey} disabled={testing || !key}>
              {testing ? <PenLoader size={20} loading={true} /> : 'Test and save'}
            </Button>
            <Button variant="neutral" onClick={handleSave} disabled={!key || testing}>
              Save
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-2)', marginBottom: 'var(--quil-space-6)' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: testResult.status === 'connected' ? 'color-mix(in oklab, var(--quil-text-100) 60%, var(--quil-bg))' : 'var(--quil-line)',
              }}
            />
            <span style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)' }}>
              {testResult.status === 'connected' ? `Connected (${testResult.provider ?? provider}, …${testResult.lastFour ?? '****'}, ${storage} storage)` : testResult.status === 'not-set' ? 'Not set' : testResult.status}
            </span>
          </div>

          <Button variant="neutral" onClick={() => setKey('')}>
            Remove key
          </Button>
        </section>

        {/* Account Section */}
        <section style={{ marginTop: 'var(--quil-space-12)' }}>
          <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-1)' }}>Account</h2>
          <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-6)' }}>
            Signed in with {user?.provider ?? 'provider'}. Signing out ends the session and clears any in-memory key.
          </p>

          <Card padded style={{ border: '1px solid var(--quil-line)' }}>
            <div style={{ display: 'flex', gap: 'var(--quil-space-3)', marginBottom: 'var(--quil-space-4)' }}>
              <div style={{ fontWeight: 600 }}>Provider</div>
              <span style={{ color: 'var(--quil-text-70)' }}>{user?.provider ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--quil-space-3)', marginBottom: 'var(--quil-space-4)' }}>
              <div style={{ fontWeight: 600 }}>Name</div>
              <span style={{ color: 'var(--quil-text-70)' }}>{user?.name ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--quil-space-3)' }}>
              <div style={{ fontWeight: 600 }}>Email</div>
              <span style={{ color: 'var(--quil-text-70)' }}>{user?.email ?? '—'}</span>
            </div>
          </Card>

          <div style={{ marginTop: 'var(--quil-space-6)' }}>
            <Button variant="neutral" onClick={() => signOut()}>
              Sign out
            </Button>
            <span style={{ marginLeft: 'var(--quil-space-2)', color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>
              Also clear local copies of my projects
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
