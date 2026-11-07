// Intake turn-loop orchestrator (Part 3.3). Pure application logic — no React,
// DOM, network, or AI-provider imports beyond the provider interface. Runs in
// Node tests.
//
// The orchestrator owns the schema, validation, and stopping rule. The model
// owns only the wording and order. Each turn: extract facts into slots, pick
// the single most valuable gap, commit one apply_intake_update command through
// the command bus.

import type { AIProvider, PlanIntakeTurnInput } from './provider'
import type { IntakeTurnOutput } from './schemas'
import { intakeTurnOutputSchema } from './schemas'
import {
  coverage,
  emptySlotValue,
  getSlotDef,
  type SlotValue,
  type TurnRecord,
  validateSlotValue,
} from '../../core/intake-schema'
import {
  applyIntakeUpdateCommandSchema,
  type ApplyIntakeUpdateCommand,
} from '../../core/commands'
import { buildContext, capForContext } from './context'
import { buildSystemPrompt, buildSchemaBlock } from './prompts'

// ── Hard bounds (Part 3.5) ──────────────────────────────────────────────────

export const MAX_TURNS = 12
export const MAX_ASKS_PER_SLOT = 2
export const MAX_OPTIONS_PER_QUESTION = 5
export const MAX_UPDATES_PER_TURN = 8

// ── Session state ───────────────────────────────────────────────────────────

export interface IntakeSession {
  turnIdCounter: number
  slots: Map<string, SlotValue>
  summary: string
  lastQuestion: string
  turnRecords: TurnRecord[]
  complete: boolean
}

export function createIntakeSession(): IntakeSession {
  return {
    turnIdCounter: 0,
    slots: new Map(),
    summary: '',
    lastQuestion: '',
    turnRecords: [],
    complete: false,
  }
}

// ── Turn result ─────────────────────────────────────────────────────────────

export type TurnQuestion = {
  kind: 'ask' | 'confirm'
  slots: string[]
  question: string
  options: string[]
  why: string
}

export interface IntakeTurnResult {
  session: IntakeSession
  command?: ApplyIntakeUpdateCommand
  question?: TurnQuestion
  done: boolean
  error?: string
}

// ── Normalization helpers ───────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isSubstring(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle))
}

// ── Model input builder (Part 4 context) ────────────────────────────────────

function buildModelInput(session: IntakeSession, userTurn: string): PlanIntakeTurnInput {
  const schemaBlock = buildSchemaBlock()
  const systemPrompt = buildSystemPrompt(schemaBlock)

  const _context = buildContext({
    systemPrompt,
    schemaBlock,
    slots: session.slots,
    summary: session.summary,
    window: session.turnRecords,
    lastQuestion: session.lastQuestion,
    userTurn,
  })

  return {
    schema: schemaBlock,
    state: Object.fromEntries(
      [...session.slots.entries()].map(([k, v]) => [k, { ...v }])
    ),
    summary: session.summary,
    lastQuestion: session.lastQuestion,
    userTurn: capForContext(userTurn),
  }
}

// ── Application-side validation (Part 3.5) ──────────────────────────────────

function validateTurn(
  output: unknown,
  userTurn: string,
  session: IntakeSession
): { ok: true; data: { updates: IntakeTurnOutput['updates']; next: IntakeTurnOutput['next'] } } | { ok: false; error: string } {
  // 1. Strict envelope parse.
  const envelope = intakeTurnOutputSchema.safeParse(output)
  if (!envelope.success) {
    return {
      ok: false,
      error: `Invalid envelope: ${envelope.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    }
  }
  const data = envelope.data

  // 2. Every slot in allowlist, value parses against SlotDef.
  const updates: IntakeTurnOutput['updates'] = []
  const seenSlots = new Set<string>()
  for (const u of data.updates) {
    const def = getSlotDef(u.slot)
    if (!def) {
      return { ok: false, error: `Unknown intake slot '${u.slot}'` }
    }
    if (seenSlots.has(u.slot)) {
      return { ok: false, error: `Duplicate slot '${u.slot}' in updates` }
    }
    seenSlots.add(u.slot)

    const checked = validateSlotValue(def, u.value)
    if (!checked.ok) {
      return { ok: false, error: `Invalid value for '${u.slot}': ${checked.message}` }
    }

    // 3. Evidence must be a substring of the user's message (normalized).
    if (!u.evidence || !isSubstring(userTurn, u.evidence)) {
      return { ok: false, error: `Evidence for '${u.slot}' is not a substring of the user's message` }
    }

    updates.push(u)
  }

  // 4. next.slots: no slot whose basis is already stated, no slot asked twice.
  const nextSlots = data.next.kind === 'ask' ? data.next.slots : []
  for (const s of nextSlots) {
    const slot = session.slots.get(s)
    if (slot && slot.basis === 'stated') {
      return { ok: false, error: `Cannot ask about already-stated slot '${s}'` }
    }
    if (slot && slot.asked >= MAX_ASKS_PER_SLOT) {
      return { ok: false, error: `Slot '${s}' already asked ${MAX_ASKS_PER_SLOT} times` }
    }
  }

  // 5. done accepted only if coverage says every required slot is stated.
  if (data.next.kind === 'done') {
    const cov = coverage(session.slots)
    if (!cov.complete) {
      // Replace with best remaining gap using fallbackQuestion (3.5).
      const gap = [...cov.missing, ...cov.inferred][0]
      if (!gap) {
        return { ok: false, error: 'done with missing required slots and no gap found' }
      }
      const def = getSlotDef(gap)!
      return {
        ok: true,
        data: {
          updates,
          next: {
            kind: 'ask',
            slots: [gap],
            question: def.fallbackQuestion,
            options: def.type === 'enum' || def.type === 'multi-enum'
              ? (def.options ?? []).slice(0, MAX_OPTIONS_PER_QUESTION).map((o) => o.label)
              : undefined,
            why: `This helps shape the ${def.label.toLowerCase()} of your site.`,
          },
        },
      }
    }
  }

  return { ok: true, data: { updates, next: data.next } }
}

// ── Command building ────────────────────────────────────────────────────────

function buildCommand(
  session: IntakeSession,
  updates: IntakeTurnOutput['updates'],
  askedSlots: string[],
  userText: string
): ApplyIntakeUpdateCommand {
  const turnId = `turn-${++session.turnIdCounter}`
  return applyIntakeUpdateCommandSchema.parse({
    type: 'apply_intake_update',
    commandId: `cmd-intake-${turnId}` as never,
    baseRev: 0, // filled in by caller against store.getState().rev
    turnId,
    updates,
    askedSlots,
    userText: capForContext(userText),
  })
}

// ── Summary builder ─────────────────────────────────────────────────────────

function buildSummary(session: IntakeSession): string {
  const parts: string[] = []
  for (const [key, slot] of session.slots) {
    if (slot.value !== undefined) {
      parts.push(`${key}=${JSON.stringify(slot.value)} (${slot.basis})`)
    }
  }
  return parts.join('; ')
}

// ── Main step ───────────────────────────────────────────────────────────────

export async function step(
  session: IntakeSession,
  userTurn: string,
  provider: AIProvider,
  baseRev: number,
  signal?: AbortSignal
): Promise<IntakeTurnResult> {
  // Bound: max turns.
  if (session.turnIdCounter >= MAX_TURNS) {
    return { session, done: true, error: 'Maximum turns reached' }
  }

  const input = buildModelInput(session, userTurn)

  // One provider call with deadline + AbortController (Part 3.3).
  let output: IntakeTurnOutput | undefined = undefined
  let lastError: string | null = null
  for (let attempts = 0; attempts < 2; attempts++) {
    try {
      output = await provider.planIntakeTurn(input, signal)
      break
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      // Retry once with only an error code (3.3): on the second attempt we
      // fall through to the fallback path below.
    }
  }

  if (!output) {
    // Provider failed twice -> use fallback question for the best gap.
    const gap = coverage(session.slots).missing[0] ?? coverage(session.slots).inferred[0]
    if (!gap) {
      return { session, done: true }
    }
    const def = getSlotDef(gap)!
    const nextSession: IntakeSession = {
      ...session,
      summary: buildSummary(session),
      lastQuestion: def.fallbackQuestion,
    }
    return {
      session: nextSession,
      question: {
        kind: 'ask',
        slots: [gap],
        question: def.fallbackQuestion,
        options:
          (def.type === 'enum' || def.type === 'multi-enum'
            ? (def.options ?? []).slice(0, MAX_OPTIONS_PER_QUESTION).map((o) => o.label)
            : undefined) ?? [],
      why: `This helps shape the ${def.label.toLowerCase()} of your site.`,
    },
    done: false,
    error: lastError ?? 'Provider unavailable',
    }
  }

  // Validate (3.5).
  const validation = validateTurn(output, userTurn, session)
  if (validation.ok) {
    const { updates, next } = validation.data

    // Determine askedSlots: slots the model asked about (from next.slots if ask).
    const askedSlots: string[] = next.kind === 'ask' ? [...next.slots] : []

    // Build command with baseRev filled in by caller.
    const command = buildCommand(session, updates, askedSlots, userTurn)
    command.baseRev = baseRev

    // Apply updates to session slots (optimistic; command re-validates on bus).
    const nextSlotsMap = new Map(session.slots)
    for (const u of updates) {
      const existing = nextSlotsMap.get(u.slot) ?? emptySlotValue()
      const nextSlot: SlotValue = {
        value: u.value,
        basis: u.basis,
        confidence: u.confidence,
        evidence: u.evidence,
        turnId: command.turnId,
        asked: existing.asked,
        superseded: [...existing.superseded],
      }
      // Never silently overwrite a stated value: keep up to three superseded.
      if (existing.basis === 'stated' && u.basis === 'stated' && existing.value !== undefined) {
        const sup = [...existing.superseded, existing]
        nextSlot.superseded = sup.slice(-3)
      }
      nextSlotsMap.set(u.slot, nextSlot)
    }
    // Increment asked counts for slots just asked.
    for (const s of askedSlots) {
      const slot = nextSlotsMap.get(s)
      if (slot) {
        slot.asked = Math.min(slot.asked + 1, MAX_ASKS_PER_SLOT)
      } else {
        nextSlotsMap.set(s, { ...emptySlotValue(), asked: 1 })
      }
    }

    const turnRecord: TurnRecord = {
      turnId: command.turnId,
      askedSlots: [...askedSlots],
      userText: capForContext(userTurn),
      acceptedUpdates: updates.map((u) => ({
        slot: u.slot,
        value: u.value,
        basis: u.basis,
        confidence: u.confidence,
        evidence: u.evidence,
      })),
      scope: 'project'
    }
    const nextTurnRecords = [...session.turnRecords, turnRecord].slice(-50)

    const cov = coverage(nextSlotsMap)
    const nextSession: IntakeSession = {
      turnIdCounter: session.turnIdCounter,
      slots: nextSlotsMap,
      summary: buildSummary({ ...session, slots: nextSlotsMap }),
      lastQuestion:
        next.kind === 'done'
          ? ''
          : next.kind === 'confirm'
            ? `Confirm: ${next.slots.join(', ')}`
            : next.question,
      turnRecords: nextTurnRecords,
      complete: cov.complete,
    }

    const result: IntakeTurnResult = { session: nextSession, command, done: false }
    if (next.kind === 'done') {
      result.done = true
    } else if (next.kind === 'confirm') {
      result.question = {
        kind: 'confirm',
        slots: next.slots,
        question: `Please confirm: ${next.slots.join(', ')}`,
        options: [],
        why: 'These values were inferred — check them before we finish.',
      }
    } else {
      result.question = {
        kind: 'ask',
        slots: next.slots,
        question: next.question,
        options: next.options ?? [],
        why: next.why,
      }
    }

    return result
  }

  // Validation failed: retry once with only an error code, then fallback question.
  const gap = coverage(session.slots).missing[0] ?? coverage(session.slots).inferred[0]
  if (!gap) {
    return { session, done: true, error: validation.error }
  }
  const def = getSlotDef(gap)!
  const nextSession: IntakeSession = {
    ...session,
    summary: buildSummary(session),
    lastQuestion: def.fallbackQuestion,
  }
  return {
    session: nextSession,
    question: {
      kind: 'ask',
      slots: [gap],
      question: def.fallbackQuestion,
      options:
          (def.type === 'enum' || def.type === 'multi-enum'
            ? (def.options ?? []).slice(0, MAX_OPTIONS_PER_QUESTION).map((o) => o.label)
            : undefined) ?? [],
      why: `This helps shape the ${def.label.toLowerCase()} of your site.`,
    },
    done: false,
    error: validation.error,
  }
}
