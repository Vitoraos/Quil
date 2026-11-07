import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { referenceProject } from '../../src/core'
import type { DecisionId, ElementId } from '../../src/core'
import { Editor } from '../../src/app/editor'
import { QuilStore } from '../../src/app/store'

afterEach(() => cleanup())

describe('decisions panel', () => {
  it('opens with D and lists approved decisions newest first', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId, queryByTestId } = render(<Editor store={store} />)
    expect(queryByTestId('decisions-panel')).toBeNull()

    fireEvent.keyDown(window, { key: 'D' })
    expect(getByTestId('decisions-panel')).toBeTruthy()
    expect(getByTestId('decisions-toggle').textContent).toContain('2')

    const rows = getByTestId('decisions-panel').querySelectorAll('[data-testid^="decision-row-"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.getAttribute('data-testid')).toBe('decision-row-dec-hero-font')
  })

  it('describes each scope in plain language', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId } = render(<Editor store={store} />)
    fireEvent.keyDown(window, { key: 'D' })

    expect(getByTestId('decision-scope-dec-btn-brand').textContent).toBe('Every button')
    expect(getByTestId('decision-scope-dec-hero-font').textContent).toBe('This element (el-hero-heading)')
    expect(getByTestId('decision-status-dec-btn-brand').textContent).toBe('approved')
  })

  it('shows superseded decisions as history without counting them', () => {
    const state = referenceProject()
    state.decisions.set('dec-old' as DecisionId, {
      id: 'dec-old' as DecisionId,
      property: 'bgColor',
      value: '#000000',
      scope: { kind: 'instance', elementId: 'el-hero-img' as ElementId },
      status: 'superseded',
      seq: 99
    })
    const store = new QuilStore(state)
    const { getByTestId } = render(<Editor store={store} />)
    fireEvent.keyDown(window, { key: 'D' })

    expect(getByTestId('decisions-toggle').textContent).toContain('2')
    expect(getByTestId('decision-row-dec-old').getAttribute('data-status')).toBe('superseded')
  })

  it('toggles closed with D again', () => {
    const store = new QuilStore(referenceProject())
    const { queryByTestId } = render(<Editor store={store} />)
    fireEvent.keyDown(window, { key: 'd' })
    expect(queryByTestId('decisions-panel')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'd' })
    expect(queryByTestId('decisions-panel')).toBeNull()
  })
})
