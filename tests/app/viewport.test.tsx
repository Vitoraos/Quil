import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { Editor } from '../../src/app/editor'

afterEach(() => cleanup())

function setup() {
  const store = new QuilStore(referenceProject())
  const utils = render(<Editor store={store} />)
  return { store, ...utils, scroll: utils.getByTestId('canvas-scroll') }
}

function drag(el: Element, fromX: number, toX: number): void {
  el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: fromX, clientY: 0, bubbles: true }))
  el.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: toX, clientY: 0, bubbles: true }))
  el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: toX, clientY: 0, bubbles: true }))
}

describe('viewport keys', () => {
  it('zooms in, out and back to 100% with the modifiers', () => {
    const { getByText } = setup()

    fireEvent.keyDown(window, { key: '=', ctrlKey: true })
    expect(getByText('110%')).toBeTruthy()

    fireEvent.keyDown(window, { key: '-', ctrlKey: true })
    fireEvent.keyDown(window, { key: '-', ctrlKey: true })
    expect(getByText('90%')).toBeTruthy()

    fireEvent.keyDown(window, { key: '0', ctrlKey: true })
    expect(getByText('100%')).toBeTruthy()
  })

  it('toggles hand mode with H', () => {
    const { getByTestId } = setup()
    const scroll = getByTestId('canvas-scroll')
    expect(scroll.getAttribute('data-hand')).toBe('false')

    fireEvent.keyDown(window, { key: 'h' })
    expect(scroll.getAttribute('data-hand')).toBe('true')

    fireEvent.keyDown(window, { key: 'H' })
    expect(scroll.getAttribute('data-hand')).toBe('false')
  })

  it('pans with Space held and does not select', () => {
    const { getByTestId, container, queryByTestId } = setup()
    const scroll = getByTestId('canvas-scroll')

    fireEvent.keyDown(window, { key: ' ' })
    drag(scroll, 200, 100)
    expect(scroll.scrollLeft).toBe(100)

    fireEvent.click(container.querySelector('[data-element-id="el-hero-img"]')!)
    expect(queryByTestId('inspector')).toBeNull()

    fireEvent.keyUp(window, { key: ' ' })
  })

  it('pans in hand mode without Space', () => {
    const { getByTestId } = setup()
    fireEvent.keyDown(window, { key: 'h' })
    drag(getByTestId('canvas-scroll'), 300, 220)
    expect(getByTestId('canvas-scroll').scrollLeft).toBe(80)
  })

  it('clamps panning to the scrollable extent', () => {
    const { getByTestId } = setup()
    const scroll = getByTestId('canvas-scroll')
    Object.defineProperty(scroll, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(scroll, 'scrollWidth', { value: 300, configurable: true })

    fireEvent.keyDown(window, { key: 'h' })
    drag(scroll, 350, 0)
    expect(scroll.scrollLeft).toBe(200)
  })

  it('does not pan when neither is active', () => {
    const { getByTestId } = setup()
    drag(getByTestId('canvas-scroll'), 300, 220)
    expect(getByTestId('canvas-scroll').scrollLeft).toBe(0)
  })
})
