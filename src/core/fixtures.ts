import type { Asset, DesignDecision, DesignElement, Page, ProjectState } from './state'
import { createProjectState } from './state'
import type { AssetId, DecisionId, ElementId, PageId, ProjectId } from './ids'
import { projectIdSchema } from './ids'

let projectCounter = 0

/** A blank project. Any site starts here; intake supplies the content. */
export function emptyProject(): ProjectState {
  return createProjectState('proj-local' as ProjectId, 'Untitled Project')
}

/** Create a project with a unique, branded ProjectId. */
export function createProject(name: string): ProjectState {
  projectCounter += 1
  const projectId = projectIdSchema.parse(`proj-${Date.now()}-${projectCounter}`)
  return createProjectState(projectId, name)
}

/**
 * A small two-page reference project used by tests, benches and the demo.
 * Content is deliberately site-agnostic so nothing in Quil assumes a vertical.
 */
export function referenceProject(): ProjectState {
  const state = createProjectState('proj-reference' as ProjectId, 'Starter Site')

  const homePage: Page = {
    id: 'page-home' as PageId,
    name: 'Home',
    sectionIds: ['sec-nav' as ElementId, 'sec-hero' as ElementId, 'sec-features' as ElementId, 'sec-footer' as ElementId]
  }
  const aboutPage: Page = {
    id: 'page-about' as PageId,
    name: 'About',
    sectionIds: []
  }
  state.pages.set(homePage.id, homePage)
  state.pages.set(aboutPage.id, aboutPage)

  const heroAsset: Asset = {
    id: 'asset-hero' as AssetId,
    kind: 'image',
    width: 1920,
    height: 1080,
    alt: 'Abstract placeholder artwork'
  }
  state.assets.set(heroAsset.id, heroAsset)

  const nodes: DesignElement[] = [
    {
      id: 'sec-nav' as ElementId,
      kind: 'section',
      pageId: homePage.id,
      parentId: null,
      childIds: ['el-nav' as ElementId],
      rev: 0,
      props: { bgColor: '#F5F5F2', padding: { value: 16 } }
    },
    {
      id: 'el-nav' as ElementId,
      kind: 'navigation',
      pageId: homePage.id,
      parentId: 'sec-nav' as ElementId,
      childIds: [],
      rev: 0,
      props: {
        bgColor: '#F5F5F2',
        items: [
          { label: 'Home', pageId: 'page-home' as PageId },
          { label: 'About', pageId: 'page-about' as PageId }
        ]
      }
    },
    {
      id: 'sec-hero' as ElementId,
      kind: 'section',
      pageId: homePage.id,
      parentId: null,
      childIds: ['el-hero-heading' as ElementId, 'el-hero-text' as ElementId, 'el-hero-cta' as ElementId, 'el-hero-img' as ElementId],
      rev: 0,
      props: { bgColor: '#ECECE8', padding: { value: 48 } }
    },
    {
      id: 'el-hero-heading' as ElementId,
      kind: 'heading',
      pageId: homePage.id,
      parentId: 'sec-hero' as ElementId,
      childIds: [],
      rev: 0,
      props: {
        text: 'Design once. Apply everywhere.',
        level: 1,
        color: '#1C1C1A',
        fontWeight: 800,
        fontSize: { value: 40, unit: 'px' }
      }
    },
    {
      id: 'el-hero-text' as ElementId,
      kind: 'text',
      pageId: homePage.id,
      parentId: 'sec-hero' as ElementId,
      childIds: [],
      rev: 0,
      props: {
        text: 'A starter page for whatever you are building. You approve each decision; Quil keeps applying it.',
        fontSize: { value: 18, unit: 'px' },
        color: '#1C1C1A'
      }
    },
    {
      id: 'el-hero-cta' as ElementId,
      kind: 'button',
      pageId: homePage.id,
      parentId: 'sec-hero' as ElementId,
      childIds: [],
      rev: 0,
      props: {
        label: 'Get started',
        bgColor: 'oklch(0.47 0.27 264)',
        textColor: '#ECECE8',
        radius: 8,
        fontWeight: 600
      }
    },
    {
      id: 'el-hero-img' as ElementId,
      kind: 'image',
      pageId: homePage.id,
      parentId: 'sec-hero' as ElementId,
      childIds: [],
      rev: 0,
      props: {
        assetId: 'asset-hero' as AssetId,
        alt: 'Placeholder artwork',
        fit: 'cover',
        width: 1200,
        height: 600
      }
    },
    {
      id: 'sec-features' as ElementId,
      kind: 'section',
      pageId: homePage.id,
      parentId: null,
      childIds: ['el-card-a' as ElementId, 'el-card-b' as ElementId],
      rev: 0,
      props: { bgColor: '#F5F5F2', padding: { value: 32 } }
    },
    {
      id: 'el-card-a' as ElementId,
      kind: 'card',
      pageId: homePage.id,
      parentId: 'sec-features' as ElementId,
      childIds: ['el-card-a-h' as ElementId],
      rev: 0,
      props: { bgColor: '#F5F5F2', radius: 10, padding: { value: 24 }, shadow: 'shadow-1' }
    },
    {
      id: 'el-card-a-h' as ElementId,
      kind: 'heading',
      pageId: homePage.id,
      parentId: 'el-card-a' as ElementId,
      childIds: [],
      rev: 0,
      props: { text: 'Approved decisions', level: 3, color: '#1C1C1A' }
    },
    {
      id: 'el-card-b' as ElementId,
      kind: 'card',
      pageId: homePage.id,
      parentId: 'sec-features' as ElementId,
      childIds: ['el-card-b-h' as ElementId],
      rev: 0,
      props: { bgColor: '#F5F5F2', radius: 10, padding: { value: 24 }, shadow: 'shadow-1' }
    },
    {
      id: 'el-card-b-h' as ElementId,
      kind: 'heading',
      pageId: homePage.id,
      parentId: 'el-card-b' as ElementId,
      childIds: [],
      rev: 0,
      props: { text: 'Scoped changes', level: 3, color: '#1C1C1A' }
    },
    {
      id: 'sec-footer' as ElementId,
      kind: 'section',
      pageId: homePage.id,
      parentId: null,
      childIds: ['el-footer-copy' as ElementId],
      rev: 0,
      props: { bgColor: '#1C1C1A', padding: { value: 24 } }
    },
    {
      id: 'el-footer-copy' as ElementId,
      kind: 'text',
      pageId: homePage.id,
      parentId: 'sec-footer' as ElementId,
      childIds: [],
      rev: 0,
      props: { text: '© 2026 Starter Site. All rights reserved.', color: '#ECECE8' }
    }
  ]

  for (const n of nodes) {
    state.nodes.set(n.id, n)
  }

  const dec1: DesignDecision = {
    id: 'dec-btn-brand' as DecisionId,
    property: 'bgColor',
    value: 'oklch(0.47 0.27 264)',
    scope: { kind: 'global', targetType: 'button' },
    status: 'approved',
    seq: 1
  }
  const dec2: DesignDecision = {
    id: 'dec-hero-font' as DecisionId,
    property: 'fontSize',
    value: { value: 40, unit: 'px' },
    scope: { kind: 'instance', elementId: 'el-hero-heading' as ElementId },
    status: 'approved',
    seq: 2
  }
  state.decisions.set(dec1.id, dec1)
  state.decisions.set(dec2.id, dec2)
  state.nextDecisionSeq = 3

  return state
}

export function buildSyntheticFixture(totalNodes: number): ProjectState {
  const state = createProjectState('proj-synth' as ProjectId, 'Performance Benchmark Project')
  const page: Page = {
    id: 'page-main' as PageId,
    name: 'Main',
    sectionIds: []
  }
  state.pages.set(page.id, page)

  const itemsPerSection = 20
  const sectionCount = Math.ceil(totalNodes / (itemsPerSection + 1))
  let created = 0

  for (let s = 0; s < sectionCount && created < totalNodes; s++) {
    const secId = `sec-perf-${s}` as ElementId
    page.sectionIds.push(secId)
    const secNode: DesignElement = {
      id: secId,
      kind: 'section',
      pageId: page.id,
      parentId: null,
      childIds: [],
      rev: 0,
      props: { bgColor: '#ECECE8', padding: { value: 16 } }
    }
    state.nodes.set(secId, secNode)
    created++

    for (let i = 0; i < itemsPerSection && created < totalNodes; i++) {
      const elId = `el-perf-${s}-${i}` as ElementId
      secNode.childIds.push(elId)
      const elNode: DesignElement = {
        id: elId,
        kind: 'text',
        pageId: page.id,
        parentId: secId,
        childIds: [],
        rev: 0,
        props: {
          text: `Paragraph ${s}-${i} for latency budget test under scale`,
          fontSize: { value: 16, unit: 'px' },
          color: '#1C1C1A'
        }
      }
      state.nodes.set(elId, elNode)
      created++
    }
  }

  return state
}
