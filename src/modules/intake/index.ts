// Barrel exports for Module B/C (Intake + Page Specification)

export {
  AIProvider,
  FollowUpQuestion,
  PageSuggestion,
  GeneratedPageSpec,
  FollowUpInput,
  SuggestPagesInput,
  GeneratePageSpecInput,
  ProviderError
} from './provider'

export {
  followUpQuestionsResponseSchema,
  suggestPagesResponseSchema,
  pageSpecResponseSchema,
  parseProviderResponse,
  MAX_QUESTIONS,
  MAX_PAGES,
  MAX_PARAGRAPH
} from './schemas'

export { mockProvider, MockProvider } from './mock-provider'

export { RequestLayer, requestLayer, CircuitOpenError, RequestTimeoutError, RequestTooLargeError, RequestUnavailableError } from './request-layer'

export { ByokAdapter, createByokAdapter } from './adapters/byok-adapter'
