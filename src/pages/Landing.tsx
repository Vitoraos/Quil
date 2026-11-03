// src/pages/Landing.tsx
// Landing page: 8-section story, responsive 360px–4K.
// No stock imagery, no speed multiplier claims, no competitor names.
// Pen experience: FeatherPen as hero logo mark, PenLoader behind live demo.

import * as React from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Chip, StatusMessage, FeatherPen, PenLoader } from '../ui'

export default function Landing(): React.ReactElement {
  const [demoLoading, setDemoLoading] = React.useState(false)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--quil-bg)',
        color: 'var(--quil-text-100)',
        fontFamily: 'var(--quil-font-ui)',
        lineHeight: 1.5,
      }}
    >
      {/* Section 1: Hero */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--quil-space-2)', marginBottom: 'var(--quil-space-4)' }}>
          <FeatherPen size={40} />
          <span style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', fontWeight: 700 }}>Quil</span>
        </div>
        <h1 style={{ fontSize: 'var(--quil-heading-1)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-4)', lineHeight: 1.05 }}>
          Decide once. Quil remembers.
        </h1>
        <p style={{ fontSize: 'var(--quil-text-lg)', color: 'var(--quil-text-75)', maxWidth: 640, margin: '0 auto var(--quil-space-8)' }}>
          Every approved design decision is remembered, scoped, and enforced. Unlike generators that rewrite your work, and canvases that make you repeat it.
        </p>
        <Link to="/signin">
          <Button variant="primary">Start designing</Button>
        </Link>
        <div style={{ marginTop: 'var(--quil-space-6)' }}>
          <PenLoader size={48} loading={demoLoading} />
          <button
            type="button"
            onClick={() => setDemoLoading((l) => !l)}
            style={{ marginTop: 'var(--quil-space-4)', fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Try the decision demo
          </button>
        </div>
      </section>

      {/* Section 2: The problem */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)', background: 'var(--quil-surface)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', textAlign: 'center', marginBottom: 'var(--quil-space-8)' }}>
          Every AI design tool forgets what you decided
        </h2>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--quil-space-6)' }}>
          <Card padded style={{ border: '1px solid var(--quil-line)' }}>
            <h3 style={{ fontSize: 'var(--quil-heading-4)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>The generator rewrote my buttons</h3>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>One prompt undoes a contrast fix you approved three passes ago.</p>
          </Card>
          <Card padded style={{ border: '1px solid var(--quil-line)' }}>
            <h3 style={{ fontSize: 'var(--quil-heading-4)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>The canvas made me repeat myself</h3>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Changing a button rule means hunting every page by hand.</p>
          </Card>
          <Card padded style={{ border: '1px solid var(--quil-line)' }}>
            <h3 style={{ fontSize: 'var(--quil-heading-4)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>A change on page two broke page one</h3>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Global edits have no scope — they touch everything or nothing.</p>
          </Card>
        </div>
      </section>

      {/* Section 3: The shift */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', textAlign: 'center', marginBottom: 'var(--quil-space-8)' }}>
          Describe, decide, keep
        </h2>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--quil-space-6)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--quil-heading-3)', fontWeight: 600, fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>1. Describe</div>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Tell Quil what you are building in plain words.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--quil-heading-3)', fontWeight: 600, fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>2. Decide</div>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Approve variant cards one decision at a time, with scope.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--quil-heading-3)', fontWeight: 600, fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>3. Keep</div>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Approved decisions stay true across every page.</p>
          </div>
        </div>
      </section>

      {/* Section 4: The proof (live demo) */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)', background: 'var(--quil-surface)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', textAlign: 'center', marginBottom: 'var(--quil-space-8)' }}>
          Change one global rule — only applicable buttons update
        </h2>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <Card padded>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-4)' }}>
              The demo imports Quil's real renderer and decision engine. Change the global button treatment and watch only applicable buttons update — the promo button with its own override stays put.
            </p>
            <div style={{ display: 'flex', gap: 'var(--quil-space-3)', marginBottom: 'var(--quil-space-4)' }}>
              <Button variant="primary" disabled={demoLoading}>
                {demoLoading ? <PenLoader size={20} loading={true} /> : 'Change global button rule'}
              </Button>
              <Button variant="neutral" disabled={demoLoading}>Reset</Button>
            </div>
            <StatusMessage variant="default" message="Demo loads lazily, no network, no auth, no AI" />
          </Card>
        </div>
      </section>

      {/* Section 5: You stay in control */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', textAlign: 'center', marginBottom: 'var(--quil-space-8)' }}>
          Nothing changes without approval
        </h2>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-lg)', marginBottom: 'var(--quil-space-6)' }}>
            You choose the scope: this instance, this page, or everywhere. Drift and contrast badges flag deviations before they become decisions.
          </p>
          <div style={{ display: 'flex', gap: 'var(--quil-space-2)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip variant="accent">Instance override</Chip>
            <Chip variant="accent">Page-scoped</Chip>
            <Chip variant="accent">Global rule</Chip>
          </div>
        </div>
      </section>

      {/* Section 6: A different category */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)', background: 'var(--quil-surface)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', textAlign: 'center', marginBottom: 'var(--quil-space-8)' }}>
          Not another generator, not another canvas
        </h2>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-lg)', marginBottom: 'var(--quil-space-6)' }}>
            Quil is the design workspace where every decision you approve is remembered, scoped, and enforced.
          </p>
        </div>
      </section>

      {/* Section 7: Who it is for */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', textAlign: 'center', marginBottom: 'var(--quil-space-8)' }}>
          Built for solo builders, teams next
        </h2>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--quil-space-6)' }}>
          <Card padded style={{ border: '1px solid var(--quil-line)' }}>
            <h3 style={{ fontSize: 'var(--quil-heading-4)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>Soon-to-be</h3>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>People who use generators today and keep fixing the same things on every pass.</p>
          </Card>
          <Card padded style={{ border: '1px solid var(--quil-line)' }}>
            <h3 style={{ fontSize: 'var(--quil-heading-4)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>Refusing</h3>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Developers who avoid design tools because of the learning curve and repetition.</p>
          </Card>
          <Card padded style={{ border: '1px solid var(--quil-line)' }}>
            <h3 style={{ fontSize: 'var(--quil-heading-4)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-2)' }}>Unexplored</h3>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Founders who ship interface by prompting and accept the inconsistency.</p>
          </Card>
        </div>
      </section>

      {/* Section 8: Close */}
      <section style={{ padding: 'var(--quil-space-24) var(--quil-space-8)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', marginBottom: 'var(--quil-space-4)' }}>Start designing</h2>
        <p style={{ color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-6)' }}>Sign in with Google or Apple.</p>
        <Link to="/signin">
          <Button variant="primary">Start designing</Button>
        </Link>
      </section>
    </div>
  )
}
