import Dexie, { type Table } from 'dexie'
import type { PageId, ProjectState } from '../core'
import type { DesignCommand } from '../core/commands'
import { applyCommand } from '../core/apply'
import {
  ProjectRepository,
  CommittedOp,
  ProjectSummary,
  SaveStatus,
  PersistenceError,
} from './repository'
import { SCHEMA_VERSION, migrate } from './migration'

const DB_NAME = 'Quil'
const DB_VERSION = 1
const SNAPSHOT_EVERY = 50 // write a numbered snapshot every N ops

// Simple FNV-1a checksum for snapshot integrity verification
function checksum(data: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i)
    hash = (hash * 0x01000193) | 0
  }
  return hash >>> 0
}

function serializeState(state: ProjectState): unknown {
  return {
    schemaVersion: state.schemaVersion,
    projectId: state.projectId,
    name: state.name,
    rev: state.rev,
    pages: [...state.pages.entries()],
    nodes: [...state.nodes.entries()],
    decisions: [...state.decisions.entries()],
    assets: [...state.assets.entries()],
    undoStack: state.undoStack,
    redoStack: state.redoStack,
    seenCommandIds: state.seenCommandIds,
    seenCandidateIds: state.seenCandidateIds,
    nextDecisionSeq: state.nextDecisionSeq,
    brief: state.brief,
    intakeAnswers: [...state.intakeAnswers.entries()],
    startingPageId: state.startingPageId,
    pageSpecs: [...state.pageSpecs.entries()],
  }
}

function deserializeState(data: unknown): ProjectState {
  const d = data as Record<string, unknown>
  return {
    schemaVersion: SCHEMA_VERSION,
    projectId: ((d.projectId as string) ?? '') as never,
    name: (d.name as string) ?? '',
    rev: (d.rev as number) ?? 0,
    pages: new Map(((d.pages as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
    nodes: new Map(((d.nodes as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
    decisions: new Map(((d.decisions as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
    assets: new Map(((d.assets as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
    undoStack: (d.undoStack as unknown[]) ?? [],
    redoStack: (d.redoStack as unknown[]) ?? [],
    seenCommandIds: ((d.seenCommandIds as unknown[]) ?? []).map((x) => x as never),
    seenCandidateIds: ((d.seenCandidateIds as unknown[]) ?? []).map((x) => x as never),
    nextDecisionSeq: (d.nextDecisionSeq as number) ?? 1,
    brief: (d.brief as string) ?? '',
    intakeAnswers: new Map(((d.intakeAnswers as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v as never])),
    startingPageId: ((d.startingPageId as string) ?? null) as PageId | null,
    pageSpecs: new Map(((d.pageSpecs as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
  } as ProjectState
}

interface QuilDB extends Dexie {
  projects: Table<StoredProject, string>
  ops: Table<QuilOp, number>
  snapshots: Table<StoredSnapshot, number>
}

interface StoredProject {
  id: string
  state: ReturnType<typeof serializeState>
  rev: number
  schemaVersion: number
  checksum: number
  updatedAt: number
}

interface QuilOp {
  id?: number
  projectId: string
  seq: number
  commandId: string
  baseRev: number
  command: DesignCommand
  timestamp: number
}

interface StoredSnapshot {
  id?: number
  projectId: string
  seq: number
  state: ReturnType<typeof serializeState>
  rev: number
  schemaVersion: number
  checksum: number
  createdAt: number
}

/**
 * Fallback in-memory lock when navigator.locks is unavailable
 * (single-tab, tests, older browsers). Only one tab can hold it per process.
 */
class FallbackLock {
  private static heldByProject = new Map<string, symbol>()
  private readonly token = Symbol()
  private projectId: string | null = null

  async acquire(projectId: string): Promise<boolean> {
    if (FallbackLock.heldByProject.has(projectId)) return false
    if (this.projectId !== null) return false // already holding a different lock
    FallbackLock.heldByProject.set(projectId, this.token)
    this.projectId = projectId
    return true
  }
  release(): void {
    if (this.projectId) {
      FallbackLock.heldByProject.delete(this.projectId)
      this.projectId = null
    }
  }
  isHeld(projectId: string): boolean {
    return FallbackLock.heldByProject.get(projectId) === this.token
  }
  /** Clear all held locks — for test isolation only. */
  static reset(): void {
    FallbackLock.heldByProject.clear()
  }
}

class DexieProjectRepository implements ProjectRepository {
  private db!: QuilDB
  private listeners = new Map<string, Set<(status: SaveStatus) => void>>()
  private saveStatus = new Map<string, SaveStatus>()
  private flushTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private pendingOps = new Map<string, CommittedOp[]>()
  private readonly snapshotEvery: number
  private leaders = new Map<string, boolean>()
  private locks = new Map<string, FallbackLock | { release: () => void }>()
  private broadcastChannels = new Map<string, BroadcastChannel>()
  private pageVisibilityHandler: (() => void) | null = null
  private pageHideHandler: (() => void) | null = null

  constructor(snapshotEvery = SNAPSHOT_EVERY) {
    this.snapshotEvery = snapshotEvery
  }

  async init(): Promise<void> {
    this.db = new Dexie(DB_NAME) as QuilDB
    this.db.version(DB_VERSION).stores({
      projects: 'id',
      ops: '++id, projectId, seq',
      snapshots: '++id, projectId, seq',
    })
    await this.db.open()

    // Page-level: flush pending ops when the tab becomes hidden or is unloaded.
    this.pageVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        void this.flushAll()
      }
    }
    this.pageHideHandler = () => {
      void this.flushAll()
    }
    document.addEventListener('visibilitychange', this.pageVisibilityHandler)
    window.addEventListener('pagehide', this.pageHideHandler)
  }

  private status(projectId: string): SaveStatus {
    return this.saveStatus.get(projectId) ?? 'unsaved'
  }

  private setStatus(projectId: string, status: SaveStatus): void {
    this.saveStatus.set(projectId, status)
    this.listeners.get(projectId)?.forEach((cb) => cb(status))
  }

  subscribe(projectId: string, listener: (status: SaveStatus) => void): () => void {
    if (!this.listeners.has(projectId)) {
      this.listeners.set(projectId, new Set())
    }
    this.listeners.get(projectId)!.add(listener)
    return () => {
      this.listeners.get(projectId)?.delete(listener)
      if (this.listeners.get(projectId)?.size === 0) {
        this.listeners.delete(projectId)
      }
    }
  }

  getSaveStatus(projectId: string): SaveStatus {
    return this.status(projectId)
  }

  isLeader(projectId: string): boolean {
    return this.leaders.get(projectId) ?? false
  }

  close(projectId: string): void {
    this.releaseLock(projectId)
    const timer = this.flushTimers.get(projectId)
    if (timer) {
      clearTimeout(timer)
      this.flushTimers.delete(projectId)
    }
    this.pendingOps.delete(projectId)
    this.listeners.delete(projectId)
    const bc = this.broadcastChannels.get(projectId)
    if (bc) bc.close()
    this.broadcastChannels.delete(projectId)
  }

  // ── Multi-tab: Web Locks + BroadcastChannel ──────────────────────────

  private async acquireLock(projectId: string): Promise<boolean> {
    const existing = this.locks.get(projectId)
    if (existing) return this.leaders.get(projectId) ?? false

    // Try the browser Web Locks API first. Use the Lock-object form
    // (no callback) so the lock is held until we explicitly release it.
    if (typeof navigator !== 'undefined' && (navigator as any).locks) {
      try {
        const lock = await (navigator as any).locks.request(`quil-${projectId}`, {
          mode: 'exclusive',
          ifAvailable: true,
        })
        this.locks.set(projectId, { release: () => lock.release() })
        this.leaders.set(projectId, true)
        this.setupBroadcastChannel(projectId)
        return true
      } catch {
        // Lock not available or already held — fall through to fallback
      }
    }

    // Fallback: in-memory lock
    const fallback = new FallbackLock()
    const acquired = await fallback.acquire(projectId)
    this.locks.set(projectId, fallback)
    if (acquired) {
      this.leaders.set(projectId, true)
      this.setupBroadcastChannel(projectId)
    }
    return acquired
  }

  private releaseLock(projectId: string): void {
    const lock = this.locks.get(projectId)
    if (lock) {
      try {
        lock.release()
      } catch {
        // ignore
      }
      this.locks.delete(projectId)
    }
    this.leaders.set(projectId, false)
  }

  private setupBroadcastChannel(projectId: string): void {
    if (typeof BroadcastChannel === 'undefined') return
    if (this.broadcastChannels.has(projectId)) return
    const bc = new BroadcastChannel(`quil-${projectId}`)
    this.broadcastChannels.set(projectId, bc)
    bc.onmessage = (event) => {
      const { type } = event.data || {}
      if (type === 'flush' && !this.leaders.get(projectId)) {
        // Another tab flushed ops; mark unsaved so the UI can reload if needed
        this.setStatus(projectId, 'unsaved')
      }
    }
  }

  private broadcastFlush(projectId: string): void {
    const bc = this.broadcastChannels.get(projectId)
    if (bc) {
      try {
        bc.postMessage({ type: 'flush', projectId, timestamp: Date.now() })
      } catch {
        // ignore broadcast failures
      }
    }
  }

  /** Ensure this tab holds the write lock for the project. Called on load. */
  async ensureLeader(projectId: string): Promise<boolean> {
    if (this.leaders.get(projectId)) return true
    return this.acquireLock(projectId)
  }

  // ── Load ─────────────────────────────────────────────────────────────

  async load(projectId: string): Promise<ProjectState | null> {
    this.setStatus(projectId, 'saving')
    try {
      const snap = await this.db.projects.get(projectId)
      if (!snap) {
        this.setStatus(projectId, 'unsaved')
        return null
      }

      // Verify schema version — reject future schemas explicitly
      if (snap.schemaVersion > SCHEMA_VERSION) {
        const err = new PersistenceError(
          'FUTURE_SCHEMA',
          `Project schema version ${snap.schemaVersion} is newer than supported version ${SCHEMA_VERSION}`,
          'schema-version',
          projectId
        )
        this.setStatus(projectId, 'error')
        throw err
      }

      // Verify checksum of the current snapshot
      let state: ProjectState
      try {
        state = this.verifyAndDeserialize(snap)
      } catch {
        // Corrupt snapshot: fall back to the previous numbered snapshot
        state = (await this.restoreFromPreviousSnapshot(projectId, snap.rev)) as ProjectState
        if (!state) {
          const err = new PersistenceError(
            'CORRUPT_SNAPSHOT',
            'Current snapshot is corrupt and no previous snapshot exists',
            'snapshot',
            projectId
          )
          this.setStatus(projectId, 'error')
          throw err
        }
      }

      // Run migration if needed
      if (state.schemaVersion < SCHEMA_VERSION) {
        try {
          state = migrate(state, state.schemaVersion)
          // Re-serialize the migrated state as the new current snapshot
          await this.db.transaction('rw', this.db.projects, async () => {
            const serialized = serializeState(state) as Record<string, unknown>
            await this.db.projects.put({
              id: projectId,
              state: serialized,
              rev: state.rev,
              schemaVersion: state.schemaVersion,
              checksum: checksum(JSON.stringify(serialized)),
              updatedAt: Date.now(),
            } as StoredProject)
          })
        } catch {
          const err = new PersistenceError(
            'ABORTED',
            `Migration from schema ${state.schemaVersion} to ${SCHEMA_VERSION} failed`,
            'migration',
            projectId
          )
          this.setStatus(projectId, 'error')
          throw err
        }
      }

      // Replay ops newer than the snapshot (by seq, not baseRev)
      const ops = await this.db.ops
        .where('projectId')
        .equals(projectId)
        .filter((op) => op.seq > snap.rev)
        .sortBy('seq')

      let expectedRev = state.rev
      for (const op of ops) {
        if (op.baseRev !== expectedRev) {
          const err = new PersistenceError(
            'STALE_BASE',
            `Replay failed: op ${op.commandId} baseRev ${op.baseRev} != expected ${expectedRev}`,
            'replay',
            projectId
          )
          this.setStatus(projectId, 'error')
          throw err
        }
        const result = applyCommand(state, op.command)
        if (!result.ok) {
          const err = new PersistenceError(
            'ABORTED',
            `Replay failed for command ${op.commandId}: ${result.error.message}`,
            'replay',
            projectId
          )
          this.setStatus(projectId, 'error')
          throw err
        }
        state = result.state
        expectedRev = state.rev
      }

      this.setStatus(projectId, 'saved')
      return state
    } catch (err) {
      if (!(err instanceof PersistenceError)) {
        this.setStatus(projectId, 'error')
      }
      throw err
    }
  }

  private verifyAndDeserialize(snap: StoredProject): ProjectState {
    const serialized = JSON.stringify(snap.state)
    const actualChecksum = checksum(serialized)
    if (actualChecksum !== snap.checksum) {
      throw new Error('checksum mismatch')
    }
    return deserializeState(snap.state)
  }

  private async restoreFromPreviousSnapshot(
    projectId: string,
    currentRev: number
  ): Promise<ProjectState | null> {
    const prev = await this.db.snapshots
      .where('projectId')
      .equals(projectId)
      .filter((s) => s.rev < currentRev)
      .sortBy('seq')

    if (prev.length === 0) return null

    const best = prev[prev.length - 1]!
    try {
      return this.verifyAndDeserialize({
        id: projectId,
        state: best.state,
        rev: best.rev,
        schemaVersion: best.schemaVersion,
        checksum: best.checksum,
        updatedAt: best.createdAt,
      } as StoredProject)
    } catch {
      return this.restoreFromPreviousSnapshot(projectId, best.rev)
    }
  }

  // ── Append ops ───────────────────────────────────────────────────────

  async appendOps(
    projectId: string,
    ops: CommittedOp[],
    baseState?: ProjectState
  ): Promise<void> {
    if (!this.leaders.get(projectId)) {
      // Read-only tab: cannot write to persistence
      return
    }

    const pending = this.pendingOps.get(projectId) ?? []
    pending.push(...ops)
    this.pendingOps.set(projectId, pending)
    this.setStatus(projectId, 'saving')
    this.scheduleFlush(projectId)

    // If this is the first flush for this project and we have a base state,
    // write the initial snapshot immediately so subsequent flushes have a base.
    const snapExists = (await this.db.projects.get(projectId)) !== undefined
    if (!snapExists && baseState) {
      await this.writeSnapshot(projectId, baseState)
    }
  }

  private scheduleFlush(projectId: string): void {
    if (this.flushTimers.has(projectId)) return
    const timer = setTimeout(() => {
      this.flushTimers.delete(projectId)
      this.flush(projectId).catch(() => this.setStatus(projectId, 'error'))
    }, 300)
    this.flushTimers.set(projectId, timer)
  }

  private async flushAll(): Promise<void> {
    const projects = [...this.pendingOps.keys()]
    await Promise.all(projects.map((pid) => this.flush(pid)))
  }

  async flush(projectId: string): Promise<void> {
    const pending = this.pendingOps.get(projectId)
    if (!pending || pending.length === 0) return
    const batch = pending.splice(0, pending.length)

    const snap = await this.db.projects.get(projectId)
    if (!snap) {
      this.setStatus(projectId, 'error')
      throw new Error(`No project snapshot found for ${projectId}`)
    }

    // Reconstruct the state at the snapshot, then apply all pending ops
    let state: ProjectState
    try {
      state = this.verifyAndDeserialize(snap)
    } catch {
      state = (await this.restoreFromPreviousSnapshot(projectId, snap.rev)) as ProjectState
      if (!state) {
        this.setStatus(projectId, 'error')
        throw new PersistenceError(
          'CORRUPT_SNAPSHOT',
          'Cannot flush: snapshot is corrupt and no previous snapshot exists',
          'snapshot',
          projectId
        )
      }
    }

    let seq = snap.rev
    let newRev = state.rev
    const opsToStore: Array<Omit<QuilOp, 'id'>> = []
    const snapshotBoundaries: Array<{ seq: number; rev: number; serialized: Record<string, unknown> }> = []

    for (const op of batch) {
      if (op.baseRev !== newRev) {
        continue // stale base: skip rather than corrupt
      }
      const result = applyCommand(state, op.command)
      if (!result.ok) {
        continue // skip invalid ops
      }
      state = result.state
      newRev = state.rev
      seq++
      opsToStore.push({
        projectId,
        seq,
        commandId: op.commandId,
        baseRev: op.baseRev,
        command: op.command,
        timestamp: op.timestamp,
      })
      if (seq % this.snapshotEvery === 0) {
        snapshotBoundaries.push({
          seq,
          rev: newRev,
          serialized: serializeState(state) as Record<string, unknown>,
        })
      }
    }

    try {
      await this.db.transaction('rw', this.db.projects, this.db.ops, async () => {
        for (const op of opsToStore) {
          await this.db.ops.add(op)
        }

        const serialized = serializeState(state) as Record<string, unknown>
        await this.db.projects.put({
          id: projectId,
          state: serialized,
          rev: state.rev,
          schemaVersion: state.schemaVersion,
          checksum: checksum(JSON.stringify(serialized)),
          updatedAt: Date.now(),
        } as StoredProject)
      })

      // Write numbered snapshots after the transaction commits
      for (const { seq: s, rev: r, serialized: b } of snapshotBoundaries) {
        await this.db.snapshots.add({
          projectId,
          seq: s,
          state: b,
          rev: r,
          schemaVersion: state.schemaVersion,
          checksum: checksum(JSON.stringify(b)),
          createdAt: Date.now(),
        } as StoredSnapshot)
      }

      this.setStatus(projectId, 'saved')
      this.broadcastFlush(projectId)
    } catch (err) {
      this.setStatus(projectId, 'error')
      // Re-queue unflushed ops
      pending.unshift(...batch.filter((_, i) => i >= opsToStore.length))
      throw err
    }
  }

  async writeSnapshot(projectId: string, state: ProjectState): Promise<void> {
    const serialized = serializeState(state) as Record<string, unknown>
    await this.db.projects.put({
      id: projectId,
      state: serialized,
      rev: state.rev,
      schemaVersion: state.schemaVersion,
      checksum: checksum(JSON.stringify(serialized)),
      updatedAt: Date.now(),
    } as StoredProject)
    this.setStatus(projectId, 'saved')
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const projects = await this.db.projects.toArray()
    return projects
      .map((p) => ({
        id: p.id,
        name: (p.state as { name?: string }).name ?? '',
        updatedAt: p.updatedAt,
        schemaVersion: p.schemaVersion,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async delete(projectId: string): Promise<void> {
    await this.db.transaction('rw', this.db.projects, this.db.ops, this.db.snapshots, async () => {
      await this.db.projects.delete(projectId)
      await this.db.ops.where('projectId').equals(projectId).delete()
      await this.db.snapshots.where('projectId').equals(projectId).delete()
    })
    this.listeners.delete(projectId)
    const timer = this.flushTimers.get(projectId)
    if (timer) clearTimeout(timer)
    this.flushTimers.delete(projectId)
    this.pendingOps.delete(projectId)
    this.releaseLock(projectId)
  }
}

export const projectRepository = new DexieProjectRepository()
export { DexieProjectRepository, FallbackLock, DB_NAME, DB_VERSION }
export type { QuilDB }
