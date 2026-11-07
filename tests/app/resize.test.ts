import { describe, expect, it } from 'vitest'
import { baseResizeValue, clampResize, cssPropertyFor, resizeHandles, resizeValueFor } from '../../src/app/resize'

describe('resize: handle table', () => {
  it('maps each kind to the properties its schema actually allows', () => {
    expect(resizeHandles('image').map((h) => `${h.property}:${h.edge}`)).toEqual([
      'width:right',
      'width:left',
      'height:bottom',
      'height:top'
    ])
    expect(resizeHandles('card').map((h) => h.property)).toEqual(['padding', 'padding', 'radius'])
    expect(resizeHandles('heading').map((h) => h.property)).toEqual(['fontSize'])
    expect(resizeHandles('navigation')).toEqual([])
  })

  it('carries each property its own bounds and sign', () => {
    for (const handle of [...resizeHandles('image'), ...resizeHandles('card'), ...resizeHandles('heading')]) {
      expect(handle.min).toBeLessThan(handle.max)
      expect([1, -1]).toContain(handle.sign)
    }
  })
})

describe('resize: clamping', () => {
  it('rounds and clamps to the handle bounds', () => {
    expect(clampResize(1, 10000, 1400.6)).toBe(1401)
    expect(clampResize(1, 10000, -50)).toBe(1)
    expect(clampResize(1, 10000, 999999)).toBe(10000)
  })

  it('rejects NaN and Infinity to the lower bound', () => {
    expect(clampResize(2, 10, Number.NaN)).toBe(2)
    expect(clampResize(2, 10, Number.POSITIVE_INFINITY)).toBe(2)
  })
})

describe('resize: value adapters', () => {
  it('reads the stored base value for each property shape', () => {
    expect(baseResizeValue({ width: 1200 }, 'width')).toBe(1200)
    expect(baseResizeValue({ padding: { value: 32 } }, 'padding')).toBe(32)
    expect(baseResizeValue({ fontSize: { value: 48, unit: 'px' } }, 'fontSize')).toBe(48)
    expect(baseResizeValue({ width: 'wide' }, 'width')).toBeNull()
    expect(baseResizeValue({}, 'height')).toBeNull()
  })

  it('writes back the shape the schema expects', () => {
    expect(resizeValueFor('width', 1400)).toBe(1400)
    expect(resizeValueFor('padding', 24)).toEqual({ value: 24 })
    expect(resizeValueFor('fontSize', 20)).toEqual({ value: 20, unit: 'px' })
  })

  it('writes kebab-case CSS properties for the live preview', () => {
    expect(cssPropertyFor('radius')).toBe('border-radius')
    expect(cssPropertyFor('fontSize')).toBe('font-size')
    expect(cssPropertyFor('width')).toBe('width')
  })
})
