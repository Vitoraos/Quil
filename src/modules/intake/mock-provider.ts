// Mock provider for Module B/C. Returns deterministic fixtures so intake works
// without any real AI provider or network access. Used in tests and offline mode.

import { AIProvider, GeneratedPageSpec, PageSuggestion, FollowUpQuestion } from './provider'
import { parseProviderResponse } from './schemas'
import {
  pageSpecResponseSchema
} from './schemas'

const DEFAULT_BRIEF_QUESTIONS: FollowUpQuestion[] = [
  { id: 'q-tone', question: 'What tone should the site convey?', options: ['Calm & minimal', 'Bold & expressive', 'Professional & clean'], skippable: true },
  { id: 'q-audience', question: 'Who is the primary audience?', options: ['Customers', 'Partners', 'Internal team'], skippable: true },
  { id: 'q-priority', question: 'What is the highest priority?', options: ['Conversions', 'Information', 'Contact'], skippable: true }
]

const HOME_SPEC: GeneratedPageSpec = {
  name: 'Home',
  purpose: 'Landing page introducing the site',
  sections: [
    {
      key: 'hero',
      purpose: 'Hero section with headline, subtext, and call-to-action',
      elements: [
        { key: 'heading', kind: 'heading', purpose: 'Main headline', required: true },
        { key: 'text', kind: 'text', purpose: 'Supporting subtext', required: true },
        { key: 'cta', kind: 'button', purpose: 'Primary call-to-action', required: true },
        { key: 'image', kind: 'image', purpose: 'Hero background image', required: false }
      ]
    },
    {
      key: 'features',
      purpose: 'Feature highlights',
      elements: [
        { key: 'heading', kind: 'heading', purpose: 'Features heading', required: true },
        { key: 'card-1', kind: 'card', purpose: 'First feature card', required: false },
        { key: 'card-2', kind: 'card', purpose: 'Second feature card', required: false }
      ]
    },
    {
      key: 'cta-bar',
      purpose: 'Final conversion bar',
      elements: [
        { key: 'button', kind: 'button', purpose: 'Primary button', required: true }
      ]
    }
  ]
}

const ABOUT_SPEC: GeneratedPageSpec = {
  name: 'About',
  purpose: 'Background, story, and people behind the site',
  sections: [
    {
      key: 'intro',
      purpose: 'Introduction',
      elements: [
        { key: 'heading', kind: 'heading', purpose: 'About heading', required: true },
        { key: 'text', kind: 'text', purpose: 'About description', required: true }
      ]
    },
    {
      key: 'team-list',
      purpose: 'People or items to highlight',
      elements: [
        { key: 'card-1', kind: 'card', purpose: 'First profile card', required: true },
        { key: 'card-2', kind: 'card', purpose: 'Second profile card', required: true }
      ]
    }
  ]
}

export class MockProvider implements AIProvider {
  async generateFollowUpQuestions(input: { brief: string; answers: Record<string, string> }, signal?: AbortSignal): Promise<FollowUpQuestion[]> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    // Deterministic: return the same questions regardless of input
    return DEFAULT_BRIEF_QUESTIONS
  }

  async suggestPages(input: { brief: string; answers: Record<string, string> }, signal?: AbortSignal): Promise<PageSuggestion[]> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return [
      { name: 'Home', purpose: 'Landing page with hero and highlights' },
      { name: 'About', purpose: 'Background, story, and people' }
    ]
  }

  async generatePageSpec(input: { brief: string; answers: Record<string, string>; pageName: string }, signal?: AbortSignal): Promise<GeneratedPageSpec> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (input.pageName === 'About') {
      return parseProviderResponse(pageSpecResponseSchema, ABOUT_SPEC, `page-${input.pageName}`)
    }
    return parseProviderResponse(pageSpecResponseSchema, HOME_SPEC, `page-${input.pageName}`)
  }
}

export const mockProvider = new MockProvider()
