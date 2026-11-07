import type { FactId, IntakeFact, IntakeStatus, PageId, PageIntake, PageSpec, ProjectState } from '../core'
import type { SlotValue, TurnRecord } from '../core/intake-schema'

// Migration version: bump whenever the ProjectState schema changes
export const SCHEMA_VERSION = 4

// Frozen fixtures from prior versions for testing migrations.
// Add a new entry whenever SCHEMA_VERSION is bumped, with a migrateOneStep
// case that upgrades from the previous version.
export const priorVersions: Record<number, ProjectState> = {}

// Serialize a ProjectState for backup (Maps -> arrays so JSON round-trips)
export function serializeStateForBackup(state: ProjectState): unknown {
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
    intake: [...state.intake.entries()],
    facts: [...state.facts.entries()],
    pageIntake: [...state.pageIntake.entries()],
    intakeStatus: state.intakeStatus,
    intakeRev: state.intakeRev,
    nextFactSeq: state.nextFactSeq,
    seenTurnIds: state.seenTurnIds,
    turnRecords: state.turnRecords,
    startingPageId: state.startingPageId,
    pageSpecs: [...state.pageSpecs.entries()],
  }
}

function deserializeStateFromBackup(data: unknown): ProjectState {
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
    intake: new Map(((d.intake as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
    facts: new Map(((d.facts as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
    pageIntake: new Map(((d.pageIntake as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
    intakeStatus: (d.intakeStatus as IntakeStatus) ?? { project: 'open', pages: new Map() },
    intakeRev: (d.intakeRev as number) ?? 0,
    nextFactSeq: (d.nextFactSeq as number) ?? 1,
    seenTurnIds: ((d.seenTurnIds as unknown[]) ?? []) as string[],
    turnRecords: ((d.turnRecords as unknown[]) ?? []) as TurnRecord[],
    startingPageId: ((d.startingPageId as string) ?? null) as PageId | null,
    pageSpecs: new Map(((d.pageSpecs as [string, unknown][]) ?? []).map(([k, v]) => [k as never, v])),
  } as ProjectState
}

export function migrate(state: ProjectState, fromVersion: number): ProjectState {
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(`Cannot migrate from future schema version ${fromVersion} to ${SCHEMA_VERSION}`)
  }

  if (fromVersion === SCHEMA_VERSION) {
    return state
  }

  let current = state
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    current = migrateOneStep(current, v, v + 1)
  }
  return current
}

function migrateOneStep(state: ProjectState, fromVersion: number, toVersion: number): ProjectState {
  if (fromVersion === 0 && toVersion === 1) {
    return migrateV0ToV1(state)
  }
  if (fromVersion === 1 && toVersion === 2) {
    return migrateV1ToV2(state)
  }
  if (fromVersion === 2 && toVersion === 3) {
    return migrateV2ToV3(state)
  }
  if (fromVersion === 3 && toVersion === 4) {
    return migrateV3ToV4(state)
  }
  return state
}

function migrateV0ToV1(state: ProjectState): ProjectState {
  return state
}

function migrateV1ToV2(state: ProjectState): ProjectState {
  const s = state as unknown as Record<string, unknown>
  return {
    ...state,
    brief: (typeof s.brief === 'string' ? s.brief : '') as string,
    intakeAnswers: ((s.intakeAnswers as Map<string, string>) ?? new Map()) as Map<string, string>,
    startingPageId: ((s.startingPageId as PageId | null) ?? null) as PageId | null,
    pageSpecs: ((s.pageSpecs as Map<PageId, unknown>) ?? new Map()) as Map<PageId, PageSpec>,
  }
}

function migrateV2ToV3(state: ProjectState): ProjectState {
  const s = state as unknown as Record<string, unknown>
  // Intermediate v3 state: migrateV3ToV4 upgrades schemaVersion to 4 next.
  return {
    ...state,
    schemaVersion: 3 as const,
    // The legacy brief and intakeAnswers are kept readable; the new slot store
    // starts empty and is populated by the intake turn loop.
    intake: ((s.intake as Map<string, unknown>) ?? new Map()) as Map<string, SlotValue>,
    seenTurnIds: ((s.seenTurnIds as unknown[]) ?? []) as string[],
    turnRecords: ((s.turnRecords as unknown[]) ?? []) as TurnRecord[]
  } as unknown as ProjectState
}

function migrateV3ToV4(state: ProjectState): ProjectState {
  return {
    ...state,
    schemaVersion: 4 as const,
    // Dynamic facts and per-page intake start empty; intake is confirmed for
    // migrated projects so they can proceed straight to picking a start page.
    facts: new Map() as Map<FactId, IntakeFact>,
    pageIntake: new Map() as Map<PageId, PageIntake>,
    intakeStatus: { project: 'confirmed', pages: new Map() } as IntakeStatus,
    intakeRev: 0,
    nextFactSeq: 1
    // Spec normalization (status/role/layout/emphasis per decision X8) is
    // completed in Phase 6 once specs.ts defines those v4 fields.
  }
}

export function backupSnapshot(state: ProjectState): string {
  return JSON.stringify(serializeStateForBackup(state))
}

export function restoreFromBackup(backup: string): ProjectState {
  return deserializeStateFromBackup(JSON.parse(backup))
}
