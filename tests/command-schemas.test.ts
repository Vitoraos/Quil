import { describe, expect, it } from 'vitest'
import {
  applyIntakeUpdateCommandSchema,
  setIntakeSlotCommandSchema,
  editIntakeFactCommandSchema,
  confirmIntakeCommandSchema,
  setPageSpecCommandSchema,
  editPageSpecCommandSchema,
  approvePageSpecCommandSchema,
  instantiateSpecSkeletonCommandSchema,
  applyCandidateCommandSchema,
  leafCommandSchema,
  designCommandSchema
} from '../src/core/commands'
import { commandIdSchema, factIdSchema, pageIdSchema } from '../src/core/ids'
import { pageSpecSchema } from '../src/core/specs'
import type { IntakeScope } from '../src/core/state'
import type { AskedQuestion } from '../src/core/intake-schema'
import type { SpecOp } from '../src/core/spec-ops'

function validCmdId(): string {
  return commandIdSchema.parse('cmd-test-1')
}

function validPageId(): string {
  return pageIdSchema.parse('page-home')
}

function validFactId(): string {
  return factIdSchema.parse('fact-1')
}

function validSpec(): unknown {
  return pageSpecSchema.parse({
    pageId: 'page-home',
    name: 'Home',
    purpose: 'Landing page',
    version: 1,
    sections: [
      {
        key: 'hero',
        purpose: 'Hero section',
        role: 'content' as never,
        goal: 'Test goal',
        elements: [
          { key: 'heading', kind: 'heading', purpose: 'Main heading', required: true }
        ]
      }
    ]
  })
}

function validAskedQuestion(): AskedQuestion {
  return {
    mode: 'model',
    kind: 'ask',
    target: { type: 'slot', slots: ['purpose'] },
    question: 'What is your site for?',
    options: [],
    why: 'To scope the design'
  }
}

function validIntakeScope(kind: 'project' | 'page' = 'project'): IntakeScope {
  if (kind === 'project') return { kind: 'project' }
  return { kind: 'page', pageId: 'page-home' as never }
}

describe('Phase 3 — command schemas (adversarial & negative first)', () => {
  describe('apply_intake_update (changed)', () => {
    it('accepts a valid project-scoped intake update', () => {
      const result = applyIntakeUpdateCommandSchema.safeParse({
        type: 'apply_intake_update',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope('project'),
        updates: [],
        facts: [],
        askedSlots: [],
        asked: validAskedQuestion(),
        turnId: 'turn-1',
        userText: 'I want a marketing site'
      })
      expect(result.success).toBe(true)
    })

    it('accepts without scope (defaults to project)', () => {
      const result = applyIntakeUpdateCommandSchema.safeParse({
        type: 'apply_intake_update',
        commandId: validCmdId(),
        baseRev: 0,
        updates: [],
        facts: [],
        askedSlots: [],
        turnId: 'turn-1',
        userText: 'hello'
      })
      expect(result.success).toBe(true)
    })

    it('rejects extra unknown keys (strict)', () => {
      const result = applyIntakeUpdateCommandSchema.safeParse({
        type: 'apply_intake_update',
        commandId: validCmdId(),
        baseRev: 0,
        updates: [],
        facts: [],
        askedSlots: [],
        turnId: 'turn-1',
        userText: 'hello',
        bogus: 'nope'
      })
      expect(result.success).toBe(false)
    })

    it('rejects more than maxFactsPerTurn (6) facts', () => {
      const facts = Array.from({ length: 7 }, (_, i) => ({
        id: `fact-${i}` as never,
        topic: 'product' as const,
        question: 'Q?',
        answer: 'A',
        basis: 'stated' as const,
        confidence: 1,
        evidence: 'A',
        turnId: 't-1',
        superseded: []
      }))
      const result = applyIntakeUpdateCommandSchema.safeParse({
        type: 'apply_intake_update',
        commandId: validCmdId(),
        baseRev: 0,
        updates: [],
        facts,
        askedSlots: [],
        turnId: 'turn-1',
        userText: 'hello'
      })
      expect(result.success).toBe(false)
    })

    it('rejects userText over 2000 chars', () => {
      const result = applyIntakeUpdateCommandSchema.safeParse({
        type: 'apply_intake_update',
        commandId: validCmdId(),
        baseRev: 0,
        updates: [],
        facts: [],
        askedSlots: [],
        turnId: 'turn-1',
        userText: 'x'.repeat(2001)
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid asked question shape', () => {
      const result = applyIntakeUpdateCommandSchema.safeParse({
        type: 'apply_intake_update',
        commandId: validCmdId(),
        baseRev: 0,
        updates: [],
        facts: [],
        askedSlots: [],
        asked: { mode: 'model', kind: 'ask', target: 'not-an-object' } as never,
        turnId: 'turn-1',
        userText: 'hello'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('set_intake_slot (new)', () => {
    it('accepts a valid project-scoped slot set', () => {
      const result = setIntakeSlotCommandSchema.safeParse({
        type: 'set_intake_slot',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope('project'),
        slot: 'purpose',
        value: 'Sell widgets'
      })
      expect(result.success).toBe(true)
    })

    it('accepts a page-scoped slot set', () => {
      const result = setIntakeSlotCommandSchema.safeParse({
        type: 'set_intake_slot',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope('page'),
        slot: 'visitorIntent',
        value: 'Shoppers'
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty slot key', () => {
      const result = setIntakeSlotCommandSchema.safeParse({
        type: 'set_intake_slot',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope(),
        slot: '',
        value: 'x'
      })
      expect(result.success).toBe(false)
    })

    it('rejects extra unknown keys (strict)', () => {
      const result = setIntakeSlotCommandSchema.safeParse({
        type: 'set_intake_slot',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope(),
        slot: 'purpose',
        value: 'x',
        bogus: true
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing scope', () => {
      const result = setIntakeSlotCommandSchema.safeParse({
        type: 'set_intake_slot',
        commandId: validCmdId(),
        baseRev: 0,
        slot: 'purpose',
        value: 'x'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('edit_intake_fact (new)', () => {
    it('accepts editing a fact with a new answer', () => {
      const result = editIntakeFactCommandSchema.safeParse({
        type: 'edit_intake_fact',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope(),
        factId: validFactId(),
        answer: 'Updated answer'
      })
      expect(result.success).toBe(true)
    })

    it('accepts deleting a fact (answer null)', () => {
      const result = editIntakeFactCommandSchema.safeParse({
        type: 'edit_intake_fact',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope(),
        factId: validFactId(),
        answer: null
      })
      expect(result.success).toBe(true)
    })

    it('rejects answer over 500 chars', () => {
      const result = editIntakeFactCommandSchema.safeParse({
        type: 'edit_intake_fact',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope(),
        factId: validFactId(),
        answer: 'x'.repeat(501)
      })
      expect(result.success).toBe(false)
    })

    it('rejects extra unknown keys (strict)', () => {
      const result = editIntakeFactCommandSchema.safeParse({
        type: 'edit_intake_fact',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope(),
        factId: validFactId(),
        answer: 'x',
        bogus: 1
      })
      expect(result.success).toBe(false)
    })
  })

  describe('confirm_intake (new)', () => {
    it('accepts project-scoped confirmation', () => {
      const result = confirmIntakeCommandSchema.safeParse({
        type: 'confirm_intake',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope('project')
      })
      expect(result.success).toBe(true)
    })

    it('accepts page-scoped confirmation', () => {
      const result = confirmIntakeCommandSchema.safeParse({
        type: 'confirm_intake',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope('page')
      })
      expect(result.success).toBe(true)
    })

    it('rejects extra unknown keys (strict)', () => {
      const result = confirmIntakeCommandSchema.safeParse({
        type: 'confirm_intake',
        commandId: validCmdId(),
        baseRev: 0,
        scope: validIntakeScope(),
        force: true
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing scope', () => {
      const result = confirmIntakeCommandSchema.safeParse({
        type: 'confirm_intake',
        commandId: validCmdId(),
        baseRev: 0
      })
      expect(result.success).toBe(false)
    })
  })

  describe('set_page_spec (unchanged schema)', () => {
    it('accepts a valid provider-shaped spec', () => {
      const result = setPageSpecCommandSchema.safeParse({
        type: 'set_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        spec: validSpec()
      })
      expect(result.success).toBe(true)
    })

    it('rejects extra unknown keys (strict)', () => {
      const result = setPageSpecCommandSchema.safeParse({
        type: 'set_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        spec: validSpec(),
        bogus: 'no'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('edit_page_spec (new)', () => {
    function validOp(): SpecOp {
      return {
        op: 'update_section',
        key: 'hero',
        patch: { purpose: 'Updated hero' }
      }
    }

    it('accepts a valid edit with one op', () => {
      const result = editPageSpecCommandSchema.safeParse({
        type: 'edit_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        baseSpecVersion: 1,
        ops: [validOp()]
      })
      expect(result.success).toBe(true)
    })

    it('accepts up to maxSpecOpsPerCommand (20) ops', () => {
      const ops = Array.from({ length: 20 }, () => validOp())
      const result = editPageSpecCommandSchema.safeParse({
        type: 'edit_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        baseSpecVersion: 1,
        ops
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty ops array', () => {
      const result = editPageSpecCommandSchema.safeParse({
        type: 'edit_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        baseSpecVersion: 1,
        ops: []
      })
      expect(result.success).toBe(false)
    })

    it('rejects more than 20 ops', () => {
      const ops = Array.from({ length: 21 }, () => validOp())
      const result = editPageSpecCommandSchema.safeParse({
        type: 'edit_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        baseSpecVersion: 1,
        ops
      })
      expect(result.success).toBe(false)
    })

    it('accepts confirmOrphans true', () => {
      const result = editPageSpecCommandSchema.safeParse({
        type: 'edit_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        baseSpecVersion: 1,
        ops: [validOp()],
        confirmOrphans: true
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing baseSpecVersion', () => {
      const result = editPageSpecCommandSchema.safeParse({
        type: 'edit_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        ops: [validOp()]
      })
      expect(result.success).toBe(false)
    })

    it('rejects extra unknown keys (strict)', () => {
      const result = editPageSpecCommandSchema.safeParse({
        type: 'edit_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        baseSpecVersion: 1,
        ops: [validOp()],
        bogus: 'no'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('approve_page_spec (new)', () => {
    it('accepts a valid approval', () => {
      const result = approvePageSpecCommandSchema.safeParse({
        type: 'approve_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        baseSpecVersion: 1
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing baseSpecVersion', () => {
      const result = approvePageSpecCommandSchema.safeParse({
        type: 'approve_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId()
      })
      expect(result.success).toBe(false)
    })

    it('rejects extra unknown keys (strict)', () => {
      const result = approvePageSpecCommandSchema.safeParse({
        type: 'approve_page_spec',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId(),
        baseSpecVersion: 1,
        force: true
      })
      expect(result.success).toBe(false)
    })
  })

  describe('instantiate_spec_skeleton (unchanged schema)', () => {
    it('accepts a valid skeleton instantiation', () => {
      const result = instantiateSpecSkeletonCommandSchema.safeParse({
        type: 'instantiate_spec_skeleton',
        commandId: validCmdId(),
        baseRev: 0,
        pageId: validPageId()
      })
      expect(result.success).toBe(true)
    })
  })

  describe('apply_candidate (changed: adds scope)', () => {
    it('accepts without scope (defaults to instance)', () => {
      const result = applyCandidateCommandSchema.safeParse({
        type: 'apply_candidate',
        commandId: validCmdId(),
        candidateId: 'cand-1' as never,
        componentDefId: 'button',
        baseRev: 0,
        targetId: 'el-hero-cta' as never,
        patches: [{ property: 'bgColor', value: '#F5F5F2' }]
      })
      expect(result.success).toBe(true)
    })

    it('accepts with explicit instance scope', () => {
      const result = applyCandidateCommandSchema.safeParse({
        type: 'apply_candidate',
        commandId: validCmdId(),
        candidateId: 'cand-1' as never,
        componentDefId: 'button',
        baseRev: 0,
        targetId: 'el-hero-cta' as never,
        patches: [{ property: 'bgColor', value: '#F5F5F2' }],
        scope: { kind: 'instance', elementId: 'el-hero-cta' as never }
      })
      expect(result.success).toBe(true)
    })

    it('rejects extra unknown keys (strict)', () => {
      const result = applyCandidateCommandSchema.safeParse({
        type: 'apply_candidate',
        commandId: validCmdId(),
        candidateId: 'cand-1' as never,
        componentDefId: 'button',
        baseRev: 0,
        targetId: 'el-hero-cta' as never,
        patches: [{ property: 'bgColor', value: '#F5F5F2' }],
        bogus: 'no'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('union membership (leafCommandSchema / designCommandSchema)', () => {
    it('includes all new intake commands in leafCommandSchema', () => {
      const cmds = [
        { type: 'set_intake_slot', commandId: validCmdId(), baseRev: 0, scope: validIntakeScope(), slot: 'purpose', value: 'x' },
        { type: 'edit_intake_fact', commandId: validCmdId(), baseRev: 0, scope: validIntakeScope(), factId: validFactId(), answer: 'x' },
        { type: 'confirm_intake', commandId: validCmdId(), baseRev: 0, scope: validIntakeScope() },
        { type: 'edit_page_spec', commandId: validCmdId(), baseRev: 0, pageId: validPageId(), baseSpecVersion: 1, ops: [{ op: 'update_section', key: 'hero', patch: { purpose: 'Updated hero' } }] },
        { type: 'approve_page_spec', commandId: validCmdId(), baseRev: 0, pageId: validPageId(), baseSpecVersion: 1 }
      ]
      for (const cmd of cmds) {
        const result = leafCommandSchema.safeParse(cmd)
        expect(result.success, `${cmd.type} should be in leafCommandSchema`).toBe(true)
      }
    })

    it('includes all new intake commands in designCommandSchema', () => {
      const cmds = [
        { type: 'set_intake_slot', commandId: validCmdId(), baseRev: 0, scope: validIntakeScope(), slot: 'purpose', value: 'x' },
        { type: 'edit_intake_fact', commandId: validCmdId(), baseRev: 0, scope: validIntakeScope(), factId: validFactId(), answer: 'x' },
        { type: 'confirm_intake', commandId: validCmdId(), baseRev: 0, scope: validIntakeScope() },
        { type: 'edit_page_spec', commandId: validCmdId(), baseRev: 0, pageId: validPageId(), baseSpecVersion: 1, ops: [{ op: 'update_section', key: 'hero', patch: { purpose: 'Updated hero' } }] },
        { type: 'approve_page_spec', commandId: validCmdId(), baseRev: 0, pageId: validPageId(), baseSpecVersion: 1 }
      ]
      for (const cmd of cmds) {
        const result = designCommandSchema.safeParse(cmd)
        expect(result.success, `${cmd.type} should be in designCommandSchema`).toBe(true)
      }
    })
  })
})
