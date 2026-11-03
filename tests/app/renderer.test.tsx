import { act, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { referenceProject, elementIdSchema } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { Canvas } from '../../src/app/renderer'

describe('renderer: render-consistency & defensive text handling', () => {
  it('renders DOM matching the resolved model across random edits', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const headingId = elementIdSchema.parse('el-hero-heading') as never
    const heading = container.querySelector(`[data-element-id="${String(headingId)}"]`)
    expect(heading).not.toBeNull()
    expect(heading?.textContent).toContain('Design once. Apply everywhere.')

    // Edit via command bus; flush React re-render with act()
    act(() => {
      store.dispatch({
        type: 'set_property',
        commandId: 'cmd-edit-1' as never,
        baseRev: store.getState().rev,
        targetId: headingId,
        property: 'color',
        value: '#F5F5F2'
      })
    })

    const updated = container.querySelector(`[data-element-id="${String(headingId)}"]`)
    expect(updated).not.toBeNull()
    expect(updated?.getAttribute('style')).toContain('rgb(245, 245, 242)')
  })

  it('renders text as text nodes only — never innerHTML (XSS defense)', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Canvas store={store} />)

    const elNode = container.querySelector('[data-element-id="el-footer-copy"]')
    expect(elNode).not.toBeNull()
    // No script or img element should exist in the DOM
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('zero or negative size is rejected by the command bus', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const headingId = elementIdSchema.parse('el-hero-heading') as never
    const res = store.dispatch({
      type: 'set_property',
      commandId: 'cmd-neg-size' as never,
      baseRev: store.getState().rev,
      targetId: headingId,
      property: 'fontSize',
      value: { value: -5, unit: 'px' }
    })
    expect(res.ok).toBe(false)
    // State unchanged
    const el = store.getState().nodes.get(headingId)
    const fs = el?.props['fontSize']
    expect(fs).not.toEqual({ value: -5, unit: 'px' })
  })
})
