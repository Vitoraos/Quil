// Strict slot schema for Quil's intake turn loop. Pure — no React, DOM,
// network, or AI-provider imports. Runs in Node tests.

import { z } from 'zod'
import type { PageId } from './ids'
import { shortTextValue } from './values'

export type SlotKey = string
export type SlotBasis = 'stated' | 'inferred'
export type SlotType = 'text' | 'enum' | 'multi-enum' | 'list'

export interface SlotOption {
  value: string
  label: string
}

export interface PageChoice {
  name: string
  purpose: string
}

export interface SlotValue {
  value: unknown
  basis: SlotBasis
  confidence: number
  evidence: string
  turnId: string | null
  asked: number
  superseded: SlotValue[] // up to 3 previously stated values, never silently overwritten
}

export interface SlotDef {
  key: string
  label: string
  description: string // written for the model
  type: SlotType
  options?: SlotOption[] // enums / multi-enums
  required: boolean
  weight: number // 1 to 10
  maxItems?: number // lists
  fallbackQuestion: string // safety net when the provider fails
}

// A short piece of user-facing text, validated at context boundaries.
export const shortTextValue280 = shortTextValue

const pageChoiceSchema = z.object({
  name: shortTextValue,
  purpose: shortTextValue
}).strict()

export const slotDefs: Record<string, SlotDef> = {
  siteType: {
    key: 'siteType',
    label: 'Site type',
    description: 'What kind of site this is',
    type: 'enum',
    options: [
      { value: 'marketing', label: 'Marketing' },
      { value: 'ecommerce', label: 'E-commerce' },
      { value: 'portfolio', label: 'Portfolio' },
      { value: 'booking', label: 'Booking' },
      { value: 'saas', label: 'SaaS' },
      { value: 'blog', label: 'Blog' },
      { value: 'docs', label: 'Docs' },
      { value: 'other', label: 'Other' }
    ],
    required: true,
    weight: 10,
    fallbackQuestion: 'What kind of site are you building — for example a shop, a portfolio, or a blog?'
  },
  purpose: {
    key: 'purpose',
    label: 'Purpose',
    description: 'What the business or project does, in the user\'s words',
    type: 'text',
    required: true,
    weight: 10,
    fallbackQuestion: 'What does your business or project do?'
  },
  audience: {
    key: 'audience',
    label: 'Audience',
    description: 'Who the site is for',
    type: 'list',
    required: true,
    weight: 9,
    maxItems: 5,
    fallbackQuestion: 'Who is the site for? Name one group of people.'
  },
  primaryAction: {
    key: 'primaryAction',
    label: 'Primary action',
    description: 'The one thing a visitor should do',
    type: 'enum',
    options: [
      { value: 'purchase', label: 'Buy something' },
      { value: 'book', label: 'Book an appointment' },
      { value: 'sign-up', label: 'Sign up' },
      { value: 'contact', label: 'Contact you' },
      { value: 'donate', label: 'Donate' },
      { value: 'inform', label: 'Inform' },
      { value: 'other', label: 'Other' }
    ],
    required: true,
    weight: 9,
    fallbackQuestion: 'What is the one thing a visitor should do on the site?'
  },
  pages: {
    key: 'pages',
    label: 'Pages',
    description: 'Pages the site needs and what each is for',
    type: 'list',
    required: true,
    weight: 8,
    maxItems: 12,
    fallbackQuestion: 'Which pages does the site need? Start with one name.'
  },
  tone: {
    key: 'tone',
    label: 'Tone',
    description: 'How the site should feel',
    type: 'multi-enum',
    options: [
      { value: 'calm', label: 'Calm' },
      { value: 'bold', label: 'Bold' },
      { value: 'playful', label: 'Playful' },
      { value: 'professional', label: 'Professional' },
      { value: 'luxurious', label: 'Luxurious' },
      { value: 'warm', label: 'Warm' },
      { value: 'technical', label: 'Technical' },
      { value: 'minimal', label: 'Minimal' }
    ],
    required: true,
    weight: 7,
    maxItems: 3,
    fallbackQuestion: 'How should the site feel — calm, bold, professional, or something else?'
  },
  businessName: {
    key: 'businessName',
    label: 'Business name',
    description: 'Name to show in the header',
    type: 'text',
    required: false,
    weight: 5,
    fallbackQuestion: 'What is the name of your business or project?'
  },
  visualStyle: {
    key: 'visualStyle',
    label: 'Visual style',
    description: 'Layout density and imagery',
    type: 'multi-enum',
    options: [
      { value: 'airy', label: 'Airy' },
      { value: 'dense', label: 'Dense' },
      { value: 'photo-led', label: 'Photo-led' },
      { value: 'type-led', label: 'Type-led' },
      { value: 'illustrated', label: 'Illustrated' },
      { value: 'dark', label: 'Dark' },
      { value: 'light', label: 'Light' }
    ],
    required: false,
    weight: 5,
    maxItems: 3,
    fallbackQuestion: 'What visual style do you prefer — airy, dense, photo-led, or type-led?'
  },
  brandAssets: {
    key: 'brandAssets',
    label: 'Brand assets',
    description: 'What the user already has',
    type: 'multi-enum',
    options: [
      { value: 'logo', label: 'Logo' },
      { value: 'palette', label: 'Palette' },
      { value: 'photography', label: 'Photography' },
      { value: 'fonts', label: 'Fonts' },
      { value: 'none', label: 'None' }
    ],
    required: false,
    weight: 5,
    fallbackQuestion: 'Do you already have a logo, photos, or brand colours?'
  },
  features: {
    key: 'features',
    label: 'Features',
    description: 'Functional needs',
    type: 'multi-enum',
    options: [
      { value: 'booking', label: 'Booking' },
      { value: 'payments', label: 'Payments' },
      { value: 'forms', label: 'Forms' },
      { value: 'blog', label: 'Blog' },
      { value: 'search', label: 'Search' },
      { value: 'accounts', label: 'Accounts' },
      { value: 'cms', label: 'CMS' }
    ],
    required: false,
    weight: 4,
    maxItems: 5,
    fallbackQuestion: 'What should the site be able to do — take bookings, payments, or something else?'
  },
  contentReadiness: {
    key: 'contentReadiness',
    label: 'Content readiness',
    description: 'Whether copy and images exist',
    type: 'enum',
    options: [
      { value: 'ready', label: 'Ready' },
      { value: 'partial', label: 'Partial' },
      { value: 'none', label: 'None' }
    ],
    required: false,
    weight: 4,
    fallbackQuestion: 'Do you have the copy and images ready, or only some of them?'
  },
  constraints: {
    key: 'constraints',
    label: 'Constraints',
    description: 'Languages, accessibility, regions, compliance',
    type: 'list',
    required: false,
    weight: 3,
    maxItems: 5,
    fallbackQuestion: 'Are there languages, accessibility needs, regions, or compliance rules to plan for?'
  },
  avoid: {
    key: 'avoid',
    label: 'Avoid',
    description: 'Things the user does not want',
    type: 'list',
    required: false,
    weight: 3,
    maxItems: 5,
    fallbackQuestion: 'Is there anything you do not want on the site?'
  },
  startingPage: {
    key: 'startingPage',
    label: 'Starting page',
    description: 'Which page to design first (defaults to the first page)',
    type: 'text',
    required: false,
    weight: 2,
    fallbackQuestion: 'Which page should we design first?'
  }
} as const

export const slotKeys: string[] = Object.keys(slotDefs)

export function getSlotDef(key: string): SlotDef | undefined {
  return slotDefs[key]
}

export function slotKeysList(): string[] {
  return [...slotKeys]
}

// A stored slot value, defaulting to empty.
export function emptySlotValue(): SlotValue {
  return {
    value: undefined,
    basis: 'inferred',
    confidence: 0,
    evidence: '',
    turnId: null,
    asked: 0,
    superseded: []
  }
}

// Validate a raw value against a SlotDef. Returns the parsed value or an
// error message. Strict: unknown enum values, oversized lists, and control
// characters in text are rejected.
export function validateSlotValue(def: SlotDef, value: unknown): { ok: true; data: unknown } | { ok: false; message: string } {
  // Reject NaN / Infinity at the boundary.
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { ok: false, message: `Value for '${def.key}' must be a finite number` }
  }

  switch (def.type) {
    case 'text': {
      const maxLen = def.key === 'purpose' ? 280 : def.key === 'businessName' ? 60 : 280
      const schema = z.string().min(1).max(maxLen).refine((v) => !/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/.test(v), 'text contains control characters')
      const result = schema.safeParse(value)
      if (!result.success) {
        return { ok: false, message: result.error.issues[0]?.message ?? `Invalid text for '${def.key}'` }
      }
      return { ok: true, data: result.data }
    }
    case 'enum': {
      const allowed = new Set((def.options ?? []).map((o) => o.value))
      if (typeof value !== 'string' || !allowed.has(value)) {
        return { ok: false, message: `Value '${String(value)}' is not allowed for '${def.key}'. Allowed: ${[...allowed].join(', ')}` }
      }
      return { ok: true, data: value }
    }
    case 'multi-enum': {
      if (!Array.isArray(value)) {
        return { ok: false, message: `Value for '${def.key}' must be a list` }
      }
      const allowed = new Set((def.options ?? []).map((o) => o.value))
      const max = def.maxItems ?? 5
      if (value.length > max) {
        return { ok: false, message: `Value for '${def.key}' has ${value.length} items (max ${max})` }
      }
      for (const item of value) {
        if (typeof item !== 'string' || !allowed.has(item)) {
          return { ok: false, message: `Value '${String(item)}' is not allowed for '${def.key}'` }
        }
      }
      // No duplicates.
      if (new Set(value).size !== value.length) {
        return { ok: false, message: `Value for '${def.key}' contains duplicates` }
      }
      return { ok: true, data: [...value] }
    }
    case 'list': {
      if (!Array.isArray(value)) {
        return { ok: false, message: `Value for '${def.key}' must be a list` }
      }
      const max = def.maxItems ?? 5
      if (value.length > max) {
        return { ok: false, message: `Value for '${def.key}' has ${value.length} items (max ${max})` }
      }
      for (const item of value) {
        if (typeof item !== 'string' || item.length === 0 || item.length > 280) {
          return { ok: false, message: `Each item in '${def.key}' must be non-empty text up to 280 chars` }
        }
      }
      return { ok: true, data: [...value] }
    }
    default:
      return { ok: false, message: `Unknown slot type '${def.type}'` }
  }
}

// coverage: the required slots still missing or inferred, plus a weighted
// score (0-100). Intake is complete when every required slot is stated.
export function coverage(slots: Map<string, SlotValue>): {
  missing: string[]
  inferred: string[]
  score: number
  complete: boolean
} {
  const missing: string[] = []
  const inferred: string[] = []
  let totalWeight = 0
  let statedWeight = 0

  for (const key of slotKeys) {
    const def = slotDefs[key]!
    if (!def.required) continue
    totalWeight += def.weight
    const slot = slots.get(key)
    if (!slot || slot.basis !== 'stated') {
      missing.push(key)
    } else {
      statedWeight += def.weight
    }
    if (slot && slot.basis === 'inferred') {
      inferred.push(key)
    }
  }

  const score = totalWeight === 0 ? 100 : Math.round((statedWeight / totalWeight) * 100)
  return { missing, inferred, score, complete: missing.length === 0 }
}

export type SlotDefInput = SlotDef
