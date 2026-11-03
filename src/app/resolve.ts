import { createResolverMemo, resolveElement, type ResolverMemo } from '../core'
import type { ElementId, ProjectState } from '../core'

export function createResolver() {
  const memo: ResolverMemo = createResolverMemo()
  return {
    resolve(state: ProjectState, elementId: ElementId) {
      return resolveElement(state, elementId, memo)
    },
    reset() {
      memo.elementCache.clear()
    }
  }
}
