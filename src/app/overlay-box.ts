export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** Element box in overlay coordinates (unscaled), given the canvas root and current zoom. */
export function boxFor(root: HTMLElement, el: Element, zoom: number): Box {
  const r = el.getBoundingClientRect()
  const rootR = root.getBoundingClientRect()
  const z = zoom || 1
  return { left: (r.left - rootR.left) / z, top: (r.top - rootR.top) / z, width: r.width / z, height: r.height / z }
}