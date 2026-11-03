import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { emptyProject, referenceProject, validateProject } from '../../src/core'
import { App } from '../../src/app/App'

afterEach(() => cleanup())

describe('generic project model', () => {
  it('starts from a blank project with no pages or elements', () => {
    const state = emptyProject()
    expect(state.pages.size).toBe(0)
    expect(state.nodes.size).toBe(0)
    expect(state.schemaVersion).toBe(2)
    expect(validateProject(state)).toEqual([])
  })

  it('reference project carries no vertical-specific pages', () => {
    const state = referenceProject()
    const names = [...state.pages.values()].map((p) => p.name)
    expect(names).toEqual(['Home', 'About'])
    expect(names).not.toContain('Rooms')
    expect(validateProject(state)).toEqual([])
  })
})

describe('app empty state', () => {
  it('shows the brief prompt instead of a canvas when there are no pages', () => {
    const { container, getByTestId } = render(<App />)
    expect(getByTestId('canvas-empty')).toBeTruthy()
    expect(container.querySelector('[data-testid^="page-tab-"]')).toBeNull()
  })

  it('opens intake from the empty state', async () => {
    const { getByTestId } = render(<App />)
    await act(async () => {
      fireEvent.click(getByTestId('canvas-empty-intake'))
    })
    expect(getByTestId('intake-brief')).toBeTruthy()
  })
})
