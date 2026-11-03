import { z } from 'zod'
import { elementKinds } from './elements'
import { candidateIdSchema, commandIdSchema, elementIdSchema, pageIdSchema } from './ids'
import type { DecisionScope } from './state'
import { pageSpecSchema } from './specs'
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
      targetType: elementKindSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('global'),
      targetType: elementKindSchema
    })
    .strict()
])

export type DecisionScopeInput = z.infer<typeof decisionScopeSchema>

export const commandErrorCodes = [
  'INVALID_COMMAND',
  'STALE_BASE',
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
  'CANDIDATE_INVALID'
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
      .max(20)
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
  removeElementCommandSchema,
  moveElementCommandSchema,
  applyCandidateCommandSchema,
  undoCommandSchema,
  redoCommandSchema,
  setBriefCommandSchema,
  setIntakeAnswerCommandSchema,
  addPageCommandSchema,
  removePageCommandSchema,
  renamePageCommandSchema,
  setStartingPageCommandSchema,
  setPageSpecCommandSchema,
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
  removeElementCommandSchema,
  moveElementCommandSchema,
  applyCandidateCommandSchema,
  undoCommandSchema,
  redoCommandSchema,
  batchCommandSchema,
  setBriefCommandSchema,
  setIntakeAnswerCommandSchema,
  addPageCommandSchema,
  removePageCommandSchema,
  renamePageCommandSchema,
  setStartingPageCommandSchema,
  setPageSpecCommandSchema,
  instantiateSpecSkeletonCommandSchema
])

export type LeafCommand = z.infer<typeof leafCommandSchema>
export type DesignCommand = z.infer<typeof designCommandSchema>
export type SetPropertyCommand = z.infer<typeof setPropertyCommandSchema>
export type AddElementCommand = z.infer<typeof addElementCommandSchema>
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
