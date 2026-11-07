import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import { Editor } from '../../src/app/editor'
import { QuilStore } from '../../src/app/store'

afterEach(() => cleanup())

function select(container: HTMLElement, id: string): void {
  fireEvent.click(container.querySelector(`[data-element-id="${id}"]`)!)
}

describe('arrow nudge', () => {
  it('nudges the primary resize property by 1px, Shift by 10px', () => {
    const store = new QuilStore(referenceProject())
    const { container } = render(<Editor store={store} />)
    select(container, 'el-hero-img')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(store.getState().nodes.get('el-hero-img' as never)?.props['width']).toBe(1201)

    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
    expect(store.getState().nodes.get('el-hero-img' as never)?.props['width']).toBe(1211)
    expect(store.getState().undoStack.length).toBe(2)
  })

  it('uses the vertical property for up and down', () => {
    const store = new QuilStore(referenceProject())
    const { container } = render(<Editor store={store} />)
    select(container, 'el-hero-img')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(store.getState().nodes.get('el-hero-img' as never)?.props['height']).toBe(599)
  })

  it('nudges text kinds by their font size', () => {
    const store = new QuilStore(referenceProject())
    const { container } = render(<Editor store={store} />)
    select(container, 'el-hero-heading')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(store.getState().nodes.get('el-hero-heading' as never)?.props['fontSize']).toEqual({
      value: 41,
      unit: 'px'
    })
  })

  it('does nothing without a selection', () => {
    const store = new QuilStore(referenceProject())
    render(<Editor store={store} />)

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(store.getState().rev).toBe(0)
  })
})
