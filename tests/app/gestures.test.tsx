import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { Canvas } from '../../src/app/renderer'

afterEach(() => cleanup())

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

function setup(selectedId: string) {
  const store = new QuilStore(referenceProject())
  const utils = render(<Canvas store={store} selectedId={selectedId as never} />)
  const handle = utils.getByTestId('resize-handle-width-right')
  const image = utils.container.querySelector('[data-element-id="el-hero-img"]') as HTMLElement
  return { ...utils, store, handle, image }
}

describe('resize handles: live preview, one commit on release', () => {
  it('drags the width handle and commits exactly one set_property', () => {
    const { store, handle } = setup('el-hero-img')
    pointerDown(handle, 1, 100, 0)
    pointerMove(handle, 1, 300, 0)
    expect(store.getState().rev).toBe(0) // mid-drag: document untouched
    pointerUp(handle, 1, 300, 0)

    expect(store.getState().rev).toBe(1)
    expect(store.getState().nodes.get('el-hero-img' as never)?.props['width']).toBe(1400)
    expect(store.getState().undoStack.length).toBe(1)
  })

  it('previews in the inline style during the drag', async () => {
    const { store, handle, image } = setup('el-hero-img')
    pointerDown(handle, 1, 100, 0)
    pointerMove(handle, 1, 300, 0)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    expect(image.style.width).toBe('1400px')
    expect(store.getState().rev).toBe(0)
  })

  it('a left handle shrinks the value', () => {
    const { store, getByTestId } = setup('el-hero-img')
    const left = getByTestId('resize-handle-width-left')
    pointerDown(left, 1, 100, 0)
    pointerUp(left, 1, 200, 0)
    expect(store.getState().nodes.get('el-hero-img' as never)?.props['width']).toBe(1100)
  })

  it('clamps at the schema minimum instead of producing an invalid value', () => {
    const { store, getByTestId } = setup('el-hero-img')
    const left = getByTestId('resize-handle-width-left')
    pointerDown(left, 1, 0, 0)
    pointerUp(left, 1, 5000, 0)
    expect(store.getState().nodes.get('el-hero-img' as never)?.props['width']).toBe(1)
  })
})

describe('resize handles: aborts', () => {
  it('Escape mid-drag restores the inline style and commits nothing', () => {
    const { store, handle, image } = setup('el-hero-img')
    pointerDown(handle, 1, 100, 0)
    pointerMove(handle, 1, 300, 0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(store.getState().rev).toBe(0)
    expect(store.getState().undoStack.length).toBe(0)
    expect(image.style.width).toBe('1200px')
  })

  it('pointercancel aborts cleanly', () => {
    const { store, handle } = setup('el-hero-img')
    pointerDown(handle, 2, 100, 0)
    pointerMove(handle, 2, 400, 0)
    pointerCancel(handle, 2)
    pointerUp(handle, 2, 400, 0) // release after cancel is ignored
    expect(store.getState().rev).toBe(0)
  })

  it('window blur aborts cleanly', () => {
    const { store, handle } = setup('el-hero-img')
    pointerDown(handle, 3, 100, 0)
    pointerMove(handle, 3, 400, 0)
    window.dispatchEvent(new Event('blur'))
    expect(store.getState().rev).toBe(0)
  })

  it('lost pointer capture aborts cleanly', () => {
    const { store, handle } = setup('el-hero-img')
    pointerDown(handle, 4, 100, 0)
    pointerMove(handle, 4, 400, 0)
    window.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 4 }))
    expect(store.getState().rev).toBe(0)
  })

  it('two pointers: the primary drags, the secondary is ignored', () => {
    const { store, handle } = setup('el-hero-img')
    pointerDown(handle, 20, 100, 0, 'mouse')
    pointerDown(handle, 21, 100, 0, 'touch')
    pointerMove(handle, 21, 900, 0) // ignored
    pointerUp(handle, 21, 900, 0) // ignored
    pointerMove(handle, 20, 300, 0)
    pointerUp(handle, 20, 300, 0)

    expect(store.getState().rev).toBe(1)
    expect(store.getState().nodes.get('el-hero-img' as never)?.props['width']).toBe(1400)
  })

  it('release with no delta commits nothing', () => {
    const { store, handle } = setup('el-hero-img')
    pointerDown(handle, 1, 100, 0)
    pointerUp(handle, 1, 100, 0)
    pointerMove(handle, 1, 900, 0) // after release: ignored
    expect(store.getState().rev).toBe(0)
  })
})

describe('resize handles: targeting', () => {
  it('dragging the element body commits nothing', () => {
    const { store, image } = setup('el-hero-img')
    pointerDown(image, 1, 100, 0)
    pointerMove(image, 1, 500, 0)
    pointerUp(image, 1, 500, 0)
    expect(store.getState().rev).toBe(0)
  })

  it('renders one handle per resize property the kind supports', () => {
    const store = new QuilStore(referenceProject())

    const image = render(<Canvas store={store} selectedId={'el-hero-img' as never} />)
    expect(image.container.querySelectorAll('[data-resize-property]').length).toBe(4)
    cleanup()

    const heading = render(<Canvas store={store} selectedId={'el-hero-heading' as never} />)
    expect(heading.container.querySelectorAll('[data-resize-property]').length).toBe(1)
    cleanup()

    const card = render(<Canvas store={store} selectedId={'el-card-a' as never} />)
    expect(card.container.querySelectorAll('[data-resize-property]').length).toBe(3)
  })

  it('renders no handles when nothing is selected', () => {
    const store = new QuilStore(referenceProject())
    const { container } = render(<Canvas store={store} />)
    expect(container.querySelectorAll('[data-resize-property]').length).toBe(0)
  })
})
