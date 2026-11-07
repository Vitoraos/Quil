// Deterministic mock provider for the variant generator. Returns different
// candidates depending on the tone detected in the project brief, so the page
// choices demonstrably change the output. Used in tests and offline mode.

import type { VariantContext, VariantOutput, VariantProposal } from './schemas'
import type { VariantProvider } from './provider'
import type { DecisionId } from '../../core/ids'
import { variantOutputSchema } from './schemas'

function detectTone(brief: string): 'calm' | 'bold' | null {
  const b = brief.toLowerCase()
  if (b.includes('calm')) return 'calm'
  if (b.includes('bold')) return 'bold'
  return null
}

function heroProps(): Record<string, unknown> {
  return { bgColor: '#1C1C1A', padding: { value: 48 } }
}

function buttonProps(tone: 'calm' | 'bold'): Record<string, unknown> {
  if (tone === 'calm') {
    return { bgColor: '#F5F5F2', textColor: '#1C1C1A', radius: 8, fontWeight: 600 }
  }
  return { bgColor: '#1C1C1A', textColor: '#F5F3EC', radius: 4, fontWeight: 700 }
}

function proposal(
  componentDefId: string,
  props: Record<string, unknown>,
  explanation: string,
  uses: string[],
  deviatesFrom: DecisionId[] = []
): VariantProposal {
  return {
    componentDefId,
    props,
    explanation,
    uses,
    deviatesFrom
  }
}

export class MockProvider implements VariantProvider {
  async proposeVariants(input: { context: VariantContext; instruction: string | null; signal?: AbortSignal }): Promise<VariantOutput> {
    if (input.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const tone = detectTone(input.context.project.brief)
    const defId = input.context.target.componentDefId

    // No definition for this element -> no candidates (fail closed).
    if (!defId) {
      return { candidates: [] }
    }

    const proposals: VariantProposal[] = []

    if (defId === 'button') {
      const t = tone ?? 'calm'
      proposals.push(
        proposal(
          'button',
          buttonProps(t),
          `A ${t} button on the ${input.context.page.name} page that supports the ${input.context.target.purpose}.`,
          tone ? ['tone'] : [],
          []
        ),
        proposal(
          'button',
          t === 'calm'
            ? { bgColor: '#1C1C1A', textColor: '#F5F3EC', radius: 6, fontWeight: 600 }
            : { bgColor: '#F5F5F2', textColor: '#1C1C1A', radius: 10, fontWeight: 700 },
          `The contrasting ${t === 'calm' ? 'bold' : 'calm'} alternative for the ${input.context.section.purpose}.`,
          tone ? ['tone'] : [],
          []
        )
      )
    } else if (defId === 'hero') {
      proposals.push(
        proposal(
          'hero',
          heroProps(),
          `A hero section on the ${input.context.page.name} page that supports the ${input.context.target.purpose}.`,
          tone ? ['tone'] : [],
          []
        ),
        proposal(
          'hero',
          tone === 'calm'
            ? { bgColor: '#F5F5F2', padding: { value: 32 } }
            : { bgColor: '#1C1C1A', padding: { value: 64 } },
          `A contrasting hero background for the ${input.context.section.purpose}.`,
          tone ? ['tone'] : [],
          []
        )
      )
    }

    // If no candidates were produced for this definition, return none
    // (fail closed) rather than padded ones (rule 7 of the variant designer
    // prompt).
    if (proposals.length === 0) {
      return { candidates: [] }
    }

    const output: VariantOutput = { candidates: proposals.slice(0, 3) }
    return variantOutputSchema.parse(output)
  }
}

export const mockProvider = new MockProvider()
