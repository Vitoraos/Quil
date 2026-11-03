import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { referenceProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { Canvas } from '../../src/app/renderer'

function pointerDown(el: Element, pointerId: number, clientX: number, clientY: number, pointerType: 'mouse' | 'touch' = 'mouse') {
  el.dispatchEvent(new PointerEvent('pointerdown', { pointerId, pointerType, clientX, clientY, bubbles: true }))
}
function pointerCancel(el: Element, pointerId: number) {
  el.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }))
}
function pointerMove(el: Element, pointerId: number, clientX: number, clientY: number) {
  el.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX, clientY, bubbles: true }))
}
function pointerUp(el: Element, pointerId: number, clientX: number, clientY: number) {
  el.dispatchEvent(new PointerEvent('pointerup', { pointerId, clientX, clientY, bubbles: true }))
}
function blurEl(el: Element) {
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
}

describe('gestures: cancel, blur, pointercancel, Escape abort', () => {
  it('Escape cancels a drag with no state change', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const el = container.querySelector('[data-element-id="el-hero-heading"]')!
    pointerDown(el, 1, 100, 0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(store.getState().rev).toBe(0)
    expect(store.getState().nodes.get('el-hero-heading' as never)?.props['color']).toBe('#1C1C1A')
  })

  it('pointercancel aborts cleanly with no committed change', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const el = container.querySelector('[data-element-id="el-hero-heading"]')!
    pointerDown(el, 2, 100, 0)
    pointerCancel(el, 2)

    expect(store.getState().rev).toBe(0)
  })

  it('blur mid-gesture aborts cleanly', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const el = container.querySelector('[data-element-id="el-hero-heading"]')!
    pointerDown(el, 3, 100, 0)
    blurEl(el)

    expect(store.getState().rev).toBe(0)
  })

  it('two pointers at once (touch + mouse): primary wins, secondary ignored', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const el = container.querySelector('[data-element-id="el-hero-heading"]')!
    pointerDown(el, 10, 100, 0, 'mouse')
    pointerDown(el, 11, 100, 0, 'touch')

    expect(store.getState().rev).toBe(0)
  })
})

describe('gestures: drag commits exactly one coalesced command', () => {
  it('moves during a drag without committing, then commits one set_property on release', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const el = container.querySelector('[data-element-id="el-hero-img"]')! // image: width scrubbable
    pointerDown(el, 1, 100, 0)
    pointerMove(el, 1, 300, 0) // mid-gesture: nothing committed yet
    pointerUp(el, 1, 400, 0)

    expect(store.getState().rev).toBe(1)
    const img = store.getState().nodes.get('el-hero-img' as never)
    expect(img?.props['width']).toBeGreaterThanOrEqual(1200)
    // Coalesced into one undo entry
    expect(store.getState().undoStack.length).toBe(1)
  })

  it('drag on an unscrubbable element commits nothing', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const heading = container.querySelector('[data-element-id="el-hero-heading"]')!
    pointerDown(heading, 1, 100, 0)
    pointerMove(heading, 1, 500, 0)
    pointerUp(heading, 1, 500, 0)

    expect(store.getState().rev).toBe(0)
  })

  it('Escape mid-drag aborts with no committed change', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const el = container.querySelector('[data-element-id="el-hero-img"]')!
    pointerDown(el, 1, 100, 0)
    pointerMove(el, 1, 300, 0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(store.getState().rev).toBe(0)
    expect(store.getState().undoStack.length).toBe(0)
  })

  it('two pointers: secondary touch ignored, primary commits', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const el = container.querySelector('[data-element-id="el-hero-img"]')!
    pointerDown(el, 20, 100, 0, 'mouse')
    pointerDown(el, 21, 100, 0, 'touch')
    pointerUp(el, 21, 100, 0) // secondary release ignored
    pointerMove(el, 21, 500, 0) // secondary move ignored
    pointerMove(el, 20, 300, 0) // primary moves
    pointerUp(el, 20, 400, 0) // primary release commits

    expect(store.getState().rev).toBe(1)
  })

  it('pointermove after release is ignored', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const el = container.querySelector('[data-element-id="el-hero-img"]')!
    pointerDown(el, 1, 100, 0)
    pointerUp(el, 1, 100, 0) // release with no delta: nothing to commit
    pointerMove(el, 1, 900, 0) // after release: ignored

    expect(store.getState().rev).toBe(0)
    const img = store.getState().nodes.get('el-hero-img' as never)
    expect(img?.props['width']).toBe(1200)
  })
})
