import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { Editor } from '../../src/app/editor'
import { fuzzyMatch } from '../../src/app/command-palette'

afterEach(() => cleanup())

function setup() {
  const store = new QuilStore(referenceProject())
  return { store, ...render(<Editor store={store} />) }
}

describe('command palette', () => {
  it('opens with Ctrl+K and closes with Escape', () => {
    const { getByTestId, queryByTestId } = setup()
    expect(queryByTestId('command-palette')).toBeNull()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(getByTestId('command-palette')).toBeTruthy()

    fireEvent.keyDown(getByTestId('palette-input'), { key: 'Escape' })
    expect(queryByTestId('command-palette')).toBeNull()
  })

  it('filters actions and runs the first match on Enter', () => {
    const { getByTestId, getByText, queryByTestId } = setup()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(getByTestId('palette-input'), { target: { value: 'zoom' } })

    fireEvent.keyDown(getByTestId('palette-input'), { key: 'Enter' })
    expect(getByText('110%')).toBeTruthy()
    expect(queryByTestId('command-palette')).toBeNull()
  })

  it('moves the highlight with the arrow keys before running', () => {
    const { getByTestId, getByText } = setup()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = getByTestId('palette-input')
    fireEvent.change(input, { target: { value: 'zoom' } })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(getByText('90%')).toBeTruthy()
  })

  it('runs a clicked action and closes', () => {
    const { getByTestId, getByText, queryByTestId } = setup()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(getByTestId('palette-action-zoom-reset'))
    expect(getByText('100%')).toBeTruthy()
    expect(queryByTestId('command-palette')).toBeNull()
  })

  it('reports when nothing matches', () => {
    const { getByTestId } = setup()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(getByTestId('palette-input'), { target: { value: 'zzzz' } })
    expect(getByTestId('command-palette').textContent).toContain('No matching command')
  })

  it('matches non-contiguous subsequences', () => {
    expect(fuzzyMatch('Zoom in', 'zn')).toBe(true)
    expect(fuzzyMatch('Zoom in', 'zi')).toBe(true)
    expect(fuzzyMatch('Zoom in', 'xz')).toBe(false)
    expect(fuzzyMatch('Zoom in', '')).toBe(true)

    const { getByTestId, getByText } = setup()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = getByTestId('palette-input')
    fireEvent.change(input, { target: { value: 'zi' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(getByText('110%')).toBeTruthy()
  })
})
