// src/pages/Landing.tsx
// Landing page: 8-section story, responsive 360px–4K.
// Tokens only. No stock imagery, no speed multiplier claims, no competitor names.
// Pen experience: FeatherPen as hero logo mark; PenLoader behind live demo.

import * as React from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Chip, FeatherPen, PenLoader } from '../ui'
import { LiveDemo } from '../components/landing/LiveDemo'
import { StrategyCanvas } from '../components/landing/StrategyCanvas'

export default function Landing(): React.ReactElement {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--quil-bg)',
        color: 'var(--quil-text-100)',
        fontFamily: 'var(--quil-font-ui)',
        lineHeight: 1.5
      }}
    >
      {/* Section 1: Hero */}
      <section
        style={{
          padding: 'var(--quil-space-16) var(--quil-space-8)',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--quil-space-2)',
            marginBottom: 'var(--quil-space-6)'
          }}
        >
          <FeatherPen size={40} />
          <span
            style={{
              fontSize: 'var(--quil-heading-2)',
              fontFamily: 'var(--quil-font-head)',
              fontWeight: 700
            }}
          >
            Quil
          </span>
        </div>
        <h1
          style={{
            fontSize: 'var(--quil-heading-1)',
            fontFamily: 'var(--quil-font-head)',
            margin: '0 0 var(--quil-space-6)',
            lineHeight: 1.05,
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          Decide once. Quil remembers.
        </h1>
        <p
          style={{
            fontSize: 'var(--quil-text-lg)',
            color: 'var(--quil-text-75)',
            maxWidth: 640,
            margin: '0 auto var(--quil-space-10)'
          }}
        >
          Every approved design decision is remembered, scoped, and enforced.
          Unlike generators that rewrite your work, and canvases that make you
          repeat it.
        </p>
        <div style={{ display: 'flex', gap: 'var(--quil-space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/new">
            <Button variant="primary">Start designing</Button>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-2)' }}>
            <PenLoader size={20} loading={false} />
            <span style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)' }}>
              Live decision demo below
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: The problem */}
      <section
        style={{
          padding: 'var(--quil-space-16) var(--quil-space-8)',
          background: 'var(--quil-surface)'
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'var(--quil-heading-2)',
              fontFamily: 'var(--quil-font-head)',
              margin: '0 0 var(--quil-space-10)',
              textAlign: 'center'
            }}
          >
            Every AI design tool forgets what you decided
          </h2>
          <div style={{ display: 'grid', gap: 'var(--quil-space-8)' }}>
            <div>
              <h3
                style={{
                  fontSize: 'var(--quil-heading-4)',
                  fontFamily: 'var(--quil-font-head)',
                  margin: '0 0 var(--quil-space-3)'
                }}
              >
                The generator rewrote my buttons
              </h3>
              <p
                style={{
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-sm)',
                  margin: 0
                }}
              >
                One prompt undoes a contrast fix you approved three passes ago.
              </p>
            </div>
            <div>
              <h3
                style={{
                  fontSize: 'var(--quil-heading-4)',
                  fontFamily: 'var(--quil-font-head)',
                  margin: '0 0 var(--quil-space-3)'
                }}
              >
                The canvas made me repeat myself
              </h3>
              <p
                style={{
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-sm)',
                  margin: 0
                }}
              >
                Changing a button rule means hunting every page by hand.
              </p>
            </div>
            <div>
              <h3
                style={{
                  fontSize: 'var(--quil-heading-4)',
                  fontFamily: 'var(--quil-font-head)',
                  margin: '0 0 var(--quil-space-3)'
                }}
              >
                A change on page two broke page one
              </h3>
              <p
                style={{
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-sm)',
                  margin: 0
                }}
              >
                Global edits have no scope — they touch everything or nothing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: The shift */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'var(--quil-heading-2)',
              fontFamily: 'var(--quil-font-head)',
              margin: '0 0 var(--quil-space-10)',
              textAlign: 'center'
            }}
          >
            Describe, decide, keep
          </h2>
          <div style={{ display: 'grid', gap: 'var(--quil-space-8)' }}>
            <div style={{ textAlign: 'center' }}>
              <h3
                style={{
                  fontSize: 'var(--quil-heading-3)',
                  fontWeight: 600,
                  fontFamily: 'var(--quil-font-head)',
                  margin: '0 0 var(--quil-space-3)'
                }}
              >
                Describe
              </h3>
              <p
                style={{
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-sm)',
                  margin: 0
                }}
              >
                Tell Quil what you are building in plain words.
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3
                style={{
                  fontSize: 'var(--quil-heading-3)',
                  fontWeight: 600,
                  fontFamily: 'var(--quil-font-head)',
                  margin: '0 0 var(--quil-space-3)'
                }}
              >
                Decide
              </h3>
              <p
                style={{
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-sm)',
                  margin: 0
                }}
              >
                Approve variant cards one decision at a time, with scope.
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3
                style={{
                  fontSize: 'var(--quil-heading-3)',
                  fontWeight: 600,
                  fontFamily: 'var(--quil-font-head)',
                  margin: '0 0 var(--quil-space-3)'
                }}
              >
                Keep
              </h3>
              <p
                style={{
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-sm)',
                  margin: 0
                }}
              >
                Approved decisions stay true across every page.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: The proof (live demo) */}
      <section
        style={{
          padding: 'var(--quil-space-16) var(--quil-space-8)',
          background: 'var(--quil-surface)'
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'var(--quil-heading-2)',
              fontFamily: 'var(--quil-font-head)',
              margin: '0 0 var(--quil-space-6)',
              textAlign: 'center'
            }}
          >
            Change one global rule — only applicable buttons update
          </h2>
          <LiveDemo />
        </div>
      </section>

      {/* Section 5: You stay in control */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'var(--quil-heading-2)',
              fontFamily: 'var(--quil-font-head)',
              margin: '0 0 var(--quil-space-6)',
              textAlign: 'center'
            }}
          >
            Nothing changes without approval
          </h2>
          <p
            style={{
              color: 'var(--quil-text-70)',
              fontSize: 'var(--quil-text-lg)',
              margin: '0 0 var(--quil-space-8)',
              textAlign: 'center'
            }}
          >
            You choose the scope: this instance, this page, or everywhere. Drift
            and contrast badges flag deviations before they become decisions.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--quil-space-2)',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}
          >
            <Chip variant="accent">Instance override</Chip>
            <Chip variant="accent">Page-scoped</Chip>
            <Chip variant="accent">Global rule</Chip>
          </div>
        </div>
      </section>

      {/* Section 6: A different category */}
      <StrategyCanvas />

      {/* Section 7: Who it is for */}
      <section style={{ padding: 'var(--quil-space-16) var(--quil-space-8)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'var(--quil-heading-2)',
              fontFamily: 'var(--quil-font-head)',
              margin: '0 0 var(--quil-space-10)',
              textAlign: 'center'
            }}
          >
            Built for solo builders, teams next
          </h2>
          <div style={{ display: 'grid', gap: 'var(--quil-space-6)' }}>
            <Card padded style={{ border: '1px solid var(--quil-line)' }}>
              <h3
                style={{
                  fontSize: 'var(--quil-heading-4)',
                  fontFamily: 'var(--quil-font-head)',
                  margin: '0 0 var(--quil-space-2)'
                }}
              >
                Soon-to-be
              </h3>
              <p
                style={{
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-sm)',
                  margin: 0
                }}
              >
                People who use generators today and keep fixing the same things
                on every pass.
              </p>
            </Card>
            <Card padded style={{ border: '1px solid var(--quil-line)' }}>
              <h3
                style={{
                  fontSize: 'var(--quil-heading-4)',
                  fontFamily: 'var(--quil-font-head)',
                  margin: '0 0 var(--quil-space-2)'
                }}
              >
                Refusing
              </h3>
              <p
                style={{
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-sm)',
                  margin: 0
                }}
              >
                Developers who avoid design tools because of the learning curve
                and repetition.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Section 8: Close */}
      <section
        style={{
          padding: 'var(--quil-space-24) var(--quil-space-8)',
          textAlign: 'center'
        }}
      >
        <h2
          style={{
            fontSize: 'var(--quil-heading-2)',
            fontFamily: 'var(--quil-font-head)',
            margin: '0 0 var(--quil-space-4)'
          }}
        >
          Start designing
        </h2>
        <p style={{ color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-6)' }}>
          Sign in with Google or Apple.
        </p>
        <Link to="/new">
          <Button variant="primary">Start designing</Button>
        </Link>
      </section>
    </div>
  )
}
