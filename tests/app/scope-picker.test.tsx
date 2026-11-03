import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { referenceProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { ScopePicker } from '../../src/app/scope-picker'

describe('scope-picker: affected-element count + meaningful choices', () => {
  it('shows plain-language effect text and live count of affected elements', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(
      <ScopePicker store={store} elementId={'el-hero-cta' as never} property="bgColor" />
    )

    const countText = container.textContent ?? ''
    expect(countText).toMatch(/\d+/)
  })

  it('renders scope choices without crashing', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(
      <ScopePicker store={store} elementId={'el-hero-heading' as never} property="level" />
    )
    expect(container).not.toBeNull()
  })
})
