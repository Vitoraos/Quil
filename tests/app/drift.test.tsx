import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { referenceProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { DriftBadge } from '../../src/app/drift-badge'

describe('drift-badge: deviation signal + override/propose', () => {
  it('signals when a hand edit deviates from an approved decision', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(
      <DriftBadge
        store={store}
        elementId={'el-hero-cta' as never}
        property="bgColor"
        currentValue="#F5F5F2"
      />
    )

    const badge = container.querySelector('[data-testid="drift-badge"]')
    expect(badge).not.toBeNull()
  })

  it('offers keep-as-instance-override or propose-changing-decision', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(
      <DriftBadge
        store={store}
        elementId={'el-hero-cta' as never}
        property="bgColor"
        currentValue="#F5F5F2"
      />
    )

    const override = container.querySelector('[data-action="keep-override"]')
    const propose = container.querySelector('[data-action="propose-decision"]')
    expect(override).not.toBeNull()
    expect(propose).not.toBeNull()
  })

  it('nothing changes a decision without approval', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(
      <DriftBadge
        store={store}
        elementId={'el-hero-cta' as never}
        property="bgColor"
        currentValue="#F5F5F2"
      />
    )

    expect(store.getState().decisions.size).toBe(2)
  })
})
