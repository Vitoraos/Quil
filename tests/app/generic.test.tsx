import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyProject, referenceProject, validateProject } from '../../src/core'
import { Editor } from '../../src/app/editor'
import { QuilStore } from '../../src/app/store'

afterEach(() => cleanup())

function renderEditor(onStartIntake?: () => void) {
  const store = new QuilStore(emptyProject())
  return render(<Editor store={store} onStartIntake={onStartIntake} />)
}

describe('generic project model', () => {
  it('starts from a blank project with no pages or elements', () => {
    const state = emptyProject()
    expect(state.pages.size).toBe(0)
    expect(state.nodes.size).toBe(0)
    expect(state.schemaVersion).toBe(4)
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

describe('editor empty state', () => {
  it('shows the brief prompt instead of a canvas when there are no pages', () => {
    const { container, getByTestId } = renderEditor()
    expect(getByTestId('canvas-empty')).toBeTruthy()
    expect(container.querySelector('[data-testid^="page-tab-"]')).toBeNull()
  })

  it('asks to start intake from the empty state', async () => {
    const onStartIntake = vi.fn()
    const { getByTestId } = renderEditor(onStartIntake)
    await act(async () => {
      fireEvent.click(getByTestId('canvas-empty-intake'))
    })
    expect(onStartIntake).toHaveBeenCalledTimes(1)
  })
})