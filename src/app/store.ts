import type { ApplyResult, ProjectState } from '../core'
import { applyCommand } from '../core/apply'
import { projectRepository } from '../persistence'

export class QuilStore {
  private state: ProjectState
  private listeners = new Set<() => void>()
  private pendingOps: Array<{ commandId: string; baseRev: number; command: any; timestamp: number }> = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private initialized = false
  private initialSnapshotWritten = false

  constructor(initialState: ProjectState) {
    this.state = initialState
  }

  async init(): Promise<void> {
    await projectRepository.init()
    // Try to become the write leader for this project (multi-tab safety).
    await projectRepository.ensureLeader(this.state.projectId)
    // Restore saved work. Only write the in-memory project when there is nothing
    // to restore, so a fresh session never overwrites an existing project.
    const saved = await projectRepository.load(this.state.projectId)
    if (saved) {
      this.state = saved
      this.listeners.forEach((cb) => cb())
    } else {
      await projectRepository.writeSnapshot(this.state.projectId, this.state)
    }
    this.initialSnapshotWritten = true
    this.initialized = true
  }

  getState(): ProjectState {
    return this.state
  }

  getSnapshot(): ProjectState {
    return this.state
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  /** True if this tab holds the write lock (leader). Read-only otherwise. */
  isLeader(): boolean {
    return projectRepository.isLeader(this.state.projectId)
  }

  /** Current save status for this project. */
  getSaveStatus(): 'saved' | 'saving' | 'unsaved' | 'error' {
    return projectRepository.getSaveStatus(this.state.projectId)
  }

  /** Subscribe to save-status changes. */
  onSaveStatus(listener: (status: 'saved' | 'saving' | 'unsaved' | 'error') => void): () => void {
    return projectRepository.subscribe(this.state.projectId, listener)
  }

  /** Dispatch one command through the single command bus. Returns ApplyResult. */
  dispatch(command: unknown): ApplyResult {
    const result = applyCommand(this.state, command)
    if (!result.ok) {
      return result
    }

    const committedCommand = command as { commandId: string; baseRev: number }
    this.pendingOps.push({
      commandId: committedCommand.commandId,
      baseRev: committedCommand.baseRev,
      command,
      timestamp: Date.now(),
    })
    this.scheduleFlush()

    this.state = result.state
    this.listeners.forEach((cb) => cb())
    return result
  }

  getElement(id: string) {
    return this.state.nodes.get(id as never)
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush()
    }, 300)
  }

  private async flush(): Promise<void> {
    const pending = this.pendingOps.splice(0, this.pendingOps.length)
    if (pending.length === 0) return

    try {
      // Pass baseState only on the very first flush (before init wrote the snapshot)
      await projectRepository.appendOps(
        this.state.projectId,
        pending,
        this.initialSnapshotWritten ? undefined : this.state
      )
      this.initialSnapshotWritten = true
    } catch (err) {
      console.error('Persistence flush failed:', err)
      this.pendingOps.unshift(...pending)
    }
  }
}
