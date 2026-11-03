// @ts-nocheck
// tests/ui/contrast.test.ts
// CI contrast test (culori): every text intensity level against bg and surface
// at 4.5:1 or better; button label against each fill at 4.5:1; accent against
// bg for non-text parts at least 3:1.

import { describe, expect, it } from 'vitest'
import { wcagContrast } from 'culori'

// culori ships no types; wcagContrast takes (color1, color2) at runtime.
const BG = '#0A0A0C'
const SURFACE = '#141418'
const ACCENT = '#8B5CF6'

const levels = {
  'text-100': '#F5F3EC',
  'text-95': '#E7E4DC',
  'text-90': '#CFCBC1',
  'text-85': '#B3AEA4',
  'text-80': '#9A9489',
  'text-75': '#8A847A',
  'text-70': '#868076',
}

describe('contrast', () => {
  it('every text intensity level passes 4.5:1 against bg', () => {
    for (const [name, color] of Object.entries(levels)) {
      const ratio = Number((wcagContrast as any)(color, BG))
      expect(ratio).toBeGreaterThanOrEqual(4.5, `${name} against bg: ${ratio.toFixed(2)}:1`)
    }
  })

  it('every text intensity level passes 4.5:1 against surface', () => {
    for (const [name, color] of Object.entries(levels)) {
      const ratio = Number((wcagContrast as any)(color, SURFACE))
      expect(ratio).toBeGreaterThanOrEqual(4.5, `${name} against surface: ${ratio.toFixed(2)}:1`)
    }
  })

  it('button label (bg colour) against accent fill passes 4.5:1', () => {
    const ratio = Number((wcagContrast as any)(BG, ACCENT))
    expect(ratio).toBeGreaterThanOrEqual(4.5, `button label vs accent: ${ratio.toFixed(2)}:1`)
  })

  it('accent against bg passes 3:1 for non-text parts', () => {
    const ratio = Number((wcagContrast as any)(ACCENT, BG))
    expect(ratio).toBeGreaterThanOrEqual(3, `accent vs bg: ${ratio.toFixed(2)}:1`)
  })

  it('reports the final accent contrast value', () => {
    const ratio = Number((wcagContrast as any)(ACCENT, BG))
    expect(ratio).toBeGreaterThanOrEqual(3)
    console.log(`Final accent (#${ACCENT}) vs bg (#${BG}): ${ratio.toFixed(2)}:1`)
  })
})
