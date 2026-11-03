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
        gap: 6,
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 12,
        background: pass ? '#dcfce7' : '#fee2e2',
        color: pass ? '#166534' : '#991b1b',
        border: `1px solid ${pass ? '#86efac' : '#fecaca'}`
      }}
    >
      <span>Contrast {ratio.toFixed(2)}:1</span>
      <span data-testid="contrast-status">{pass ? `Pass ${level}` : `Fail ${level}`}</span>
    </div>
  )
}
