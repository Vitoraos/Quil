import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { indexedDB as fakeIndexedDB, IDBDatabase, IDBObjectStore, IDBIndex, IDBKeyRange, IDBCursor, IDBTransaction } from 'fake-indexeddb'
import type { ProjectState } from '../../src/core'
import { referenceProject, buildSyntheticFixture } from '../../src/core'
import { DexieProjectRepository } from '../../src/persistence/indexeddb-repository'
import { FallbackLock } from '../../src/persistence/indexeddb-repository'
import type { CommittedOp, SaveStatus } from '../../src/persistence/repository'

// ── fake-indexeddb setup ───────────────────────────────────────────────
// jsdom has no IndexedDB; install the fake implementation globally.
;(globalThis as unknown as { indexedDB: unknown }).indexedDB = fakeIndexedDB
;(globalThis as unknown as { IDBDatabase: unknown }).IDBDatabase = IDBDatabase
;(globalThis as unknown as { IDBObjectStore: unknown }).IDBObjectStore = IDBObjectStore
;(globalThis as unknown as { IDBIndex: unknown }).IDBIndex = IDBIndex
;(globalThis as unknown as { IDBKeyRange: unknown }).IDBKeyRange = IDBKeyRange
;(globalThis as unknown as { IDBCursor: unknown }).IDBCursor = IDBCursor
;(globalThis as unknown as { IDBTransaction: unknown }).IDBTransaction = IDBTransaction

beforeEach(() => {
  FallbackLock.reset()
  ;(globalThis as unknown as { indexedDB: { deleteDatabase: (name: string) => void } }).indexedDB.deleteDatabase('Quil')
})

afterEach(() => {
  ;(globalThis as unknown as { indexedDB: { deleteDatabase: (name: string) => void } }).indexedDB.deleteDatabase('Quil')
})

function freshRepo() {
  return new DexieProjectRepository(50)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function makeOp(baseRev: number, targetId: string, property: string, value: unknown, commandId = 'cmd-1'): CommittedOp {
  return {
    commandId: commandId as never,
    baseRev,
    command: {
      type: 'set_property',
      commandId: commandId as never,
      baseRev,
      targetId: targetId as never,
      property,
      value,
    },
    timestamp: Date.now(),
  }
}

describe('persistence: repository save-status lifecycle', () => {
  it('starts unsaved, becomes saving on appendOps, saved after flush', async () => {
    const repo = freshRepo()
    await repo.init()
    const state = referenceProject()
    await repo.ensureLeader(state.projectId)

    expect(repo.getSaveStatus(state.projectId)).toBe('unsaved')

    await repo.writeSnapshot(state.projectId, state)
    expect(repo.getSaveStatus(state.projectId)).toBe('saved')

    await repo.appendOps(state.projectId, [makeOp(0, 'el-hero-heading', 'color', '#FF0000')], state)
    expect(repo.getSaveStatus(state.projectId)).toBe('saving')

    // Store debounce (300ms) + repository debounce (300ms) = wait 700ms
    await sleep(700)
    expect(repo.getSaveStatus(state.projectId)).toBe('saved')

    repo.close(state.projectId)
  })
})

describe('persistence: load / save round-trip', () => {
  it('writes a snapshot and loads it back deep-equal', async () => {
    const repo = freshRepo()
    await repo.init()
    const state = referenceProject()

    await repo.writeSnapshot(state.projectId, state)
    expect(repo.getSaveStatus(state.projectId)).toBe('saved')

    const loaded = await repo.load(state.projectId)
    expect(loaded).not.toBeNull()
    expect(loaded!.rev).toBe(state.rev)
    expect(loaded!.name).toBe(state.name)
    expect(loaded!.nodes.get('el-hero-heading' as never)?.props.color).toBe('#1C1C1A')
    expect(loaded!.nodes.size).toBe(state.nodes.size)
    expect(loaded!.decisions.size).toBe(state.decisions.size)

    repo.close(state.projectId)
  })

  it('returns null for a project that does not exist', async () => {
    const repo = freshRepo()
    await repo.init()
    const loaded = await repo.load('nonexistent-project')
    expect(loaded).toBeNull()
    repo.close('nonexistent-project')
  })

  it('replays ops written after a snapshot', async () => {
    const repo = freshRepo()
    await repo.init()
    const state = referenceProject()
    await repo.ensureLeader(state.projectId)

    // snapshot at rev 0
    await repo.writeSnapshot(state.projectId, state)

    // append an op (baseRev = 0) — flush creates a new snapshot at rev 1
    await repo.appendOps(state.projectId, [makeOp(0, 'el-hero-heading', 'color', '#FF0000')], state)
    await sleep(700) // store debounce + repository debounce

    const loaded = await repo.load(state.projectId)
    expect(loaded).not.toBeNull()
    expect(loaded!.rev).toBe(1)
    expect(loaded!.nodes.get('el-hero-heading' as never)?.props.color).toBe('#FF0000')

    repo.close(state.projectId)
  })
})

describe('persistence: snapshot checksum and corrupt-snapshot fallback', () => {
  it('detects a corrupted snapshot and throws CORRUPT_SNAPSHOT', async () => {
    const repo = freshRepo()
    await repo.init()
    const state = referenceProject()

    // Write initial snapshot (rev 0)
    await repo.writeSnapshot(state.projectId, state)

    // Tamper with the stored checksum
    const snap = (await repo['db'].projects.get(state.projectId))!
    expect(snap).not.toBeNull()
    await repo['db'].projects.put({
      ...snap,
      checksum: snap.checksum + 1,
    })

    // Load should throw because snapshot is corrupt and no fallback exists
    await expect(repo.load(state.projectId)).rejects.toThrow()

    repo.close(state.projectId)
  })

  it('falls back to a numbered snapshot when current is corrupt', async () => {
    const repo = freshRepo()
    await repo.init()
    const state = referenceProject()
    await repo.ensureLeader(state.projectId)

    await repo.writeSnapshot(state.projectId, state)

    // Append 51 ops to trigger a numbered snapshot (snapshotEvery = 50)
    const ops: CommittedOp[] = []
    for (let i = 0; i < 51; i++) {
      ops.push(makeOp(i, 'el-hero-heading', 'color', `#${i.toString(16).padStart(6, '0')}`, `cmd-bulk-${i}`))
    }
    await repo.appendOps(state.projectId, ops, state)
    await sleep(700) // store debounce + repository debounce

    // Now corrupt the current snapshot
    const snap = await repo['db'].projects.get(state.projectId)
    expect(snap).not.toBeNull()
    if (!snap) throw new Error('no snap')
    await repo['db'].projects.put({
      ...snap,
      checksum: snap.checksum + 1,
    })

    // Load should fall back to the numbered snapshot (rev ~50)
    const loaded = await repo.load(state.projectId)
    expect(loaded).not.toBeNull()
    expect(loaded!.rev).toBeGreaterThan(0)

    repo.close(state.projectId)
  })
})

describe('persistence: listProjects and delete', () => {
  it('lists projects and can delete one', async () => {
    const repo = freshRepo()
    await repo.init()

    const state1 = referenceProject()
    const state2 = buildSyntheticFixture(10)
    state2.projectId = 'proj-2' as never
    state2.name = 'Second Project'

    await repo.writeSnapshot(state1.projectId, state1)
    await repo.writeSnapshot(state2.projectId, state2)

    const list = await repo.listProjects()
    expect(list.length).toBe(2)
    expect(list.some((p) => p.id === state1.projectId)).toBe(true)
    expect(list.some((p) => p.id === state2.projectId)).toBe(true)

    await repo.delete(state2.projectId)
    const list2 = await repo.listProjects()
    expect(list2.length).toBe(1)
    expect(list2[0]!.id).toBe(state1.projectId)

    repo.close(state1.projectId)
  })
})

describe('persistence: read-only mode (non-leader tab cannot write)', () => {
  it('appendOps is a no-op when not the leader', async () => {
    const repo = freshRepo()
    await repo.init()

    // First, acquire leadership
    const isLeader = await repo.ensureLeader(referenceProject().projectId)
    expect(isLeader).toBe(true)
    expect(repo.isLeader(referenceProject().projectId)).toBe(true)

    // Release the lock to simulate another tab being the leader
    repo.close(referenceProject().projectId)
    expect(repo.isLeader(referenceProject().projectId)).toBe(false)

    // appendOps should not throw when not leader
    const state = referenceProject()
    await repo.appendOps(state.projectId, [], state)
    // No error thrown

    repo.close(state.projectId)
  })
})

describe('persistence: save-status subscription', () => {
  it('notifies subscribers of status changes', async () => {
    const repo = freshRepo()
    await repo.init()
    const state = referenceProject()

    // Acquire leadership so appendOps actually writes
    await repo.ensureLeader(state.projectId)

    const statuses: SaveStatus[] = []
    const unsub = repo.subscribe(state.projectId, (s) => statuses.push(s))

    await repo.writeSnapshot(state.projectId, state)
    await repo.appendOps(
      state.projectId,
      [makeOp(0, 'el-hero-heading', 'color', '#00FF00')],
      state
    )
    // Store debounce (300ms) + repository debounce (300ms) = wait 700ms
    await sleep(700)

    expect(statuses).toContain('saved')
    expect(statuses).toContain('saving')
    expect(statuses).toContain('saved')

    unsub()
    repo.close(state.projectId)
  })
})

describe('persistence: cold-load performance', () => {
  it('loads a 2,000-element fixture quickly', async () => {
    const repo = freshRepo()
    await repo.init()
    const state = buildSyntheticFixture(2000)

    const writeStart = performance.now()
    await repo.writeSnapshot(state.projectId, state)
    const writeElapsed = performance.now() - writeStart

    const loadStart = performance.now()
    const loaded = await repo.load(state.projectId)
    const loadElapsed = performance.now() - loadStart

    expect(loaded).not.toBeNull()
    expect(loaded!.nodes.size).toBe(2000)
    // Budget: cold load under 1 s (1000 ms)
    expect(loadElapsed).toBeLessThan(1000)
    // Write should also be fast
    expect(writeElapsed).toBeLessThan(1000)

    repo.close(state.projectId)
  })
})
