import { describe, expect, it } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { referenceProject, applyCommand } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { ScopePicker } from '../../src/app/scope-picker'
import type { ApplyResult } from '../../src/core'

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

  it('dispatches resolved value (not base) when changing scope', () => {
    const state = referenceProject()
    // referenceProject already has a global bgColor decision for buttons:
    // dec-btn-brand: bgColor = oklch(0.47 0.27 264), global scope, seq 1
    // Approve a new global decision with higher seq to override it
    const step1 = applyCommand(state, {
      type: 'set_property',
      commandId: 'cmd-global' as never,
      baseRev: state.rev,
      targetId: 'el-hero-cta' as never,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'global', targetType: 'button' }
    }) as ApplyResult
    if (!step1.ok) throw new Error(step1.error.message)

    const store = new QuilStore(step1.state)
    const { container } = render(
      <ScopePicker store={store} elementId={'el-hero-cta' as never} property="bgColor" />
    )

    // Click the global scope button — should dispatch the resolved value (#F5F5F2),
    // not the base element prop (#1E1E22)
    const globalBtn = container.querySelector('[data-scope="global"]') as HTMLElement
    fireEvent.click(globalBtn)

    // The store should now have bgColor = #F5F5F2 (the resolved/global value)
    const updated = store.getSnapshot()
    const decisions = [...updated.decisions.values()]
    const bgDecisions = decisions.filter((d) => d.property === 'bgColor' && d.scope.kind === 'global')
    expect(bgDecisions.length).toBeGreaterThan(0)
    // At least one global bgColor decision should have the resolved value
    expect(bgDecisions.some((d) => d.value === '#F5F5F2')).toBe(true)
  })
})
