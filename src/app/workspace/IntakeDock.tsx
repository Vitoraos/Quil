import * as React from 'react'

/**
 * Placeholder for the Intake Dock (Layer 9).
 *
 * When the project is in an intake stage (project-intake / pick-start-page /
 * page-intake / spec-review), the right rail swaps from DesignRiley's
 * tree+inspector to this dock: header stepper (Project › Page › Design),
 * current question, answer box, option chips, "Why we ask", coverage bar.
 *
 * Built after the workspace shell per the workspace-first build constraint,
 * even though intake is first in the real user flow.
 */
export function IntakeDock(): React.ReactElement {
  return (
    <div
      style={{
        padding: 'var(--quil-space-4)',
        color: 'var(--quil-text-70)',
        fontSize: 'var(--quil-text-xs)',
        fontFamily: 'var(--quil-font-ui)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--quil-space-2)',
        height: '100%',
      }}
    >
      <div>Intake Dock</div>
      <div>Placeholder — real intake UI in Layer 9</div>
    </div>
  )
}
