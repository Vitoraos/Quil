// src/components/landing/LiveDemo.tsx
// Live proof demo: imports Quil's real renderer (Canvas) + decision engine.
// Change one global button rule; only applicable buttons update. The promo
// button carries an instance override and stays put. No network, no auth, no AI.

import * as React from 'react'
import type { ElementId } from '../../core'
import { demoProject } from '../../core'
import { createResolver } from '../../app/resolve'
import { QuilStore } from '../../app/store'
import { Canvas } from '../../app/renderer'
import { Button, Card, FeatherPen, PenLoader, StatusMessage } from '../../ui'

const DEMO_PAGE_ID = 'page-demo' as never

const B1 = 'el-demo-btn-1' as ElementId
const B2 = 'el-demo-btn-2' as ElementId
const B3 = 'el-demo-btn-3' as ElementId // promo (instance override)
const B4 = 'el-demo-btn-4' as ElementId

const APPLICABLE = [B1, B2, B4]

const NEW_RULE = 'oklch(0.97 0.01 80)'   // near-white: clearly different from accent
const RESET_RULE = 'oklch(0.7 0.2 264)'  // approximates the accent token

const resolver = createResolver()

function ErrorFallback({ error }: { error: Error }): React.ReactElement {
  return (
    <Card padded style={{ width: '100%', maxWidth: 700, margin: '0 auto' }}>
      <StatusMessage variant="error" message={`Demo unavailable — ${error.message}`} />
    </Card>
  )
}

class DemoErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error!} />
    }
    return this.props.children
  }
}

export function LiveDemo(): React.ReactElement {
  const [store] = React.useState(() => new QuilStore(demoProject()))
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<'idle' | 'changed' | 'error'>('idle')

  const resolvedBg = (id: ElementId): string => {
    const r = resolver.resolve(store.getState(), id)
    return r.ok ? String(r.result.props.bgColor ?? '') : ''
  }

  const handleChange = (): void => {
    setBusy(true)
    setResult('idle')
    try {
      const baseRev = store.getState().rev
      const applied = store.dispatch({
        type: 'set_property',
        commandId: `cmd-demo-global-${Date.now()}` as never,
        baseRev,
        targetId: B1,
        property: 'bgColor',
        value: NEW_RULE,
        scope: { kind: 'global', targetType: 'button' }
      })
      if (!applied.ok) {
        setResult('error')
        return
      }
      // Only buttons whose only applicable decision is this global one may
      // change. The promo button's instance override (rank 3) outranks global
      // (rank 1), so it must keep its own colour.
      const promoBase = String(store.getState().nodes.get(B3)!.props.bgColor ?? '')
      const promoHeld = resolvedBg(B3) === promoBase
      const othersMoved = APPLICABLE.every((id) => resolvedBg(id) === NEW_RULE)
      setResult(promoHeld && othersMoved ? 'changed' : 'error')
    } catch {
      setResult('error')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = (): void => {
    setBusy(true)
    setResult('idle')
    try {
      const baseRev = store.getState().rev
      store.dispatch({
        type: 'set_property',
        commandId: `cmd-demo-reset-${Date.now()}` as never,
        baseRev,
        targetId: B1,
        property: 'bgColor',
        value: RESET_RULE,
        scope: { kind: 'global', targetType: 'button' }
      })
    } catch {
      // no-op
    } finally {
      setBusy(false)
    }
  }

  return (
    <DemoErrorBoundary>
      <Card padded style={{ width: '100%', maxWidth: 700, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--quil-space-2)',
            marginBottom: 'var(--quil-space-4)'
          }}
        >
          <FeatherPen size={20} />
          <span style={{ fontSize: 'var(--quil-heading-4)', fontFamily: 'var(--quil-font-head)' }}>
            Live decision demo
          </span>
        </div>

        <p
          style={{
            color: 'var(--quil-text-70)',
            fontSize: 'var(--quil-text-sm)',
            marginBottom: 'var(--quil-space-4)'
          }}
        >
          Quil's real renderer and decision engine. Change the global button rule
          — only applicable buttons update. The promo button keeps its instance
          override.
        </p>

        <div
          style={{
            background: 'var(--quil-surface)',
            borderRadius: 'var(--quil-radius-md)',
            padding: 'var(--quil-space-4)',
            marginBottom: 'var(--quil-space-4)',
            minHeight: 120
          }}
        >
          <Canvas store={store} pageId={DEMO_PAGE_ID} />
        </div>

        <div style={{ display: 'flex', gap: 'var(--quil-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={handleChange}
            disabled={busy}
            style={{ position: 'relative' }}
          >
            {busy ? <PenLoader size={20} loading={true} /> : 'Change global button rule'}
          </Button>
          <Button variant="neutral" onClick={handleReset} disabled={busy}>
            Reset
          </Button>
          {result === 'error' && (
            <StatusMessage variant="error" message="Demo failed to apply the rule." style={{ marginLeft: 'var(--quil-space-3)' }} />
          )}
          {result === 'changed' && (
            <StatusMessage variant="success" message="Only applicable buttons changed — the promo override stayed put." style={{ marginLeft: 'var(--quil-space-3)' }} />
          )}
        </div>

        <StatusMessage variant="default" message="No network, no auth, no AI — the decision engine enforces scoped precedence." />
      </Card>
    </DemoErrorBoundary>
  )
}
