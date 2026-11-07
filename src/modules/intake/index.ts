// Barrel exports for Module B/C (Intake + Page Specification)

export {
  AIProvider,
  FollowUpQuestion,
  PageSuggestion,
  GeneratedPageSpec,
  FollowUpInput,
  SuggestPagesInput,
  GeneratePageSpecInput,
  PlanIntakeTurnInput,
  ProviderError
} from './provider'

export {
  SlotUpdate,
  IntakeTurnOutput,
  followUpQuestionsResponseSchema,
  suggestPagesResponseSchema,
  pageSpecResponseSchema,
  slotUpdateSchema,
  intakeTurnOutputSchema,
  parseProviderResponse,
  MAX_QUESTIONS,
  MAX_PAGES,
  MAX_PARAGRAPH
} from './schemas'

export { mockProvider, MockProvider } from './mock-provider'

export { RequestLayer, requestLayer, CircuitOpenError, RequestTimeoutError, RequestTooLargeError, RequestUnavailableError } from './request-layer'

export { ByokAdapter, createByokAdapter } from './adapters/byok-adapter'

export {
  createIntakeSession,
  step,
  MAX_TURNS,
  MAX_ASKS_PER_SLOT,
  MAX_OPTIONS_PER_QUESTION,
  type IntakeSession,
  type IntakeTurnResult,
  type TurnQuestion,
} from './orchestrator'
