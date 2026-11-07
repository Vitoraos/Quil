import { z } from 'zod'
import { elementKinds, nodeKindSchema } from './elements'
import { candidateIdSchema, commandIdSchema, elementIdSchema, factIdSchema, pageIdSchema } from './ids'
import { pageSpecSchema } from './specs'
import { specOpSchema } from './spec-ops'
import { briefValue, shortTextValue } from './values'

export const elementKindSchema = z.enum([...elementKinds])

export const decisionScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('instance'), elementId: elementIdSchema })
    .strict(),
  z
    .object({
      kind: z.literal('page'),
      pageId: pageIdSchema,
      targetType: nodeKindSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('global'),
      targetType: nodeKindSchema
    })
    .strict()
])

export type DecisionScopeInput = z.infer<typeof decisionScopeSchema>

export const intakeScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('project') }).strict(),
  z.object({ kind: z.literal('page'), pageId: pageIdSchema }).strict()
])

export const commandErrorCodes = [
  'INVALID_COMMAND',
  'STALE_BASE',
  'STALE_SPEC',
  'TARGET_MISSING',
  'PARENT_MISSING',
  'PARENT_LEAF',
  'PROPERTY_UNKNOWN',
  'PROPERTY_INVALID',
  'CYCLE',
  'CROSS_PAGE_MOVE',
  'DUPLICATE_ID',
  'BOUNDS_EXCEEDED',
  'EMPTY_HISTORY',
  'EMPTY_REDO',
  'BATCH_FAILED',
  'INVARIANT_VIOLATION',
  'DECISION_ZERO_MATCH',
  'DECISION_CONFLICT',
  'DECISION_TARGET_UNKNOWN',
  'DECISION_DUPLICATE',
  'CANDIDATE_INVALID',
  'SPEC_OP_FAILED',
  'CONFLICT_NEEDS_CONFIRMATION'
] as const

export type CommandErrorCode = (typeof commandErrorCodes)[number]

export interface CommandError {
  code: CommandErrorCode
  rule: string
  target: string
  message: string
}

export const setPropertyCommandSchema = z
  .object({
    type: z.literal('set_property'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    targetId: elementIdSchema,
    property: z.string().min(1).max(64),
    value: z.unknown(),
    gestureId: z.string().min(1).max(64).optional(),
    scope: decisionScopeSchema.optional()
  })
  .strict()

export const addElementCommandSchema = z
  .object({
    type: z.literal('add_element'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    elementId: elementIdSchema,
    parentId: elementIdSchema,
    kind: z.enum([...elementKinds, 'section']),
    props: z.record(z.unknown())
  })
  .strict()

export const addSectionCommandSchema = z
  .object({
    type: z.literal('add_section'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    sectionId: elementIdSchema,
    pageId: pageIdSchema,
    props: z.record(z.unknown())
  })
  .strict()

export const removeElementCommandSchema = z
  .object({
    type: z.literal('remove_element'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    elementId: elementIdSchema
  })
  .strict()

export const moveElementCommandSchema = z
  .object({
    type: z.literal('move_element'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    elementId: elementIdSchema,
    newParentId: elementIdSchema.nullable(),
    index: z.number().int().min(0).optional()
  })
  .strict()

export const applyCandidateCommandSchema = z
  .object({
    type: z.literal('apply_candidate'),
    commandId: commandIdSchema,
    candidateId: candidateIdSchema,
    componentDefId: z.string().min(1).max(64),
    baseRev: z.number().int().nonnegative(),
    targetId: elementIdSchema,
    patches: z
      .array(
        z
          .object({
            property: z.string().min(1).max(64),
            value: z.unknown()
          })
          .strict()
      )
      .min(1)
      .max(20),
    scope: z.lazy(() => decisionScopeSchema).optional()
  })
  .strict()

export const undoCommandSchema = z
  .object({
    type: z.literal('undo'),
    commandId: commandIdSchema
  })
  .strict()

export const redoCommandSchema = z
  .object({
    type: z.literal('redo'),
    commandId: commandIdSchema
  })
  .strict()

export const setBriefCommandSchema = z
  .object({
    type: z.literal('set_brief'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    brief: briefValue
  })
  .strict()

export const setIntakeAnswerCommandSchema = z
  .object({
    type: z.literal('set_intake_answer'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    questionId: shortTextValue,
    answer: shortTextValue
  })
  .strict()

export const applyIntakeUpdateCommandSchema = z
  .object({
    type: z.literal('apply_intake_update'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    scope: z.lazy(() => intakeScopeSchema).optional(),
    updates: z
      .array(
        z
          .object({
            slot: z.string().min(1).max(64),
            value: z.unknown(),
            basis: z.enum(['stated', 'inferred']),
            confidence: z.number().min(0).max(1),
            evidence: shortTextValue
          })
          .strict()
      )
      .max(8),
    facts: z
      .array(
        z
          .object({
            id: factIdSchema,
            topic: z.string().min(1).max(64),
            question: shortTextValue,
            answer: z.string().min(1).max(500),
            basis: z.enum(['stated', 'inferred']),
            confidence: z.number().min(0).max(1),
            evidence: shortTextValue,
            turnId: shortTextValue.nullable(),
            superseded: z.array(z.unknown()).max(3)
          })
          .strict()
      )
      .max(6)
      .optional(),
    askedSlots: z.array(shortTextValue).max(12),
    asked: z
      .object({
        mode: z.enum(['model', 'fallback']),
        kind: z.literal('ask'),
        target: z.discriminatedUnion('type', [
          z.object({ type: z.literal('slot'), slots: z.array(shortTextValue).min(1).max(2) }),
          z.object({ type: z.literal('topic'), topic: z.string().min(1).max(64) })
        ]),
        question: shortTextValue,
        options: z.array(shortTextValue).max(5),
        why: shortTextValue
      })
      .strict()
      .optional(),
    turnId: shortTextValue,
    userText: z.string().max(2000)
  })
  .strict()

export const setIntakeSlotCommandSchema = z
  .object({
    type: z.literal('set_intake_slot'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    scope: z.lazy(() => intakeScopeSchema),
    slot: z.string().min(1).max(64),
    value: z.unknown()
  })
  .strict()

export const editIntakeFactCommandSchema = z
  .object({
    type: z.literal('edit_intake_fact'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    scope: z.lazy(() => intakeScopeSchema),
    factId: factIdSchema,
    answer: z.string().min(1).max(500).nullable()
  })
  .strict()

export const confirmIntakeCommandSchema = z
  .object({
    type: z.literal('confirm_intake'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    scope: z.lazy(() => intakeScopeSchema)
  })
  .strict()

export const editPageSpecCommandSchema = z
  .object({
    type: z.literal('edit_page_spec'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    pageId: pageIdSchema,
    baseSpecVersion: z.number().int().positive(),
    ops: z.array(specOpSchema).min(1).max(20),
    confirmOrphans: z.boolean().optional()
  })
  .strict()

export const approvePageSpecCommandSchema = z
  .object({
    type: z.literal('approve_page_spec'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    pageId: pageIdSchema,
    baseSpecVersion: z.number().int().positive()
  })
  .strict()

export const addPageCommandSchema = z
  .object({
    type: z.literal('add_page'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    pageId: pageIdSchema,
    name: shortTextValue
  })
  .strict()

export const removePageCommandSchema = z
  .object({
    type: z.literal('remove_page'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    pageId: pageIdSchema
  })
  .strict()

export const renamePageCommandSchema = z
  .object({
    type: z.literal('rename_page'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    pageId: pageIdSchema,
    name: shortTextValue
  })
  .strict()

export const setStartingPageCommandSchema = z
  .object({
    type: z.literal('set_starting_page'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    pageId: pageIdSchema
  })
  .strict()

export const setPageSpecCommandSchema = z
  .object({
    type: z.literal('set_page_spec'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    pageId: pageIdSchema,
    spec: pageSpecSchema
  })
  .strict()

export const instantiateSpecSkeletonCommandSchema = z
  .object({
    type: z.literal('instantiate_spec_skeleton'),
    commandId: commandIdSchema,
    baseRev: z.number().int().nonnegative(),
    pageId: pageIdSchema
  })
  .strict()

export const leafCommandSchema = z.discriminatedUnion('type', [
  setPropertyCommandSchema,
  addElementCommandSchema,
  addSectionCommandSchema,
  removeElementCommandSchema,
  moveElementCommandSchema,
  applyCandidateCommandSchema,
  undoCommandSchema,
  redoCommandSchema,
  setBriefCommandSchema,
  setIntakeAnswerCommandSchema,
  applyIntakeUpdateCommandSchema,
  setIntakeSlotCommandSchema,
  editIntakeFactCommandSchema,
  confirmIntakeCommandSchema,
  addPageCommandSchema,
  removePageCommandSchema,
  renamePageCommandSchema,
  setStartingPageCommandSchema,
  setPageSpecCommandSchema,
  editPageSpecCommandSchema,
  approvePageSpecCommandSchema,
  instantiateSpecSkeletonCommandSchema
])

export const batchCommandSchema = z
  .object({
    type: z.literal('batch'),
    commandId: commandIdSchema,
    commands: z.array(leafCommandSchema).min(1).max(100)
  })
  .strict()

export const designCommandSchema = z.discriminatedUnion('type', [
  setPropertyCommandSchema,
  addElementCommandSchema,
  addSectionCommandSchema,
  removeElementCommandSchema,
  moveElementCommandSchema,
  applyCandidateCommandSchema,
  undoCommandSchema,
  redoCommandSchema,
  batchCommandSchema,
  setBriefCommandSchema,
  setIntakeAnswerCommandSchema,
  applyIntakeUpdateCommandSchema,
  setIntakeSlotCommandSchema,
  editIntakeFactCommandSchema,
  confirmIntakeCommandSchema,
  addPageCommandSchema,
  removePageCommandSchema,
  renamePageCommandSchema,
  setStartingPageCommandSchema,
  setPageSpecCommandSchema,
  editPageSpecCommandSchema,
  approvePageSpecCommandSchema,
  instantiateSpecSkeletonCommandSchema
])

export type LeafCommand = z.infer<typeof leafCommandSchema>
export type DesignCommand = z.infer<typeof designCommandSchema>
export type SetPropertyCommand = z.infer<typeof setPropertyCommandSchema>
export type AddElementCommand = z.infer<typeof addElementCommandSchema>
export type AddSectionCommand = z.infer<typeof addSectionCommandSchema>
export type RemoveElementCommand = z.infer<typeof removeElementCommandSchema>
export type MoveElementCommand = z.infer<typeof moveElementCommandSchema>
export type ApplyCandidateCommand = z.infer<typeof applyCandidateCommandSchema>
export type UndoCommand = z.infer<typeof undoCommandSchema>
export type RedoCommand = z.infer<typeof redoCommandSchema>
export type BatchCommand = z.infer<typeof batchCommandSchema>
export type SetBriefCommand = z.infer<typeof setBriefCommandSchema>
export type SetIntakeAnswerCommand = z.infer<typeof setIntakeAnswerCommandSchema>
export type AddPageCommand = z.infer<typeof addPageCommandSchema>
export type RemovePageCommand = z.infer<typeof removePageCommandSchema>
export type RenamePageCommand = z.infer<typeof renamePageCommandSchema>
export type SetStartingPageCommand = z.infer<typeof setStartingPageCommandSchema>
export type SetPageSpecCommand = z.infer<typeof setPageSpecCommandSchema>
export type InstantiateSpecSkeletonCommand = z.infer<typeof instantiateSpecSkeletonCommandSchema>
export type ApplyIntakeUpdateCommand = z.infer<typeof applyIntakeUpdateCommandSchema>
export type SetIntakeSlotCommand = z.infer<typeof setIntakeSlotCommandSchema>
export type EditIntakeFactCommand = z.infer<typeof editIntakeFactCommandSchema>
export type ConfirmIntakeCommand = z.infer<typeof confirmIntakeCommandSchema>
export type EditPageSpecCommand = z.infer<typeof editPageSpecCommandSchema>
export type ApprovePageSpecCommand = z.infer<typeof approvePageSpecCommandSchema>
