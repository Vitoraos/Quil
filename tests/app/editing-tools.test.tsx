import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyProject, referenceProject } from '../../src/core'
import type { ElementId } from '../../src/core'
import { Editor } from '../../src/app/editor'
import { LayersPanel } from '../../src/app/layers-panel'
import { QuilStore } from '../../src/app/store'

afterEach(() => cleanup())

const id = (v: string) => v as ElementId

function nodeCount(store: QuilStore): number {
  return store.getState().nodes.size
}

describe('insert menu', () => {
  it('opens with / and inserts a text element into the nearest container', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId, queryByTestId, container } = render(<Editor store={store} />)
    fireEvent.click(container.querySelector('[data-element-id="el-hero-img"]')!)

    fireEvent.keyDown(window, { key: '/' })
    expect(getByTestId('insert-menu')).toBeTruthy()
    const before = nodeCount(store)

    fireEvent.click(getByTestId('insert-kind-text'))
    expect(nodeCount(store)).toBe(before + 1)
    expect(queryByTestId('insert-menu')).toBeNull()

    const added = [...store.getState().nodes.values()].find((n) => n.id.startsWith('el-') && n.kind === 'text' && n.parentId === id('sec-hero') && !n.id.includes('hero'))
    expect(added).toBeTruthy()
    expect(store.getState().nodes.get(added!.id)!.props.text).toBe('Body text')
  })

  it('reports a typed error when the page has no section', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId, getByText, container } = render(<Editor store={store} />)
    fireEvent.click(getByText('About'))
    fireEvent.keyDown(window, { key: '/' })
    const before = nodeCount(store)

    fireEvent.click(getByTestId('insert-kind-text'))
    expect(getByTestId('insert-error')).toBeTruthy()
    expect(nodeCount(store)).toBe(before)
    expect(container.querySelector('[data-element-id="el-hero-img"]')).toBeNull()
  })
})

describe('layers panel', () => {
  it('lists the page tree and selects a row', () => {
    const store = new QuilStore(referenceProject())
    const onSelect = vi.fn()
    const { getByTestId } = render(
      <LayersPanel store={store} pageId={'page-home' as never} selectedId={null} onSelect={onSelect} />
    )
    expect(getByTestId('layer-row-el-hero-img')).toBeTruthy()
    fireEvent.click(getByTestId('layer-select-el-hero-img'))
    expect(onSelect).toHaveBeenCalledWith('el-hero-img')
  })

  it('moves a section among sections with one command', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId } = render(
      <LayersPanel store={store} pageId={'page-home' as never} selectedId={null} onSelect={() => {}} />
    )
    const before = store.getState().undoStack.length

    fireEvent.click(getByTestId('layer-down-sec-nav'))
    const sections = store.getState().pages.get('page-home' as never)!.sectionIds
    expect(sections[0]).toBe('sec-hero')
    expect(store.getState().undoStack.length).toBe(before + 1)
  })

  it('moves a leaf among its siblings, not across parents', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId } = render(
      <LayersPanel store={store} pageId={'page-home' as never} selectedId={null} onSelect={() => {}} />
    )

    fireEvent.click(getByTestId('layer-down-el-hero-heading'))
    const children = store.getState().nodes.get(id('sec-hero'))!.childIds
    expect(children[0]).toBe('el-hero-text')
    expect(children[1]).toBe('el-hero-heading')
    expect(store.getState().nodes.get(id('el-hero-heading'))!.parentId).toBe('sec-hero')
  })

  it('does nothing at the end of a list', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId } = render(
      <LayersPanel store={store} pageId={'page-home' as never} selectedId={null} onSelect={() => {}} />
    )
    const before = store.getState().rev
    fireEvent.click(getByTestId('layer-up-sec-nav'))
    expect(store.getState().rev).toBe(before)
  })
})

describe('delete and duplicate', () => {
  it('deletes the selection on Delete and restores it on undo', () => {
    const store = new QuilStore(referenceProject())
    const { container } = render(<Editor store={store} />)
    fireEvent.click(container.querySelector('[data-element-id="el-hero-img"]')!)

    fireEvent.keyDown(window, { key: 'Delete' })
    expect(store.getState().nodes.has(id('el-hero-img'))).toBe(false)
    expect(container.querySelector('[data-element-id="el-hero-img"]')).toBeNull()

    fireEvent.click(container.querySelector('[data-testid="undo-btn"]')!)
    expect(store.getState().nodes.has(id('el-hero-img'))).toBe(true)
  })

  it('duplicates the selection with Ctrl+D as one undoable batch', () => {
    const store = new QuilStore(referenceProject())
    const { container } = render(<Editor store={store} />)
    fireEvent.click(container.querySelector('[data-element-id="el-hero-img"]')!)
    const before = nodeCount(store)
    const undoBefore = store.getState().undoStack.length

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    expect(nodeCount(store)).toBe(before + 1)
    expect(store.getState().undoStack.length).toBe(undoBefore + 1)

    const copies = [...store.getState().nodes.values()].filter(
      (n) => n.kind === 'image' && n.id !== id('el-hero-img')
    )
    expect(copies).toHaveLength(1)
    expect(copies[0]!.props).toEqual(store.getState().nodes.get(id('el-hero-img'))!.props)
    expect(copies[0]!.parentId).toBe('sec-hero')

    fireEvent.click(container.querySelector('[data-testid="undo-btn"]')!)
    expect(nodeCount(store)).toBe(before)
  })

  it('inserts a page section as a root', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId } = render(<Editor store={store} />)
    const before = store.getState().pages.get('page-home' as never)!.sectionIds.length

    fireEvent.keyDown(window, { key: '/' })
    fireEvent.click(getByTestId('insert-kind-section'))

    const sections = store.getState().pages.get('page-home' as never)!.sectionIds
    expect(sections.length).toBe(before + 1)
    const added = store.getState().nodes.get(sections[sections.length - 1]!)!
    expect(added.kind).toBe('section')
    expect(added.parentId).toBeNull()
  })

  it('disables image insert when the project has no asset', () => {
    const store = new QuilStore(emptyProject())
    const { getByTestId } = render(<Editor store={store} />)
    fireEvent.click(getByTestId('insert-toggle'))
    expect((getByTestId('insert-kind-image') as HTMLButtonElement).disabled).toBe(true)
  })

  it('duplicates a section with its children as one batch', () => {
    const store = new QuilStore(referenceProject())
    const { container } = render(<Editor store={store} />)
    fireEvent.click(container.querySelector('[data-element-id="sec-nav"]')!)
    const before = nodeCount(store)
    const sectionsBefore = store.getState().pages.get('page-home' as never)!.sectionIds.length

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    expect(nodeCount(store)).toBe(before + 2)
    expect(store.getState().pages.get('page-home' as never)!.sectionIds.length).toBe(sectionsBefore + 1)

    fireEvent.click(container.querySelector('[data-testid="undo-btn"]')!)
    expect(nodeCount(store)).toBe(before)
    expect(store.getState().pages.get('page-home' as never)!.sectionIds.length).toBe(sectionsBefore)
  })
})

describe('generation tray', () => {
  it('toggles from the header button without touching the document', () => {
    const store = new QuilStore(referenceProject())
    const { getByTestId, queryByTestId } = render(<Editor store={store} />)
    const revBefore = store.getState().rev

    expect(queryByTestId('generation-tray')).toBeNull()
    fireEvent.click(getByTestId('gen-btn'))
    expect(getByTestId('generation-tray')).toBeTruthy()
    expect(store.getState().rev).toBe(revBefore)

    fireEvent.click(getByTestId('gen-btn'))
    expect(queryByTestId('generation-tray')).toBeNull()
  })
})
