import type { DesignCommand, ElementId, NodeKind, PageId, ProjectState } from '../core'
import { elementKinds } from '../core'
import { newCommandId, newId } from './command-id'

const containerKinds: NodeKind[] = ['section', 'card', 'navigation', 'form']

export function isContainer(kind: NodeKind): boolean {
  return containerKinds.includes(kind)
}

/** Where a new element goes: inside a container selection, beside a leaf, else the page's first section. */
export function insertParent(
  state: ProjectState,
  selectedId: ElementId | null,
  pageId: PageId | null
): ElementId | null {
  const selected = selectedId ? state.nodes.get(selectedId) : undefined
  if (selected) {
    if (isContainer(selected.kind)) return selected.id
    if (selected.parentId) {
      const parent = state.nodes.get(selected.parentId)
      if (parent && isContainer(parent.kind)) return parent.id
    }
  }
  const page = pageId ? state.pages.get(pageId) : [...state.pages.values()][0]
  return page?.sectionIds[0] ?? null
}

/** Smallest props object that satisfies the kind's schema. Null when it cannot be created here. */
export function defaultPropsFor(kind: Exclude<NodeKind, 'section'>, state: ProjectState): Record<string, unknown> | null {
  switch (kind) {
    case 'heading':
      return { text: 'Heading', level: 2 }
    case 'text':
      return { text: 'Body text' }
    case 'image': {
      const assetId = [...state.assets.keys()][0]
      return assetId ? { assetId, alt: 'Image', fit: 'cover' } : null
    }
    case 'button':
      return { label: 'Button', bgColor: '#111113', textColor: '#ECECE8' }
    case 'card':
      return { padding: { value: 16 }, radius: 10 }
    case 'navigation':
      return { items: [] }
    case 'form':
      return { submitLabel: 'Send', fields: [] }
  }
}

export const insertableKinds = elementKinds

/**
 * Copy an element and its subtree beside the original. Props only: no decisions follow.
 * Sections are roots and cannot be created by add_element, so they are not duplicable.
 */
export type DuplicateCommand = Extract<DesignCommand, { type: 'add_element' | 'add_section' }>

export function duplicateCommands(state: ProjectState, elementId: ElementId): DuplicateCommand[] | null {
  const root = state.nodes.get(elementId)
  if (!root) return null

  const commands: DuplicateCommand[] = []
  const copy = (id: ElementId, parentId: ElementId): void => {
    const node = state.nodes.get(id)
    if (!node) return
    const copyId = newId('el') as ElementId
    commands.push({
      type: 'add_element',
      commandId: newCommandId('dup') as never,
      baseRev: state.rev,
      elementId: copyId,
      parentId,
      kind: node.kind,
      props: { ...node.props }
    })
    for (const childId of node.childIds) copy(childId, copyId)
  }

  if (root.parentId === null) {
    // A section is a page root, so it is created with add_section, then filled.
    const copyId = newId('el') as ElementId
    commands.push({
      type: 'add_section',
      commandId: newCommandId('dup') as never,
      baseRev: state.rev,
      sectionId: copyId,
      pageId: root.pageId,
      props: { ...root.props }
    })
    for (const childId of root.childIds) copy(childId, copyId)
  } else {
    copy(elementId, root.parentId)
  }

  // One batch, bounded by the 100-subcommand limit.
  return commands.length === 0 || commands.length > 100 ? null : commands
}
