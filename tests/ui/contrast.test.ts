// @ts-nocheck
// tests/ui/contrast.test.ts
// CI contrast test (culori): every text intensity level against bg and surface
// at 4.5:1 or better; button label against the button fill at 4.5:1; accent
// against bg for non-text parts at least 3:1.
//
// Colours are parsed from src/ui/tokens.css so this test can never drift from
// the shipped theme the way hardcoded values would.

import { describe, expect, it } from 'vitest'
import { wcagContrast } from 'culori'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = readFileSync(resolve(__dirname, '../../src/ui/tokens.css'), 'utf8')

function token(name: string): string {
  const m = TOKENS_CSS.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  if (!m) throw new Error(`token ${name} not declared in tokens.css`)
  return m[1]!.trim()
}

const BG = token('--quil-bg')
const SURFACE = token('--quil-surface')
const ACCENT = token('--quil-accent')
const BUTTON = token('--quil-button')
const BUTTON_TEXT = token('--quil-button-text')

const levels = Object.fromEntries(
  ['100', '95', '90', '85', '80', '75', '70'].map((n) => [`text-${n}`, token(`--quil-text-${n}`)])
)

const ratio = (a: string, b: string): number => Number(wcagContrast(a, b))

describe('contrast', () => {
  it('every text intensity level passes 4.5:1 against bg', () => {
    for (const [name, color] of Object.entries(levels)) {
      expect(ratio(color, BG)).toBeGreaterThanOrEqual(4.5, `${name} against bg: ${ratio(color, BG).toFixed(2)}:1`)
    }
  })

  it('every text intensity level passes 4.5:1 against surface', () => {
    for (const [name, color] of Object.entries(levels)) {
      expect(ratio(color, SURFACE)).toBeGreaterThanOrEqual(
        4.5,
        `${name} against surface: ${ratio(color, SURFACE).toFixed(2)}:1`
      )
    }
  })

  it('button label against the button fill passes 4.5:1', () => {
    expect(ratio(BUTTON_TEXT, BUTTON)).toBeGreaterThanOrEqual(
      4.5,
      `button label vs button: ${ratio(BUTTON_TEXT, BUTTON).toFixed(2)}:1`
    )
  })

  it('accent against bg passes 3:1 for non-text parts', () => {
    expect(ratio(ACCENT, BG)).toBeGreaterThanOrEqual(3, `accent vs bg: ${ratio(ACCENT, BG).toFixed(2)}:1`)
  })
})
