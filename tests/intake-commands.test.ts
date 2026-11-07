import { describe, expect, it } from 'vitest'
import { applyCommand, createProjectState, referenceProject, validateProject } from '../src/core'
import type { PageId } from '../src/core/ids'
import { pageSpecSchema } from '../src/core/specs'

function ok<T extends { ok: boolean }>(r: T): T & { ok: true } {
  if (!r.ok) throw new Error((r as unknown as { error: { message: string } }).error.message)
  return r as T & { ok: true }
}

function validSpec(pageId: PageId) {
  return pageSpecSchema.parse({
    pageId,
    name: 'Home',
    purpose: 'Landing page',
    version: 1,
    sections: [
      { key: 'hero', purpose: 'Hero', role: 'content' as never, goal: 'Test goal', elements: [{ key: 'h1', kind: 'heading', purpose: 'H1', required: true }] }
    ]
  })
}

describe('Phase 4 — intake & spec command reducers', () => {
  describe('set_intake_slot (project scope)', () => {
    it('sets basis stated and evidence user', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const res = ok(
        applyCommand(s0, {
          type: 'set_intake_slot',
          commandId: 'cmd-slot-1',
          baseRev: 0,
          scope: { kind: 'project' },
          slot: 'purpose',
          value: 'Sell widgets'
        })
      )
      const slot = res.state.intake.get('purpose')!
      expect(slot.basis).toBe('stated')
      expect(slot.evidence).toBe('user')
      expect(slot.value).toBe('Sell widgets')
      expect(validateProject(res.state)).toEqual([])
    })

    it('keeps up to 3 superseded when stated replaces stated', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const r1 = ok(
        applyCommand(s0, {
          type: 'set_intake_slot',
          commandId: 'cmd-slot-a',
          baseRev: 0,
          scope: { kind: 'project' },
          slot: 'purpose',
          value: 'First'
        })
      )
      const r2 = ok(
        applyCommand(r1.state, {
          type: 'set_intake_slot',
          commandId: 'cmd-slot-b',
          baseRev: r1.state.rev,
          scope: { kind: 'project' },
          slot: 'purpose',
          value: 'Second'
        })
      )
      const slot = r2.state.intake.get('purpose')!
      expect(slot.superseded).toHaveLength(1)
      expect(slot.superseded[0]!.value).toBe('First')
      expect(slot.superseded[0]!.basis).toBe('stated')
    })

    it('does not supersede when replacing inferred with stated', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const r1 = ok(
        applyCommand(s0, {
          type: 'apply_intake_update',
          commandId: 'cmd-update-inf',
          baseRev: 0,
          scope: { kind: 'project' },
          updates: [{ slot: 'purpose', value: 'Inferred value', basis: 'inferred', confidence: 0.5, evidence: 'user text' }],
          facts: [],
          askedSlots: [],
          turnId: 'turn-inf',
          userText: 'user text'
        })
      )
      const slotBefore = r1.state.intake.get('purpose')!
      expect(slotBefore.basis).toBe('inferred')
      const r2 = ok(
        applyCommand(r1.state, {
          type: 'set_intake_slot',
          commandId: 'cmd-slot-stated',
          baseRev: r1.state.rev,
          scope: { kind: 'project' },
          slot: 'purpose',
          value: 'Stated value'
        })
      )
      const slotAfter = r2.state.intake.get('purpose')!
      expect(slotAfter.basis).toBe('stated')
      expect(slotAfter.superseded).toHaveLength(0)
    })

    it('rejects unknown slot', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const res = applyCommand(s0, {
        type: 'set_intake_slot',
        commandId: 'cmd-slot-bad',
        baseRev: 0,
        scope: { kind: 'project' },
        slot: 'not-a-real-slot',
        value: 'x'
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('PROPERTY_UNKNOWN')
    })

    it('rejects invalid slot value', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const res = applyCommand(s0, {
        type: 'set_intake_slot',
        commandId: 'cmd-slot-bad-val',
        baseRev: 0,
        scope: { kind: 'project' },
        slot: 'siteType',
        value: 'not-a-real-type'
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('PROPERTY_INVALID')
    })
  })

  describe('edit_intake_fact', () => {
    it('creates a stated fact with evidence user', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const res = ok(
        applyCommand(s0, {
          type: 'edit_intake_fact',
          commandId: 'cmd-fact-1',
          baseRev: 0,
          scope: { kind: 'project' },
          factId: 'fact-1' as never,
          answer: 'It sells widgets.'
        })
      )
      const fact = res.state.facts.get('fact-1' as never)!
      expect(fact.answer).toBe('It sells widgets.')
      expect(fact.basis).toBe('stated')
      expect(fact.evidence).toBe('user')
      expect(fact.confidence).toBe(1)
      expect(fact.turnId).toBeNull()
      expect(fact.superseded).toHaveLength(0)
    })

    it('null answer deletes the fact', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const created = ok(
        applyCommand(s0, {
          type: 'edit_intake_fact',
          commandId: 'cmd-fact-create',
          baseRev: 0,
          scope: { kind: 'project' },
          factId: 'fact-1' as never,
          answer: 'Original'
        })
      )
      const deleted = ok(
        applyCommand(created.state, {
          type: 'edit_intake_fact',
          commandId: 'cmd-fact-delete',
          baseRev: created.state.rev,
          scope: { kind: 'project' },
          factId: 'fact-1' as never,
          answer: null
        })
      )
      expect(deleted.state.facts.has('fact-1' as never)).toBe(false)
    })

    it('editing an existing fact keeps superseded versions (max 3)', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      let state = s0
      for (let i = 1; i <= 4; i++) {
        const r = ok(
          applyCommand(state, {
            type: 'edit_intake_fact',
            commandId: `cmd-fact-${i}`,
            baseRev: state.rev,
            scope: { kind: 'project' },
            factId: 'fact-1' as never,
            answer: `Version ${i}`
          })
        )
        state = r.state
      }
      const fact = state.facts.get('fact-1' as never)!
      expect(fact.answer).toBe('Version 4')
      expect(fact.superseded).toHaveLength(3)
    })

    it('rejects empty answer', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const res = applyCommand(s0, {
        type: 'edit_intake_fact',
        commandId: 'cmd-fact-empty',
        baseRev: 0,
        scope: { kind: 'project' },
        factId: 'fact-1' as never,
        answer: ''
      })
      expect(res.ok).toBe(false)
    })
  })

  describe('confirm_intake', () => {
    it('confirms project intake when canContinue', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const r1 = ok(
        applyCommand(s0, {
          type: 'set_intake_slot',
          commandId: 'cmd-conf-purpose',
          baseRev: 0,
          scope: { kind: 'project' },
          slot: 'purpose',
          value: 'Sell widgets'
        })
      )
      const r2 = ok(
        applyCommand(r1.state, {
          type: 'set_intake_slot',
          commandId: 'cmd-conf-pages',
          baseRev: r1.state.rev,
          scope: { kind: 'project' },
          slot: 'pages',
          value: [{ name: 'Home', purpose: 'Landing' }]
        })
      )
      const res = ok(
        applyCommand(r2.state, {
          type: 'confirm_intake',
          commandId: 'cmd-confirm-project',
          baseRev: r2.state.rev,
          scope: { kind: 'project' }
        })
      )
      expect(res.state.intakeStatus.project).toBe('confirmed')
      expect(res.state.intakeRev).toBeGreaterThan(0)
    })

    it('rejects confirm when purpose not stated', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const res = applyCommand(s0, {
        type: 'confirm_intake',
        commandId: 'cmd-confirm-no-purpose',
        baseRev: 0,
        scope: { kind: 'project' }
      })
      expect(res.ok).toBe(false)
    })

    it('rejects confirm when pages empty', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const r1 = ok(
        applyCommand(s0, {
          type: 'set_intake_slot',
          commandId: 'cmd-conf-pages-only',
          baseRev: 0,
          scope: { kind: 'project' },
          slot: 'purpose',
          value: 'Sell widgets'
        })
      )
      const res = applyCommand(r1.state, {
        type: 'confirm_intake',
        commandId: 'cmd-confirm-no-pages',
        baseRev: r1.state.rev,
        scope: { kind: 'project' }
      })
      expect(res.ok).toBe(false)
    })

    it('is idempotent — confirming twice gives same status', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const r1 = ok(
        applyCommand(s0, {
          type: 'set_intake_slot',
          commandId: 'cmd-ide-purpose',
          baseRev: 0,
          scope: { kind: 'project' },
          slot: 'purpose',
          value: 'Sell widgets'
        })
      )
      const r2 = ok(
        applyCommand(r1.state, {
          type: 'set_intake_slot',
          commandId: 'cmd-ide-pages',
          baseRev: r1.state.rev,
          scope: { kind: 'project' },
          slot: 'pages',
          value: [{ name: 'Home', purpose: 'Landing' }]
        })
      )
      const c1 = ok(
        applyCommand(r2.state, {
          type: 'confirm_intake',
          commandId: 'cmd-confirm-idem',
          baseRev: r2.state.rev,
          scope: { kind: 'project' }
        })
      )
      const c2 = ok(
        applyCommand(c1.state, {
          type: 'confirm_intake',
          commandId: 'cmd-confirm-idem',
          baseRev: c1.state.rev,
          scope: { kind: 'project' }
        })
      )
      expect(c2.state.intakeStatus.project).toBe('confirmed')
    })

    it('page scope confirms when page purpose stated', () => {
      const s0 = ok(
        applyCommand(createProjectState('proj-x' as never, 'X'), {
          type: 'add_page',
          commandId: 'cmd-add-page-home',
          baseRev: 0,
          pageId: 'page-home' as PageId,
          name: 'Home'
        })
      )
      const rev = s0.state.rev
      const res = applyCommand(s0.state, {
        type: 'confirm_intake',
        commandId: 'cmd-confirm-page',
        baseRev: rev,
        scope: { kind: 'page', pageId: 'page-home' as PageId }
      })
      expect(res.ok).toBe(false)
      const r1 = ok(
        applyCommand(s0.state, {
          type: 'set_intake_slot',
          commandId: 'cmd-page-purpose',
          baseRev: rev,
          scope: { kind: 'page', pageId: 'page-home' as PageId },
          slot: 'purpose',
          value: 'Home page purpose'
        })
      )
      const res2 = ok(
        applyCommand(r1.state, {
          type: 'confirm_intake',
          commandId: 'cmd-confirm-page-2',
          baseRev: r1.state.rev,
          scope: { kind: 'page', pageId: 'page-home' as PageId }
        })
      )
      expect(res2.state.intakeStatus.pages.get('page-home' as PageId)).toBe('confirmed')
    })
  })

  describe('apply_intake_update (changed: scope + facts)', () => {
    it('records TurnRecord with project scope', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const res = ok(
        applyCommand(s0, {
          type: 'apply_intake_update',
          commandId: 'cmd-turn-scope',
          baseRev: 0,
          scope: { kind: 'project' },
          updates: [],
          facts: [],
          askedSlots: [],
          turnId: 'turn-scope-1',
          userText: 'hello'
        })
      )
      const rec = res.state.turnRecords[0]!
      expect(rec.scope).toBe('project')
      expect(res.state.turnRecords.length).toBe(1)
    })

    it('idempotent on turnId — replay leaves state unchanged', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const r1 = ok(
        applyCommand(s0, {
          type: 'apply_intake_update',
          commandId: 'cmd-turn-idem',
          baseRev: 0,
          scope: { kind: 'project' },
          updates: [{ slot: 'purpose', value: 'Sell widgets', basis: 'stated', confidence: 1, evidence: 'user text' }],
          facts: [],
          askedSlots: [],
          turnId: 'turn-idem-1',
          userText: 'hello'
        })
      )
      const r2 = ok(
        applyCommand(r1.state, {
          type: 'apply_intake_update',
          commandId: 'cmd-turn-idem',
          baseRev: r1.state.rev,
          scope: { kind: 'project' },
          updates: [{ slot: 'purpose', value: 'Different', basis: 'stated', confidence: 1, evidence: 'user text' }],
          facts: [],
          askedSlots: [],
          turnId: 'turn-idem-1',
          userText: 'hello'
        })
      )
      expect(r2.state.intake.get('purpose')!.value).toBe('Sell widgets')
      expect(r2.state.turnRecords.length).toBe(1)    })

    it('records a TurnRecord even when updates and facts are empty', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const res = ok(
        applyCommand(s0, {
          type: 'apply_intake_update',
          commandId: 'cmd-turn-empty',
          baseRev: 0,
          scope: { kind: 'project' },
          updates: [],
          facts: [],
          askedSlots: [],
          turnId: 'turn-empty-1',
          userText: 'just talking'
        })
      )
      expect(res.state.turnRecords.length).toBe(1)
      expect(res.state.turnRecords[0]!.userText).toBe('just talking')
      expect(res.state.intakeRev).toBe(1)
    })

    it('accepts facts (max 6)', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const facts = Array.from({ length: 6 }, (_, i) => ({
        id: `fact-${i + 1}` as never,
        topic: 'product' as const,
        question: `Q${i}?`,
        answer: `A${i}`,
        basis: 'stated' as const,
        confidence: 1,
        evidence: 'facts',
        turnId: 'turn-facts',
        superseded: []
      }))
      const res = ok(
        applyCommand(s0, {
          type: 'apply_intake_update',
          commandId: 'cmd-turn-facts',
          baseRev: 0,
          scope: { kind: 'project' },
          updates: [],
          facts,
          askedSlots: [],
          turnId: 'turn-facts',
          userText: 'facts'
        })
      )
      expect(res.state.facts.size).toBe(6)
      expect(res.state.intakeRev).toBe(1)
    })

    it('rejects more than 6 facts in one turn', () => {
      const s0 = createProjectState('proj-x' as never, 'X')
      const facts = Array.from({ length: 7 }, (_, i) => ({
        id: `fact-${i + 1}` as never,
        topic: 'product' as const,
        question: `Q${i}?`,
        answer: `A${i}`,
        basis: 'stated' as const,
        confidence: 1,
        evidence: `A${i}`,
        turnId: 'turn-facts-many',
        superseded: []
      }))
      const res = applyCommand(s0, {
        type: 'apply_intake_update',
        commandId: 'cmd-turn-facts-many',
        baseRev: 0,
        scope: { kind: 'project' },
        updates: [],
        facts,
        askedSlots: [],
        turnId: 'turn-facts-many',
        userText: 'facts'
      })
      expect(res.ok).toBe(false)
    })
  })

  describe('edit_page_spec (new)', () => {
    it('applies spec ops atomically', () => {
      const s0 = referenceProject()
      const spec = validSpec('page-home' as PageId)
      const setRes = ok(
        applyCommand(s0, {
          type: 'set_page_spec',
          commandId: 'cmd-set-spec',
          baseRev: s0.rev,
          pageId: 'page-home' as PageId,
          spec
        })
      )
      const editRes = ok(
        applyCommand(setRes.state, {
          type: 'edit_page_spec',
          commandId: 'cmd-edit-spec',
          baseRev: setRes.state.rev,
          pageId: 'page-home' as PageId,
          baseSpecVersion: 1,
          ops: [{ op: 'update_section', key: 'hero', patch: { purpose: 'New hero purpose' } }]
        })
      )
      const updatedSpec = editRes.state.pageSpecs.get('page-home' as PageId)!
      const hero = updatedSpec.sections.find((s) => s.key === 'hero')!
      expect(hero.purpose).toBe('New hero purpose')
      expect(validateProject(editRes.state)).toEqual([])
    })

    it('STALE_SPEC when baseSpecVersion differs', () => {
      const s0 = referenceProject()
      const spec = validSpec('page-home' as PageId)
      const setRes = ok(
        applyCommand(s0, {
          type: 'set_page_spec',
          commandId: 'cmd-set-spec-stale',
          baseRev: s0.rev,
          pageId: 'page-home' as PageId,
          spec
        })
      )
      const res = applyCommand(setRes.state, {
        type: 'edit_page_spec',
        commandId: 'cmd-edit-stale',
        baseRev: setRes.state.rev,
        pageId: 'page-home' as PageId,
        baseSpecVersion: 999,
        ops: [{ op: 'update_section', key: 'hero', patch: { purpose: 'X' } }]
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('STALE_SPEC')
    })

    it('rejects unknown op index with named error', () => {
      const s0 = referenceProject()
      const spec = validSpec('page-home' as PageId)
      const setRes = ok(
        applyCommand(s0, {
          type: 'set_page_spec',
          commandId: 'cmd-set-spec-bad-op',
          baseRev: s0.rev,
          pageId: 'page-home' as PageId,
          spec
        })
      )
      const res = applyCommand(setRes.state, {
        type: 'edit_page_spec',
        commandId: 'cmd-edit-bad-op',
        baseRev: setRes.state.rev,
        pageId: 'page-home' as PageId,
        baseSpecVersion: 1,
        ops: [{ op: 'remove_section', key: 'no-such-section' }]
      })
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('SPEC_OP_FAILED')
        expect(res.error.target).toContain('opIndex')
      }
    })
  })

  describe('approve_page_spec (new)', () => {
    it('validates, sets approved, idempotent', () => {
      const s0 = referenceProject()
      const spec = validSpec('page-home' as PageId)
      const setRes = ok(
        applyCommand(s0, {
          type: 'set_page_spec',
          commandId: 'cmd-set-spec-approve',
          baseRev: s0.rev,
          pageId: 'page-home' as PageId,
          spec
        })
      )
      const res1 = ok(
        applyCommand(setRes.state, {
          type: 'approve_page_spec',
          commandId: 'cmd-approve-1',
          baseRev: setRes.state.rev,
          pageId: 'page-home' as PageId,
          baseSpecVersion: 1
        })
      )
      const specAfter = res1.state.pageSpecs.get('page-home' as PageId)!
      expect(specAfter.status).toBe('approved')

      const res2 = ok(
        applyCommand(res1.state, {
          type: 'approve_page_spec',
          commandId: 'cmd-approve-1',
          baseRev: res1.state.rev,
          pageId: 'page-home' as PageId,
          baseSpecVersion: 1
        })
      )
      expect(res2.state.pageSpecs.get('page-home' as PageId)!.status).toBe('approved')
      expect(validateProject(res2.state)).toEqual([])
    })

    it('STALE_SPEC when baseSpecVersion differs', () => {
      const s0 = referenceProject()
      const spec = validSpec('page-home' as PageId)
      const setRes = ok(
        applyCommand(s0, {
          type: 'set_page_spec',
          commandId: 'cmd-set-spec-approve-stale',
          baseRev: s0.rev,
          pageId: 'page-home' as PageId,
          spec
        })
      )
      const res = applyCommand(setRes.state, {
        type: 'approve_page_spec',
        commandId: 'cmd-approve-stale',
        baseRev: setRes.state.rev,
        pageId: 'page-home' as PageId,
        baseSpecVersion: 999
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('STALE_SPEC')
    })

    it('rejects invalid spec', () => {
      const s0 = referenceProject()
      const badSpec = {
        pageId: 'page-home',
        name: 'Home',
        purpose: 'Landing',
        version: 1,
        sections: [
          { key: 'hero', purpose: 'Hero', role: 'content' as never, goal: 'Test goal', elements: [{ key: 'h1', kind: 'heading', purpose: 'H1', required: true }] },
          { key: 'hero', purpose: 'Dup', elements: [{ key: 'h2', kind: 'heading', purpose: 'H2', required: true }] }
        ]
      } as never
      const setRes = applyCommand(s0, {
        type: 'set_page_spec',
        commandId: 'cmd-set-bad-spec',
        baseRev: s0.rev,
        pageId: 'page-home' as PageId,
        spec: badSpec
      })
      expect(setRes.ok).toBe(false)
    })
  })

  describe('instantiate_spec_skeleton (changed: idempotent reconcile)', () => {
    it('creates skeleton nodes on first run', () => {
      const s0 = referenceProject()
      const spec = validSpec('page-home' as PageId)
      const setRes = ok(
        applyCommand(s0, {
          type: 'set_page_spec',
          commandId: 'cmd-set-skel',
          baseRev: s0.rev,
          pageId: 'page-home' as PageId,
          spec
        })
      )
      const res = ok(
        applyCommand(setRes.state, {
          type: 'instantiate_spec_skeleton',
          commandId: 'cmd-skel-1',
          baseRev: setRes.state.rev,
          pageId: 'page-home' as PageId
        })
      )
      expect(res.state.nodes.has('sec-page-home-hero' as never)).toBe(true)
      expect(res.state.nodes.has('el-page-home-hero-h1' as never)).toBe(true)
    })

    it('second run never resets existing props or children (idempotent)', () => {
      const s0 = referenceProject()
      const spec = validSpec('page-home' as PageId)
      const setRes = ok(
        applyCommand(s0, {
          type: 'set_page_spec',
          commandId: 'cmd-set-skel-2',
          baseRev: s0.rev,
          pageId: 'page-home' as PageId,
          spec
        })
      )
      const r1 = ok(
        applyCommand(setRes.state, {
          type: 'instantiate_spec_skeleton',
          commandId: 'cmd-skel-first',
          baseRev: setRes.state.rev,
          pageId: 'page-home' as PageId
        })
      )
      const sectionId = 'sec-page-home-hero' as never
      const r2 = ok(
        applyCommand(r1.state, {
          type: 'set_property',
          commandId: 'cmd-mutate-section',
          baseRev: r1.state.rev,
          targetId: sectionId,
          property: 'bgColor',
          value: '#F5F5F2'
        })
      )
      const r3 = ok(
        applyCommand(r2.state, {
          type: 'instantiate_spec_skeleton',
          commandId: 'cmd-skel-second',
          baseRev: r2.state.rev,
          pageId: 'page-home' as PageId
        })
      )
      const sectionAfter = r3.state.nodes.get(sectionId)!
      expect(sectionAfter.props.bgColor).toBe('#F5F5F2')
      const el = r3.state.nodes.get('el-page-home-hero-h1' as never)!
      expect(el.parentId).toBe(sectionId)
    })
  })

  describe('apply_candidate (changed: scope)', () => {
    it('records candidate at instance scope by default', () => {
      const s0 = referenceProject()
      const res = ok(
        applyCommand(s0, {
          type: 'apply_candidate',
          commandId: 'cmd-cand-1',
          candidateId: 'cand-1' as never,
          componentDefId: 'button',
          baseRev: s0.rev,
          targetId: 'el-hero-cta' as never,
          patches: [{ property: 'bgColor', value: '#1C1C1A' }, { property: 'textColor', value: '#F5F3EC' }]
        })
      )
      let latest: never | undefined
      for (const [id, dec] of res.state.decisions) {
        if (!latest || dec.seq > res.state.decisions.get(latest as never)!.seq) latest = id as never
      }
      const dec = res.state.decisions.get(latest as never)!
      expect(dec.scope.kind).toBe('instance')
      expect(dec.status).toBe('approved')
    })

    it('records candidate at page scope when explicitly provided', () => {
      const s0 = referenceProject()
      const res = ok(
        applyCommand(s0, {
          type: 'apply_candidate',
          commandId: 'cmd-cand-page',
          candidateId: 'cand-page' as never,
          componentDefId: 'button',
          baseRev: s0.rev,
          targetId: 'el-hero-cta' as never,
          patches: [{ property: 'bgColor', value: '#1C1C1A' }, { property: 'textColor', value: '#F5F3EC' }],
          scope: { kind: 'page', pageId: 'page-home' as PageId, targetType: 'button' }
        })
      )
      let latest: never | undefined
      for (const [id, dec] of res.state.decisions) {
        if (!latest || dec.seq > res.state.decisions.get(latest as never)!.seq) latest = id as never
      }
      const dec = res.state.decisions.get(latest as never)!
      expect(dec.scope.kind).toBe('page')
      expect(dec.status).toBe('approved')
    })

    it('records candidate at global scope when explicitly provided', () => {
      const s0 = referenceProject()
      const res = ok(
        applyCommand(s0, {
          type: 'apply_candidate',
          commandId: 'cmd-cand-global',
          candidateId: 'cand-global' as never,
          componentDefId: 'button',
          baseRev: s0.rev,
          targetId: 'el-hero-cta' as never,
          patches: [{ property: 'bgColor', value: '#1C1C1A' }, { property: 'textColor', value: '#F5F3EC' }],
          scope: { kind: 'global', targetType: 'button' }
        })
      )
      let latest: never | undefined
      for (const [id, dec] of res.state.decisions) {
        if (!latest || dec.seq > res.state.decisions.get(latest as never)!.seq) latest = id as never
      }
      const dec = res.state.decisions.get(latest as never)!
      expect(dec.scope.kind).toBe('global')
      expect(dec.status).toBe('approved')
    })
  })
})
