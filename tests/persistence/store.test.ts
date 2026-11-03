import { describe, expect, it, beforeEach } from 'vitest'
import { referenceProject } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { FallbackLock } from '../../src/persistence/indexeddb-repository'
import { resolveElement } from '../../src/core/decisions'
import { projectRepository } from '../../src/persistence'

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

beforeEach(() => {
  FallbackLock.reset()
  ;(globalThis as unknown as { indexedDB: { deleteDatabase: (name: string) => void } }).indexedDB.deleteDatabase('Quil')
})

describe('store: persistence integration', () => {
  it('writes initial snapshot on init and persists commands across flush', async () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    await store.init()

    // Initial snapshot written by init
    expect(store.getSaveStatus()).toBe('saved')

    // Dispatch a command
    const result = store.dispatch({
      type: 'set_property',
      commandId: 'cmd-store-1' as never,
      baseRev: store.getState().rev,
      targetId: 'el-hero-heading' as never,
      property: 'color',
      value: '#FF0000',
    })
    expect(result.ok).toBe(true)
    expect(store.getState().nodes.get('el-hero-heading' as never)?.props.color).toBe('#FF0000')

    // Wait for write-behind flush (store debounce + repository debounce)
    await sleep(700)
    expect(store.getSaveStatus()).toBe('saved')
  })

  it('refresh deep-equal: resolved state matches after simulated reload', async () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    await store.init()

    // Apply a scoped decision
    store.dispatch({
      type: 'set_property',
      commandId: 'cmd-scoped-1' as never,
      baseRev: store.getState().rev,
      targetId: 'el-hero-cta' as never,
      property: 'bgColor',
      value: '#00FF00',
      scope: { kind: 'global', targetType: 'button' },
    })
    await sleep(700)

    // Capture resolved state before "refresh"
    const before = resolveElement(store.getState(), 'el-hero-cta' as never)
    expect(before.ok).toBe(true)

    // Simulate reload: load from persistence (same singleton repository)
    const loaded = await projectRepository.load(state.projectId)
    expect(loaded).not.toBeNull()

    const after = resolveElement(loaded!, 'el-hero-cta' as never)
    expect(after.ok).toBe(true)

    if (before.ok && after.ok) {
      // Resolved props should be deep-equal after reload
      expect(JSON.stringify(after.result.props)).toBe(
        JSON.stringify(before.result.props)
      )
    }
  })

  it('isLeader reflects write lock status', async () => {
    const state = referenceProject()
    const store = new QuilStore(state)
    await store.init()
    expect(store.isLeader()).toBe(true)
  })
})
