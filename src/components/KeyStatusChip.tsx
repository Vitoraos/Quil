// src/components/KeyStatusChip.tsx
// Workspace top-bar chip showing BYOK key status, links to /settings#api-key.

import * as React from 'react'
import { useNavigate } from 'react-router-dom'

interface KeyStatusChipProps {
  status: 'not-set' | 'connected' | 'invalid' | 'rate-limited' | 'network-error'
  provider?: string
  lastFour?: string
}

export function KeyStatusChip({
  status = 'not-set',
  provider,
  lastFour,
}: KeyStatusChipProps): React.ReactElement {
  const navigate = useNavigate()

  const label =
    status === 'connected'
      ? `Connected (${provider ?? 'AI'}, …${lastFour ?? '****'})`
      : status === 'invalid'
        ? 'Invalid key'
        : status === 'rate-limited'
          ? 'Rate limited'
          : status === 'network-error'
            ? 'Network error'
            : 'No AI key set'

  const color =
    status === 'connected' ? 'var(--quil-text-100)' : 'color-mix(in oklab, var(--quil-text-100) 40%, var(--quil-bg))'

  return (
    <button
      type="button"
      onClick={() => navigate('/settings#api-key')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--quil-space-2)',
        padding: `0 var(--quil-space-3)`,
        minHeight: 'var(--quil-target-min)',
        borderRadius: 'var(--quil-radius-sm)',
        border: `1px solid var(--quil-line)`,
        background: 'var(--quil-surface)',
        color,
        fontSize: 'var(--quil-text-sm)',
        fontFamily: 'var(--quil-font-ui)',
        cursor: 'pointer',
        transition: 'border-color var(--quil-duration-press)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background:
            status === 'connected' ? 'color-mix(in oklab, var(--quil-text-100) 60%, var(--quil-bg))' : 'var(--quil-line)',
        }}
      />
      <span>{label}</span>
    </button>
  )
}
