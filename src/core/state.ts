import type { Patch } from 'immer'
import type { ElementKind, NodeKind } from './elements'
import type { AssetId, CandidateId, CommandId, DecisionId, ElementId, PageId, ProjectId } from './ids'
import type { PageSpec } from './specs'

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
  | { kind: 'page'; pageId: PageId; targetType: ElementKind }
  | { kind: 'global'; targetType: ElementKind }

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
  schemaVersion: 2
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
  nextDecisionSeq: number
  brief: string
  intakeAnswers: Map<string, string>
  startingPageId: PageId | null
  pageSpecs: Map<PageId, PageSpec>
}

export const bounds = {
  maxNodesPerPage: 5000,
  maxDepth: 32,
  maxTextLength: 10000,
  maxNameLength: 100,
  maxHistory: 200,
  maxSeenIds: 1024,
  maxBatchSize: 100,
  maxCandidatePatches: 20,
  maxDecisions: 10000,
  maxBriefLength: 5000,
  maxPages: 50,
  maxSpecSections: 20,
  maxSpecElementsPerSection: 20,
  maxIntakeAnswers: 50
} as const

export function createProjectState(projectId: ProjectId, name: string): ProjectState {
  return {
    schemaVersion: 2,
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
    nextDecisionSeq: 1,
    brief: '',
    intakeAnswers: new Map(),
    startingPageId: null,
    pageSpecs: new Map()
  }
}
