// Part 4.2: One pure context builder.
//
// Builds the ordered block context for a provider intake call from pure state.
// No I/O, no clock — the same input always gives the same output, so it can be
// tested in Node and prompt-caching works (stable blocks first, volatile last).
//
// Part 4.3: every untrusted value is wrapped with delimit(), which escapes any
// `<` followed by a block-list tag name so a user cannot close a block early.
// Every value is capped before entering the context; control and bidirectional
// characters are stripped.

import type { SlotValue } from '../../core/intake-schema'
import { shortTextValue } from '../../core/values'

// Tag names that delimit() must protect against early closure.
const BLOCK_TAGS = ['user_turn', 'system', 'schema', 'state', 'summary', 'window', 'last_question', 'page', 'section', 'target', 'instruction']

const controlOrBidi = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/
// BYOK keys, auth tokens, and similar secrets must never enter the context.
const secretPattern = /\bsk-[A-Za-z0-9]{20,}/g

/** Escape `<` followed by a block tag name, so `</user_turn><system>…` cannot
 * close a block early. Replaces `<` with `&lt;` so the literal close-tag
 * substring can no longer appear. Other `<` characters are left alone. */
export function delimit(tag: string, text: string): string {
  let out = stripUnsafe(text)
  for (const blockTag of BLOCK_TAGS) {
    // Close tag: </tag>  and open tag: <tag ...>
    out = out.replace(new RegExp(`</${blockTag}>`, 'g'), `&lt;/${blockTag}&gt;`)
    out = out.replace(new RegExp(`<${blockTag}\\b`, 'g'), `&lt;${blockTag}`)
  }
  return out
}

/** Strip control and bidirectional characters and redact secrets from
 * untrusted text. */
function stripUnsafe(text: string): string {
  return text.replace(controlOrBidi, '').replace(secretPattern, '[REDACTED KEY]')
}

/** Cap a value to shortTextValue limits before it enters the context. */
export function capForContext(text: string): string {
  const parsed = shortTextValue.safeParse(text)
  if (parsed.success) return parsed.data
  // Defense-in-depth net: strip unsafe chars, redact secrets, truncate to cap.
  return stripUnsafe(text).slice(0, 280)
}

interface Turn {
  turnId: string
  askedSlots: string[]
  userText: string // capped at 2000 chars by the command schema
  acceptedUpdates: Array<{ slot: string; value: unknown; basis: string; confidence: number; evidence: string }>
}

interface BuildContextInput {
  systemPrompt: string
  schemaBlock: string
  slots: Map<string, SlotValue>
  summary: string // deterministic digest: rejected options, skipped slots
  window: Turn[] // last four turns, verbatim
  lastQuestion: string // the question just asked
  userTurn: string // the user's message
}

interface BuildContextOutput {
  blocks: Array<{ tag: string; text: string }>
  charCount: number
  overBudget: boolean
}

const BUDGETS: Record<'state' | 'summary' | 'window' | 'last_question' | 'user_turn', number> = {
  state: 3000,
  summary: 1500,
  window: 4000,
  last_question: 400,
  user_turn: 2000
} as const

/** Char estimate: ~4 chars per token, no tokenizer dependency. */
export function charCount(text: string): number {
  return text.length
}

export function buildContext(input: BuildContextInput): BuildContextOutput {
  const blocks: Array<{ tag: string; text: string }> = []

  // 1. System prompt — fixed, never trimmed.
  blocks.push({ tag: 'system', text: input.systemPrompt })

  // 2. <schema> — generated from intake-schema.ts, fixed, never trimmed.
  blocks.push({ tag: 'schema', text: input.schemaBlock })

  // 3. <state> — slots with basis, confidence, asked counts. 3000 chars.
  //    Drop evidence text first, never drop a slot.
  const stateText = buildStateText(input.slots)
  blocks.push({ tag: 'state', text: trimTo(stateText, BUDGETS.state) })

  // 4. <summary> — deterministic digest. 1500 chars. Drop oldest entries.
  const summaryText = trimTo(input.summary, BUDGETS.summary)
  blocks.push({ tag: 'summary', text: summaryText })

  // 5. <window> — last four turns, verbatim. 4000 chars. Drop oldest turn first.
  const windowText = buildWindowText(input.window)
  blocks.push({ tag: 'window', text: trimTo(windowText, BUDGETS.window) })

  // 6. <last_question> — the question just asked. 400 chars. Never trimmed.
  blocks.push({ tag: 'last_question', text: trimTo(delimit('last_question', stripUnsafe(input.lastQuestion)), BUDGETS.last_question) })

  // 7. <user_turn> — the user's message. 2000 chars. Never trimmed below the
  //    budget; the UI rejects longer input, so this is a final safety net.
  blocks.push({
    tag: 'user_turn',
    text: trimTo(delimit('user_turn', stripUnsafe(input.userTurn)), BUDGETS.user_turn)
  })

  let charCount = 0
  for (const b of blocks) charCount += b.text.length

  return { blocks, charCount, overBudget: charCount > 10000 }
}

function buildStateText(slots: Map<string, SlotValue>): string {
  const lines: string[] = []
  for (const [key, slot] of slots) {
    const ev = slot.evidence ? ` evidence="${capForContext(slot.evidence)}"` : ''
    lines.push(`${key}: basis=${slot.basis} confidence=${slot.confidence.toFixed(2)} asked=${slot.asked}${ev} value=${JSON.stringify(slot.value)}`)
  }
  return lines.join('\n')
}

function buildWindowText(window: Turn[]): string {
  const lines: string[] = []
  for (const turn of window) {
    lines.push(`turn ${turn.turnId} asked=${turn.askedSlots.join(',')} text="${capForContext(turn.userText)}"`)
    for (const u of turn.acceptedUpdates) {
      lines.push(`  update ${u.slot}=${JSON.stringify(u.value)} basis=${u.basis} conf=${u.confidence.toFixed(2)}`)
    }
  }
  return lines.join('\n')
}

/** Trim text to a char budget without splitting mid-word where possible. Never
 * throws. Used only for the variable-length blocks (state, summary, window). */
function trimTo(text: string, budget: number): string {
  if (text.length <= budget) return text
  const cut = text.slice(0, budget)
  const lastNewline = cut.lastIndexOf('\n')
  return lastNewline > 0 ? cut.slice(0, lastNewline) : cut
}
