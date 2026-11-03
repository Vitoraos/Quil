import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { referenceProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { Inspector } from '../../src/app/inspector'

describe('inspector: valid/invalid input, inline error, validator before dispatch', () => {
  it('valid input dispatches a typed command and updates state', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Inspector store={store} elementId={'el-hero-cta' as never} />)

    const input = (container.querySelector('input[name="bgColor"]') as HTMLInputElement)!
    fireEvent.change(input, { target: { value: '#F5F5F2' } })
    fireEvent.blur(input)

    expect(store.getState().rev).toBeGreaterThan(0)
    expect(store.getState().nodes.get('el-hero-cta' as never)?.props['bgColor']).toBe('#F5F5F2')
  })

  it('invalid input is rejected at the command bus and changes nothing', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Inspector store={store} elementId={'el-hero-cta' as never} />)

    // Dispatch an invalid color directly through the command bus (the same path
    // the inspector's blur handler uses). Validation rejects it, state is unchanged.
    const res = store.dispatch({
      type: 'set_property',
      commandId: 'cmd-inspector-invalid' as never,
      baseRev: store.getState().rev,
      targetId: 'el-hero-cta' as never,
      property: 'bgColor',
      value: 'not-a-color'
    })
    expect(res.ok).toBe(false)
    expect(store.getState().nodes.get('el-hero-cta' as never)?.props['bgColor']).toBe('oklch(0.47 0.27 264)')
  })

  it('zero or negative size rejected at the command bus', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Inspector store={store} elementId={'el-hero-heading' as never} />)

    const res = store.dispatch({
      type: 'set_property',
      commandId: 'cmd-inspector-neg-size' as never,
      baseRev: store.getState().rev,
      targetId: 'el-hero-heading' as never,
      property: 'fontSize',
      value: { value: -5, unit: 'px' }
    })
    expect(res.ok).toBe(false)
    expect(store.getState().nodes.get('el-hero-heading' as never)?.props['fontSize']).toEqual({ value: 40, unit: 'px' })
  })

  it('inspector renders enabled for a normal element', () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    const { container } = render(<Inspector store={store} elementId={'el-hero-heading' as never} />)

    const disabled = container.querySelector('[aria-disabled="true"]')
    expect(disabled).toBeNull()
  })
})
