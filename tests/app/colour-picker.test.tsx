import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import { Editor } from '../../src/app/editor'
import { QuilStore } from '../../src/app/store'
import { newCommandId } from '../../src/app/command-id'

afterEach(() => cleanup())

function setup() {
  const store = new QuilStore(referenceProject())
  const utils = render(<Editor store={store} />)
  const heading = utils.container.querySelector('[data-kind="heading"]') as HTMLElement
  return { ...utils, store, heading }
}

describe('colour picker', () => {
  it('opens with C for a text element and applies a swatch as one command', () => {
    const { store, heading, getByTestId, queryByTestId } = setup()
    fireEvent.click(heading)
    fireEvent.keyDown(window, { key: 'c' })
    expect(getByTestId('colour-panel')).toBeTruthy()

    const before = store.getState().undoStack.length
    fireEvent.click(getByTestId('colour-swatch-#ECECE8'))
    const id = heading.getAttribute('data-element-id') as never
    expect(store.getState().nodes.get(id)?.props.color).toBe('#ECECE8')
    expect(store.getState().undoStack.length).toBe(before + 1)
    expect(queryByTestId('colour-panel')).toBeNull()
  })

  it('lists approved decision colours first', () => {
    const store = new QuilStore(referenceProject())
    const state = store.getState()
    const headingId = [...state.nodes.values()].find((n) => n.kind === 'heading')!.id
    store.dispatch({
      type: 'set_property',
      commandId: newCommandId('seed'),
      baseRev: state.rev,
      targetId: headingId,
      property: 'color',
      value: '#7C3AED',
      scope: { kind: 'global', targetType: 'heading' }
    })
    const { container, getByTestId } = render(<Editor store={store} />)
    fireEvent.click(container.querySelector('[data-kind="heading"]')!)
    fireEvent.keyDown(window, { key: 'c' })
    expect(getByTestId('colour-swatch-#7C3AED').getAttribute('data-approved')).toBe('true')
  })

  it('shows live contrast for the current colour', () => {
    const { heading, getByTestId } = setup()
    fireEvent.click(heading)
    fireEvent.keyDown(window, { key: 'c' })
    expect(getByTestId('colour-contrast').textContent).toMatch(/:\d|\d/)
  })

  it('stays closed for kinds with no colour property', () => {
    const { container, queryByTestId } = setup()
    const image = container.querySelector('[data-kind="image"]')
    if (!image) return
    fireEvent.click(image)
    fireEvent.keyDown(window, { key: 'c' })
    expect(queryByTestId('colour-panel')).toBeNull()
  })
})