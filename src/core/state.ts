import type { Patch } from 'immer'
import type { NodeKind } from './elements'
import type { AssetId, CandidateId, CommandId, DecisionId, ElementId, FactId, PageId, ProjectId } from './ids'
import type { PageSpec } from './specs'
import type { SlotBasis, SlotValue, TurnRecord } from './intake-schema'

export interface DesignElement {
  id: ElementId
  kind: NodeKind
  pageId: PageId
  parentId: ElementId | null
  childIds: ElementId[]
  rev: number
  props: Record<string, unknown>
}

export interface Page {
  id: PageId
  name: string
  sectionIds: ElementId[]
}

export interface IntakeState {
  brief: string
  answers: Map<string, string>
  startingPageId: PageId | null
}

export type DecisionScope =
  | { kind: 'instance'; elementId: ElementId }
  | { kind: 'page'; pageId: PageId; targetType: NodeKind }
  | { kind: 'global'; targetType: NodeKind }

// ── Intake v4 (Section 7.1) ───────────────────────────────────────────────

export type IntakeScope =
  | { kind: 'project' }
  | { kind: 'page'; pageId: PageId }

export const factTopics = [
  'product', 'audience', 'goals', 'content', 'brand',
  'features', 'business', 'constraints', 'integrations', 'other'
] as const
export type FactTopic = (typeof factTopics)[number]

export interface IntakeFactVersion {
  answer: string
  basis: SlotBasis
  turnId: string | null
}

export interface IntakeFact {
  id: FactId                 // branded, e.g. fact-1 (monotonic, assigned by the reducer)
  topic: FactTopic
  question: string           // plain-words question this answers, 1..280
  answer: string             // 1..500
  basis: SlotBasis           // 'stated' | 'inferred'
  confidence: number         // 0..1
  evidence: string           // exact substring of the user turn, or 'user' for UI edits
  turnId: string | null
  superseded: IntakeFactVersion[]   // max 3
}

export interface PageIntake {
  slots: Map<string, SlotValue>
  facts: Map<FactId, IntakeFact>
}

export interface IntakeStatus {
  project: 'open' | 'confirmed'
  pages: Map<PageId, 'open' | 'confirmed'>
}

export interface DesignDecision {
  id: DecisionId
  property: string
  value: unknown
  scope: DecisionScope
  status: 'approved' | 'superseded' | 'orphaned'
  seq: number
}

export interface Asset {
  id: AssetId
  kind: 'image'
  width: number
  height: number
  alt: string
}

export interface HistoryEntry {
  commandId: CommandId
  inversePatches: Patch[]
  forwardPatches: Patch[]
  gestureKey?: string
}

export interface ProjectState {
  schemaVersion: 4
  projectId: ProjectId
  name: string
  rev: number
  pages: Map<PageId, Page>
  nodes: Map<ElementId, DesignElement>
  decisions: Map<DecisionId, DesignDecision>
  assets: Map<AssetId, Asset>
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  seenCommandIds: CommandId[]
  seenCandidateIds: CandidateId[]
  seenTurnIds: string[]
  nextDecisionSeq: number
  turnRecords: TurnRecord[]
  brief: string
  intakeAnswers: Map<string, string>
  startingPageId: PageId | null
  pageSpecs: Map<PageId, PageSpec>
  intake: Map<string, SlotValue>

  // Intake v4: dynamic facts and per-page intake replace the flat answers store.
  facts: Map<FactId, IntakeFact>                // project-level dynamic facts
  pageIntake: Map<PageId, PageIntake>          // page-level slots + facts
  intakeStatus: IntakeStatus                    // project/page confirmation status
  intakeRev: number                             // +1 on every accepted intake/fact/confirm command
  nextFactSeq: number                           // monotonic fact id sequence
}

export const bounds = {
  maxNodesPerPage: 5000,
  maxDepth: 32,
  maxTextLength: 10000,
  maxNameLength: 100,
  maxHistory: 200,
  maxSeenIds: 1024,
  maxSeenTurnIds: 1024,
  maxTurnRecords: 50,
  maxBatchSize: 100,
  maxCandidatePatches: 20,
  maxDecisions: 10000,
  maxBriefLength: 5000,
  maxPages: 50,
  maxSpecSections: 20,
  maxSpecElementsPerSection: 20,
  maxIntakeAnswers: 50,
  maxFacts: 40,
  maxFactAnswer: 500,
  maxTurnText: 2000,
  maxProjectTurns: 15,
  maxPageTurns: 8,
  maxSpecOpsPerCommand: 20,
  maxFactsPerTurn: 6
} as const

export function createProjectState(projectId: ProjectId, name: string): ProjectState {
  return {
    schemaVersion: 4,
    projectId,
    name,
    rev: 0,
    pages: new Map(),
    nodes: new Map(),
    decisions: new Map(),
    assets: new Map(),
    undoStack: [],
    redoStack: [],
    seenCommandIds: [],
    seenCandidateIds: [],
    seenTurnIds: [],
    nextDecisionSeq: 1,
    turnRecords: [],
    brief: '',
    intakeAnswers: new Map(),
    startingPageId: null,
    pageSpecs: new Map(),
    intake: new Map(),
    facts: new Map(),
    pageIntake: new Map(),
    intakeStatus: { project: 'open', pages: new Map() },
    intakeRev: 0,
    nextFactSeq: 1
  }
}
