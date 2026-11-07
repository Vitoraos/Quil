import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import { Editor } from '../../src/app/editor'
import { QuilStore } from '../../src/app/store'

afterEach(() => cleanup())

function setup() {
  const store = new QuilStore(referenceProject())
  const utils = render(<Editor store={store} />)
  const elements = Array.from(utils.container.querySelectorAll('[data-element-id]')) as HTMLElement[]
  return { ...utils, store, elements }
}

describe('selection', () => {
  it('selects an element on click and shows the outline', () => {
    const { elements, getByTestId } = setup()
    expect(elements.length).toBeGreaterThan(0)
    fireEvent.click(elements[0]!)
    const outline = getByTestId('selection-outline')
    expect(outline.getAttribute('data-selected-id')).toBe(elements[0]!.getAttribute('data-element-id'))
    expect(outline.style.display).toBe('block')
  })

  it('clears the selection on Escape', () => {
    const { elements, getByTestId } = setup()
    fireEvent.click(elements[0]!)
    fireEvent.keyDown(window, { key: 'Escape' })
    const outline = getByTestId('selection-outline')
    expect(outline.getAttribute('data-selected-id')).toBe('')
    expect(outline.style.display).toBe('none')
  })

  it('cycles selection with Tab inside the canvas only', () => {
    const { elements, getByTestId } = setup()
    const canvas = getByTestId('canvas-root')
    fireEvent.keyDown(canvas, { key: 'Tab' })
    const outline = getByTestId('selection-outline')
    expect(outline.getAttribute('data-selected-id')).toBe(elements[0]!.getAttribute('data-element-id'))
    fireEvent.keyDown(canvas, { key: 'Tab' })
    expect(outline.getAttribute('data-selected-id')).toBe(elements[1]!.getAttribute('data-element-id'))
    fireEvent.keyDown(canvas, { key: 'Tab', shiftKey: true })
    expect(outline.getAttribute('data-selected-id')).toBe(elements[0]!.getAttribute('data-element-id'))
  })

  it('draws the hover outline without selecting', () => {
    const { elements, getByTestId } = setup()
    fireEvent.pointerMove(elements[0]!, { bubbles: true })
    expect(getByTestId('hover-outline').style.display).toBe('block')
    expect(getByTestId('selection-outline').style.display).toBe('none')
  })
})