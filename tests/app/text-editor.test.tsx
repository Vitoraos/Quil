import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import { Editor } from '../../src/app/editor'
import { QuilStore } from '../../src/app/store'

afterEach(() => cleanup())

function setup() {
  const store = new QuilStore(referenceProject())
  const utils = render(<Editor store={store} />)
  const heading = utils.container.querySelector('[data-kind="heading"]') as HTMLElement
  return { ...utils, store, heading }
}

describe('in-place text editing', () => {
  it('opens on double-click and commits one command on Enter', () => {
    const { store, heading, getByTestId } = setup()
    const before = store.getState().undoStack.length
    fireEvent.doubleClick(heading)
    const editor = getByTestId('text-editor') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'New heading' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    const id = heading.getAttribute('data-element-id') as never
    expect(store.getState().nodes.get(id)?.props.text).toBe('New heading')
    expect(store.getState().undoStack.length).toBe(before + 1)
  })

  it('commits nothing on Escape', () => {
    const { store, heading, getByTestId } = setup()
    const id = heading.getAttribute('data-element-id') as never
    const original = store.getState().nodes.get(id)?.props.text
    fireEvent.doubleClick(heading)
    const editor = getByTestId('text-editor') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'Discarded' } })
    fireEvent.keyDown(editor, { key: 'Escape' })
    expect(store.getState().nodes.get(id)?.props.text).toBe(original)
  })

  it('opens with the T shortcut for the selected element', () => {
    const { heading, getByTestId, queryByTestId } = setup()
    fireEvent.click(heading)
    expect(queryByTestId('text-editor')).toBeNull()
    fireEvent.keyDown(window, { key: 't' })
    expect(getByTestId('text-editor')).toBeTruthy()
  })

  it('does not open on a container kind', () => {
    const { container, queryByTestId } = setup()
    const card = container.querySelector('[data-kind="card"]')
    if (!card) return
    fireEvent.doubleClick(card)
    expect(queryByTestId('text-editor')).toBeNull()
  })
})