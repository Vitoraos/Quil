// src/components/landing/StrategyCanvas.tsx
// Strategy canvas drawn from data, without competitor names.
// Scores 1 (low) to 5 (high): Quil vs the common category on the factors that
// decide whether a design decision lasts.

import * as React from 'react'

interface Factor {
  key: string
  label: string
  quil: number
  category: number
}

const FACTORS: Factor[] = [
  { key: 'persistence', label: 'Approved decisions stay true', quil: 5, category: 2 },
  { key: 'scope', label: 'Change applies only where intended', quil: 5, category: 2 },
  { key: 'consistency', label: 'Consistent across every page', quil: 5, category: 2 },
  { key: 'control', label: 'You approve every change', quil: 5, category: 3 },
  { key: 'detail', label: 'Attention to detail enforced', quil: 4, category: 2 }
]

const MAX = 5

export function StrategyCanvas(): React.ReactElement {
  return (
    <section
      style={{
        padding: 'var(--quil-space-16) var(--quil-space-8)',
        background: 'var(--quil-surface)'
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--quil-space-2)',
            marginBottom: 'var(--quil-space-8)'
          }}
        >
          <span style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', textTransform: 'uppercase' }}>
            Not another generator, not another canvas
          </span>
          <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)', margin: 0 }}>
            A different category
          </h2>
        </div>
        <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-10)', maxWidth: 600 }}>
          Quil gives up speed and breadth on purpose, and climbs the three factors
          that decide whether a decision lasts: persistence, scope and consistency.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-5)' }}>
          {FACTORS.map((factor) => (
            <div key={factor.key} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-100)', fontFamily: 'var(--quil-font-ui)' }}>
                  {factor.label}
                </span>
                <span style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', fontFamily: 'var(--quil-font-ui)' }}>
                  Quil {factor.quil} / {MAX} &nbsp;·&nbsp; category {factor.category} / {MAX}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--quil-space-3)', height: 'var(--quil-space-3)', alignItems: 'center' }}>
                <div
                  style={{
                    flex: 1,
                    height: '100%',
                    background: 'color-mix(in oklab, var(--quil-text-100) 10%, var(--quil-bg))',
                    borderRadius: 'var(--quil-radius-sm)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${(factor.quil / MAX) * 100}%`,
                      background: 'var(--quil-accent)',
                      borderRadius: 'var(--quil-radius-sm)',
                      transition: 'width var(--quil-duration-fast) ease-out'
                    }}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    height: '100%',
                    background: 'color-mix(in oklab, var(--quil-text-100) 10%, var(--quil-bg))',
                    borderRadius: 'var(--quil-radius-sm)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${(factor.category / MAX) * 100}%`,
                      background: 'var(--quil-text-80)',
                      borderRadius: 'var(--quil-radius-sm)',
                      transition: 'width var(--quil-duration-fast) ease-out'
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', fontFamily: 'var(--quil-font-ui)' }}>
                <span style={{ color: 'var(--quil-text-100)', fontWeight: 600 }}>Quil</span>
                <span>Common category</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
