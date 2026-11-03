import { describe, expect, it } from 'vitest'
import type { ProjectState } from '../../src/core'
import { referenceProject } from '../../src/core'
import {
  SCHEMA_VERSION,
  migrate,
  backupSnapshot,
  restoreFromBackup,
  serializeStateForBackup,
} from '../../src/persistence/migration'

describe('persistence: migration', () => {
  it('reports current schema version', () => {
    expect(SCHEMA_VERSION).toBe(2)
  })

  it('migrates v1 state to v2 by adding intake/brief/specs fields', () => {
    const v1 = referenceProject() as unknown as Record<string, unknown>
    const result = migrate(v1 as never, 1)
    expect(result.schemaVersion).toBe(2)
    expect(result.brief).toBe('')
    expect(result.intakeAnswers.size).toBe(0)
    expect(result.startingPageId).toBeNull()
    expect(result.pageSpecs.size).toBe(0)
  })

  it('migrate is a no-op when already at current version', () => {
    const state = referenceProject()
    const result = migrate(state, SCHEMA_VERSION)
    expect(result).toBe(state)
  })

  it('throws on future schema version', () => {
    const state = referenceProject()
    expect(() => migrate(state, SCHEMA_VERSION + 1)).toThrow(/future schema version/)
  })

  it('backupSnapshot round-trips through JSON', () => {
    const state = referenceProject()
    const json = backupSnapshot(state)
    const restored = restoreFromBackup(json)

    expect(restored.name).toBe(state.name)
    expect(restored.rev).toBe(state.rev)
    expect(restored.nodes.size).toBe(state.nodes.size)
    expect(restored.nodes.get('el-hero-heading' as never)?.props.color).toBe('#1C1C1A')
    expect(restored.decisions.size).toBe(state.decisions.size)
    expect(restored.pages.size).toBe(state.pages.size)
  })

  it('serializeStateForBackup preserves Maps as arrays', () => {
    const state = referenceProject()
    const serialized = serializeStateForBackup(state) as Record<string, unknown>

    expect(serialized.pages).toBeInstanceOf(Array)
    expect(serialized.nodes).toBeInstanceOf(Array)
    expect(serialized.decisions).toBeInstanceOf(Array)
    expect(serialized.assets).toBeInstanceOf(Array)
    expect(Array.isArray(serialized.undoStack)).toBe(true)
  })
})
