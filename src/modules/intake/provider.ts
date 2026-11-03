// AIProvider interface for Module B (Intake) and Module C (Page Specification).
//
// The provider is treated as UNTRUSTED input: every operation returns a strict
// schema that is validated before any state is touched. No mega-prompt — each
// operation has its own schema. A mock provider returns deterministic fixtures;
// one real adapter (BYOK) sits behind the interface.

export interface FollowUpQuestion {
  id: string
  question: string
  options?: string[]
  skippable: boolean
}

export interface PageSuggestion {
  name: string
  purpose: string
}

export interface GeneratedPageSpec {
  name: string
  purpose: string
  sections: Array<{
    key: string
    purpose: string
    elements: Array<{
      key: string
      kind: 'heading' | 'text' | 'image' | 'button' | 'card' | 'navigation' | 'form'
      purpose: string
      required: boolean
    }>
  }>
}

export interface FollowUpInput {
  brief: string
  answers: Record<string, string>
}

export interface SuggestPagesInput {
  brief: string
  answers: Record<string, string>
}

export interface GeneratePageSpecInput {
  brief: string
  answers: Record<string, string>
  pageName: string
}

export interface AIProvider {
  /** Generate adaptive follow-up questions from the brief. */
  generateFollowUpQuestions(input: FollowUpInput, signal?: AbortSignal): Promise<FollowUpQuestion[]>

  /** Suggest pages from the brief + answers. */
  suggestPages(input: SuggestPagesInput, signal?: AbortSignal): Promise<PageSuggestion[]>

  /** Generate a full page spec from brief + answers for a single page. */
  generatePageSpec(input: GeneratePageSpecInput, signal?: AbortSignal): Promise<GeneratedPageSpec>
}

export class ProviderError extends Error {
  readonly code: string
  readonly rule: string
  readonly target: string
  readonly recoverable: boolean

  constructor(code: string, message: string, rule: string, target: string, recoverable = true) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.rule = rule
    this.target = target
    this.recoverable = recoverable
  }
}
