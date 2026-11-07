import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { QuickTools } from '../../src/app/workspace/QuickTools'

afterEach(() => cleanup())

function renderQuickTools() {
  const store = new QuilStore(emptyProject())
  const utils = render(<QuickTools store={store} />)
  return { ...utils, store }
}

describe('QuickTools', () => {
  it('renders 5 tool buttons', () => {
    const { getByTestId } = renderQuickTools()
    expect(getByTestId('quick-tool-select')).toBeTruthy()
    expect(getByTestId('quick-tool-frame')).toBeTruthy()
    expect(getByTestId('quick-tool-text')).toBeTruthy()
    expect(getByTestId('quick-tool-insert')).toBeTruthy()
    expect(getByTestId('quick-tool-hand')).toBeTruthy()
  })

  it('sets Select active by default', () => {
    const { getByTestId } = renderQuickTools()
    const select = getByTestId('quick-tool-select')
    expect(select.getAttribute('aria-pressed')).toBe('true')
  })

  it('toggles active tool on click', () => {
    const { getByTestId } = renderQuickTools()
    const frame = getByTestId('quick-tool-frame')
    expect(frame.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(frame)
    expect(frame.getAttribute('aria-pressed')).toBe('true')
    const select = getByTestId('quick-tool-select')
    expect(select.getAttribute('aria-pressed')).toBe('false')
  })

  it('shows shortcut hints', () => {
    const { getByTestId } = renderQuickTools()
    expect(getByTestId('quick-tool-select').getAttribute('title')).toBe('Select (V)')
    expect(getByTestId('quick-tool-insert').getAttribute('title')).toBe('Insert (/)')
    expect(getByTestId('quick-tool-hand').getAttribute('title')).toBe('Hand (H)')
  })
})
