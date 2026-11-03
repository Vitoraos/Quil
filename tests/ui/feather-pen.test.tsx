// tests/ui/feather-pen.test.tsx
import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FeatherPen, PenLoader } from '../../src/ui'

afterEach(() => cleanup())

describe('FeatherPen', () => {
  it('renders with aria-hidden and default size', () => {
    render(<FeatherPen />)
    const svg = screen.getByTestId('feather-pen')
    expect(svg).toBeDefined()
    expect(svg.getAttribute('aria-hidden')).toBe('true')
  })

  it('accepts a custom size', () => {
    render(<FeatherPen size={48} />)
    const svg = screen.getByTestId('feather-pen')
    expect(svg.getAttribute('width')).toBe('48')
    expect(svg.getAttribute('height')).toBe('48')
  })
})

describe('PenLoader', () => {
  it('renders static feather when not loading', () => {
    render(<PenLoader loading={false} />)
    const svg = screen.getByTestId('feather-pen')
    expect(svg).toBeDefined()
  })

  it('shows busy state when loading', () => {
    render(<PenLoader loading={true} size={24} />)
    const svg = screen.getByTestId('pen-loader')
    expect(svg.getAttribute('aria-busy')).toBe('true')
  })
})
