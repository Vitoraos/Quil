import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import type { NodeKind } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { Inspector } from '../../src/app/inspector'

afterEach(() => cleanup())

function elementOfKind(kind: NodeKind): string {
  const state = referenceProject()
  const found = [...state.nodes.values()].find((n) => n.kind === kind)
  if (!found) throw new Error(`fixture has no ${kind}`)
  return String(found.id)
}

function renderFor(kind: NodeKind) {
  const store = new QuilStore(referenceProject())
  const elementId = elementOfKind(kind)
  const utils = render(<Inspector store={store} elementId={elementId as never} />)
  return { ...utils, store, elementId }
}

describe('inspector groups', () => {
  it('shows only the groups the kind supports', () => {
    const heading = renderFor('heading')
    expect(heading.queryByTestId('inspector-group-content')).toBeTruthy()
    expect(heading.queryByTestId('inspector-group-type')).toBeTruthy()
    expect(heading.queryByTestId('inspector-group-space')).toBeNull()
    cleanup()

    const card = renderFor('card')
    expect(card.queryByTestId('inspector-group-space')).toBeTruthy()
    expect(card.queryByTestId('inspector-group-type')).toBeNull()
  })

  it('rejects an out-of-range number inline and dispatches nothing', () => {
    const { store, getByTestId } = renderFor('card')
    const before = store.getState().rev
    const input = getByTestId('field-input-padding') as HTMLInputElement
    fireEvent.change(input, { target: { value: '-20' } })
    fireEvent.blur(input)
    expect(getByTestId('inline-error')).toBeTruthy()
    expect(store.getState().rev).toBe(before)
  })

  it('commits one command per valid edit', () => {
    const { store, getByTestId, elementId } = renderFor('card')
    const before = store.getState().undoStack.length
    const input = getByTestId('field-input-padding') as HTMLInputElement
    fireEvent.change(input, { target: { value: '24' } })
    fireEvent.blur(input)
    expect(store.getState().nodes.get(elementId as never)?.props.padding).toEqual({ value: 24 })
    expect(store.getState().undoStack.length).toBe(before + 1)
  })

  it('remembers collapsed groups across selection changes', () => {
    const store = new QuilStore(referenceProject())
    const cardId = elementOfKind('card')
    const headingId = elementOfKind('heading')
    const { getByTestId, queryByTestId, rerender } = render(<Inspector store={store} elementId={cardId as never} />)
    fireEvent.click(getByTestId('inspector-toggle-space'))
    expect(queryByTestId('field-input-padding')).toBeNull()
    rerender(<Inspector store={store} elementId={headingId as never} />)
    rerender(<Inspector store={store} elementId={cardId as never} />)
    expect(queryByTestId('field-input-padding')).toBeNull()
  })

  it('routes colour properties to the colour slot instead of a text field', () => {
    const { queryByTestId, getByTestId } = renderFor('button')
    expect(getByTestId('inspector-group-colour')).toBeTruthy()
    expect(queryByTestId('field-input-bgColor')).toBeNull()
  })
})