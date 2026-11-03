import type { ProjectState } from '../core'
import type { DesignCommand } from '../core/commands'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

/**
 * Error returned by persistence operations. Carries a machine-readable code
 * so the UI can show the right recovery action (export, retry, read-only, etc.).
 */
export class PersistenceError extends Error {
  readonly code:
    | 'QUOTA_EXCEEDED'
    | 'ABORTED'
    | 'BLOCKED'
    | 'PRIVATE_MODE'
    | 'CORRUPT_SNAPSHOT'
    | 'FUTURE_SCHEMA'
    | 'STALE_BASE'
  readonly rule: string
  readonly target: string

  constructor(
    code: PersistenceError['code'],
    message: string,
    rule: string,
    target: string
  ) {
    super(message)
    this.name = 'PersistenceError'
    this.code = code
    this.rule = rule
    this.target = target
  }
}

export interface CommittedOp {
  commandId: string
  baseRev: number
  command: DesignCommand
  timestamp: number
}

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: number
  schemaVersion: number
}

export interface ProjectRepository {
  /** Open the database. Must be called before any other method. */
  init(): Promise<void>

  /** Load project state: latest snapshot + replay of later ops. Returns null if project doesn't exist. */
  load(projectId: string): Promise<ProjectState | null>

  /** Append committed ops to the op log. baseState is written as the initial snapshot if none exists. */
  appendOps(
    projectId: string,
    ops: CommittedOp[],
    baseState?: ProjectState
  ): Promise<void>

  /** Write a full snapshot (used for periodic snapshots and initial save). */
  writeSnapshot(projectId: string, state: ProjectState): Promise<void>

  /** Force-flush any pending ops for a project (called on visibilitychange / pagehide). */
  flush(projectId: string): Promise<void>

  /** List all projects for the project picker / recovery screen. */
  listProjects(): Promise<ProjectSummary[]>

  /** Delete a project and all its ops/snapshots. */
  delete(projectId: string): Promise<void>

  /** Subscribe to save status changes for a project. */
  subscribe(projectId: string, listener: (status: SaveStatus) => void): () => void

  /** Current save status for a project. */
  getSaveStatus(projectId: string): SaveStatus

  /** True if this tab holds the write lock (leader). Other tabs are read-only. */
  isLeader(projectId: string): boolean

  /** Release the write lock and stop listening (called on tab unload). */
  close(projectId: string): void
}
