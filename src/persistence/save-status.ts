import type { SaveStatus } from './repository'

export interface SaveStatusStore {
  getStatus(projectId: string): SaveStatus
  setStatus(projectId: string, status: SaveStatus): void
  subscribe(projectId: string, listener: (status: SaveStatus) => void): () => void
}

export class MemorySaveStatusStore implements SaveStatusStore {
  private statuses = new Map<string, SaveStatus>()
  private listeners = new Map<string, Set<(status: SaveStatus) => void>>()

  getStatus(projectId: string): SaveStatus {
    return this.statuses.get(projectId) ?? 'unsaved'
  }

  setStatus(projectId: string, status: SaveStatus): void {
    this.statuses.set(projectId, status)
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
}

export const saveStatusStore = new MemorySaveStatusStore()
