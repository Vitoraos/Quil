import { z } from 'zod'

export const ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/

const makeBrand = <B extends string>(_brand: B) => z.string().regex(ID_PATTERN, 'invalid id').brand<B>()

export const elementIdSchema = makeBrand('ElementId')
export const pageIdSchema = makeBrand('PageId')
export const decisionIdSchema = makeBrand('DecisionId')
export const assetIdSchema = makeBrand('AssetId')
export const commandIdSchema = makeBrand('CommandId')
export const candidateIdSchema = makeBrand('CandidateId')
export const projectIdSchema = makeBrand('ProjectId')
export const factIdSchema = makeBrand('FactId')

export type ElementId = z.infer<typeof elementIdSchema>
export type PageId = z.infer<typeof pageIdSchema>
export type DecisionId = z.infer<typeof decisionIdSchema>
export type AssetId = z.infer<typeof assetIdSchema>
export type CommandId = z.infer<typeof commandIdSchema>
export type CandidateId = z.infer<typeof candidateIdSchema>
export type ProjectId = z.infer<typeof projectIdSchema>
export type FactId = z.infer<typeof factIdSchema>
