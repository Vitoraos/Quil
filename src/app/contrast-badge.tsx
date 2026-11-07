// culori ships no types in this environment; cast to any for strict TS.
import { wcagContrast as contrast } from 'culori'

export function contrastRatio(foreground: string, background: string): number {
  try {
    const c = contrast(foreground, background)
    return typeof c === 'number' ? c : 1
  } catch {
    return 1
  }
}

export function contrastPasses(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = contrastRatio(foreground, background)
  const threshold = level === 'AAA' ? 7 : 4.5
  return ratio >= threshold
}

export function ContrastBadge({
  foreground,
  background,
  level = 'AA'
}: {
  foreground: string
  background: string
  level?: 'AA' | 'AAA'
}): React.ReactElement {
  const ratio = contrastRatio(foreground, background)
  const pass = contrastPasses(foreground, background, level)
  return (
    <div
      data-testid="contrast-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--quil-space-1)',
        padding: 'var(--quil-space-1) var(--quil-space-2)',
        borderRadius: 'var(--quil-radius-sm)',
        fontSize: 'var(--quil-text-xs)',
        background: pass ? 'var(--quil-success-bg)' : 'var(--quil-danger-bg)',
        color: pass ? 'var(--quil-success-text)' : 'var(--quil-danger-text)',
        border: `var(--quil-border-width) solid ${pass ? 'var(--quil-success-line)' : 'var(--quil-danger-line)'}`
      }}
    >
      <span>Contrast {ratio.toFixed(2)}:1</span>
      <span data-testid="contrast-status">{pass ? `Pass ${level}` : `Fail ${level}`}</span>
    </div>
  )
}
