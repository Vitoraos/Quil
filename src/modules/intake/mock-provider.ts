// Mock provider for Module B (Intake). Deterministic, rule-based extractor so
// intake works without any real AI provider or network. Used in tests and
// offline mode. Also exercises the fallback path: when it cannot determine a
// useful next question it returns the slot's fallbackQuestion.

import type { AIProvider, GeneratedPageSpec, PlanIntakeTurnInput } from './provider'
import type { IntakeTurnOutput, SlotUpdate } from './schemas'
import {
  intakeTurnOutputSchema,
  parseProviderResponse
} from './schemas'
import {
  coverage,
  emptySlotValue,
  getSlotDef,
  slotKeys,
  type SlotDef,
  type SlotValue
} from '../../core/intake-schema'

const SLOT_KEYWORDS = {
  siteType: ['ecommerce', 'shop', 'store', 'portfolio', 'booking', 'saas', 'blog', 'docs', 'marketing', 'other'],
  primaryAction: ['purchase', 'buy', 'book', 'appointment', 'sign-up', 'signup', 'contact', 'donate', 'inform'],
  tone: ['calm', 'bold', 'playful', 'professional', 'luxurious', 'warm', 'technical', 'minimal'],
  visualStyle: ['airy', 'dense', 'photo-led', 'photography', 'type-led', 'typography', 'illustrated', 'dark', 'light'],
  brandAssets: ['logo', 'palette', 'colours', 'colors', 'fonts', 'photography', 'none'],
  features: ['booking', 'payments', 'payments', 'forms', 'blog', 'search', 'accounts', 'cms'],
  contentReadiness: ['ready', 'partial', 'none'],
  businessName: ['called', 'name is', 'named'],
  startingPage: ['start', 'first', 'homepage', 'home']
} as const

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

const SPLIT_RX = /\s*(?:,|;|\b(?:and|or)\b)\s*/i

function splitList(text: string): string[] {
  return text.split(SPLIT_RX).map((s) => s.trim()).filter(Boolean)
}

function isSubstring(haystack: string, needle: string): boolean {
  const h = normalize(haystack)
  const n = normalize(needle)
  return h.includes(n) && n.length > 0
}

function capText(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  if (v.length === 0 || v.length > max) return undefined
  if (/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/.test(v)) return undefined
  return v
}

function parseList(value: unknown, max: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return undefined
    const t = item.trim()
    if (t.length === 0 || t.length > 280) return undefined
    out.push(t)
  }
  if (out.length === 0 || out.length > max) return undefined
  return out
}

function enumValue(def: SlotDef, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const allowed = new Set((def.options ?? []).map((o) => o.value))
  return allowed.has(value) ? value : undefined
}

function extractMultiEnum(def: SlotDef, userTurn: string, values: unknown): string[] | undefined {
  const list = parseList(values, def.maxItems ?? 5)
  if (!list) return undefined
  const allowed = new Set((def.options ?? []).map((o) => o.value))
  const norm = normalize(userTurn)
  const picked: string[] = []
  for (const item of list) {
    if (!allowed.has(item)) return undefined
    if (!norm.includes(item.toLowerCase())) return undefined
    picked.push(item)
  }
  if (picked.length === 0) return undefined
  return picked
}

function buildUpdate(
  def: SlotDef,
  value: unknown,
  basis: SlotValue['basis'],
  confidence: number,
  evidence: string
): SlotUpdate | null {
  const checked = def.type === 'text'
    ? capText(value, def.key === 'purpose' ? 280 : def.key === 'businessName' ? 60 : 280)
    : def.type === 'enum'
      ? enumValue(def, value)
      : def.type === 'multi-enum'
        ? extractMultiEnum(def, evidence, value)
        : parseList(value, def.maxItems ?? 5)
  if (checked === undefined) return null
  if (!isSubstring(evidence, evidence)) return null
  return {
    slot: def.key,
    value: checked,
    basis,
    confidence,
    evidence: capText(evidence, 280) ?? ''
  }
}

// Extremely small deterministic extractor. Each slot is matched by keyword
// presence in the user's turn. Basis is "stated" because the user supplied it.
function extractUpdates(
  userTurn: string,
  slots: Record<string, SlotValue>
): SlotUpdate[] {
  const norm = normalize(userTurn)
  const updates: SlotUpdate[] = []

  for (const key of slotKeys) {
    const existing = slots[key]
    if (existing && existing.basis === 'stated') continue
    const def = getSlotDef(key)!
    let value: unknown = undefined
    let evidence = ''
    let confidence = 1

    switch (key) {
      case 'siteType': {
        const match = SLOT_KEYWORDS.siteType.find((k) => norm.includes(k))
        if (match) { value = match; evidence = match; }
        break
      }
      case 'purpose': {
        value = userTurn.slice(0, 280)
        evidence = userTurn
        break
      }
      case 'audience': {
        const parts = splitList(userTurn)
        if (parts.length > 0) { value = parts.slice(0, 5); evidence = parts.join(', '); }
        break
      }
      case 'primaryAction': {
        const match = SLOT_KEYWORDS.primaryAction.find((k) => norm.includes(k))
        if (match) { value = match; evidence = match; }
        break
      }
      case 'pages': {
        const names = userTurn.match(/"([^"]+)"/g)?.map((m) => m.slice(1, -1))
        if (names && names.length > 0) { value = names.slice(0, 12); evidence = names.join(', '); }
        break
      }
      case 'tone': {
        const found = SLOT_KEYWORDS.tone.filter((k) => norm.includes(k)).slice(0, 3)
        if (found.length > 0) { value = found; evidence = found.join(', '); }
        break
      }
      case 'businessName': {
        const m = userTurn.match(/(?:called|name is|named)\s+([A-Za-z0-9 '&-]+)/i)
        if (m) { value = m[1]!.trim(); evidence = m[1]!.trim(); confidence = 0.8 }
        break
      }
      case 'visualStyle': {
        const found = SLOT_KEYWORDS.visualStyle.filter((k) => norm.includes(k)).slice(0, 3)
        if (found.length > 0) { value = found; evidence = found.join(', '); }
        break
      }
      case 'brandAssets': {
        const found = SLOT_KEYWORDS.brandAssets.filter((k) => norm.includes(k)).slice(0, 5)
        if (found.length > 0) { value = found; evidence = found.join(', '); }
        break
      }
      case 'features': {
        const found = SLOT_KEYWORDS.features.filter((k) => norm.includes(k)).slice(0, 5)
        if (found.length > 0) { value = found; evidence = found.join(', '); }
        break
      }
      case 'contentReadiness': {
        const match = SLOT_KEYWORDS.contentReadiness.find((k) => norm.includes(k))
        if (match) { value = match; evidence = match; }
        break
      }
      case 'constraints': {
        const parts = splitList(userTurn)
        if (parts.length > 0) { value = parts.slice(0, 5); evidence = parts.join(', '); }
        break
      }
      case 'avoid': {
        const parts = splitList(userTurn)
        if (parts.length > 0) { value = parts.slice(0, 5); evidence = parts.join(', '); }
        break
      }
      case 'startingPage': {
        const m = userTurn.match(/(?:start|first)\s+(?:with\s+)?(?:page\s+)?("([^"]+)"|([A-Za-z0-9 &-]+))/i)
        if (m) { value = (m[2] ?? m[3] ?? '').trim(); evidence = m[0]; confidence = 0.7 }
        break
      }
    }

    if (value === undefined) continue
    const upd = buildUpdate(def, value, 'stated', confidence, evidence)
    if (upd) updates.push(upd)
  }

  return updates.slice(0, 8)
}

function nextQuestion(
  slots: Record<string, SlotValue>,
  _lastQuestion: string | undefined
): IntakeTurnOutput['next'] {
  const map = new Map<string, SlotValue>()
  for (const [k, v] of Object.entries(slots)) map.set(k, v)
  const cov = coverage(map)

  // All required stated -> done (the application double-checks).
  if (cov.complete) {
    return { kind: 'done' }
  }

  // All required have a value but some are only inferred -> confirm.
  if (cov.missing.length === 0 && cov.inferred.length > 0) {
    return { kind: 'confirm', slots: cov.inferred }
  }

  // Ask about the highest-weight gap: missing slots first, then inferred.
  const gaps = [...cov.missing, ...cov.inferred]
  const askSlots = gaps.slice(0, 2)
  if (askSlots.length === 0) return { kind: 'done' }

  const def = getSlotDef(askSlots[0]!)!
  const question = def.fallbackQuestion
  const options = def.type === 'enum' || def.type === 'multi-enum' ? (def.options ?? []).slice(0, 5).map((o) => o.label) : undefined

  return {
    kind: 'ask',
    slots: askSlots,
    question,
    options,
    why: `This helps shape the ${def.label.toLowerCase()} of your site.`
  }
}

export class MockProvider implements AIProvider {
  async generateFollowUpQuestions(input: { brief: string; answers: Record<string, string> }, signal?: AbortSignal): Promise<{ id: string; question: string; options?: string[]; skippable: boolean }[]> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return []
  }

  async suggestPages(input: { brief: string; answers: Record<string, string> }, signal?: AbortSignal): Promise<{ name: string; purpose: string }[]> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return [
      { name: 'Home', purpose: 'Landing page with hero and highlights' },
      { name: 'About', purpose: 'Background, story, and people' }
    ]
  }

  async generatePageSpec(input: { brief: string; answers: Record<string, string>; pageName: string }, signal?: AbortSignal): Promise<GeneratedPageSpec> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return {
      name: input.pageName,
      purpose: `The ${input.pageName} page`,
      sections: []
    }
  }

  async planIntakeTurn(input: PlanIntakeTurnInput, signal?: AbortSignal): Promise<IntakeTurnOutput> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const slots: Record<string, SlotValue> = {}
    for (const key of slotKeys) {
      const raw = input.state[key]
      slots[key] = raw && typeof raw === 'object' && 'basis' in raw ? (raw as SlotValue) : emptySlotValue()
    }

    const updates = extractUpdates(input.userTurn, slots)

    // Build next state after applying updates to choose the question.
    const nextState: Record<string, SlotValue> = { ...slots }
    for (const u of updates) {
      nextState[u.slot] = {
        value: u.value,
        basis: u.basis,
        confidence: u.confidence,
        evidence: u.evidence,
        turnId: null,
        asked: (slots[u.slot]?.asked ?? 0) + 1,
        superseded: []
      }
    }

    const next = nextQuestion(nextState, input.lastQuestion)

    const output: IntakeTurnOutput = { updates, next }
    return parseProviderResponse(intakeTurnOutputSchema, output, 'plan-intake-turn')
  }
}

export const mockProvider = new MockProvider()
