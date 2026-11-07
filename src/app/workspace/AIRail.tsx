import * as React from 'react'

export function AIRail(): React.ReactElement {
  return (
    <aside
      style={{
        width: 305,
        background: 'var(--quil-surface)',
        borderRight: 'var(--quil-border-width) solid var(--quil-line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {/* Region A — tabs header */}
      <div
        style={{
          display: 'flex',
          borderBottom: 'var(--quil-border-width) solid var(--quil-line)',
        }}
      >
        <button
          className="active"
          style={{
            flex: 1,
            padding: 'var(--quil-space-3) var(--quil-space-4)',
            background: 'transparent',
            border: 'none',
            color: 'var(--quil-text-100)',
            cursor: 'pointer',
            fontSize: 'var(--quil-text-xs)',
            fontFamily: 'var(--quil-font-ui)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2px',
          }}
        >
          Generate
        </button>
        <button
          style={{
            flex: 1,
            padding: 'var(--quil-space-3) var(--quil-space-4)',
            background: 'transparent',
            border: 'none',
            color: 'var(--quil-text-100)',
            cursor: 'pointer',
            fontSize: 'var(--quil-text-xs)',
            fontFamily: 'var(--quil-font-ui)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2px',
          }}
        >
          Spec
        </button>
        <button
          style={{
            flex: 1,
            padding: 'var(--quil-space-3) var(--quil-space-4)',
            background: 'transparent',
            border: 'none',
            color: 'var(--quil-text-100)',
            cursor: 'pointer',
            fontSize: 'var(--quil-text-xs)',
            fontFamily: 'var(--quil-font-ui)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2px',
          }}
        >
          Decisions
        </button>
      </div>

      {/* Content stack: target chip → CLI prompt → stepper → queue → tray */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--quil-space-3)',
          padding: 'var(--quil-space-3)',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Target chip — shows current target with retarget dropdown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--quil-space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--quil-text-xs)',
              color: 'var(--quil-text-80)',
              fontFamily: 'var(--quil-font-ui)',
            }}
          >
            Target:
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--quil-space-1)',
              background: 'var(--quil-surface)',
              border: 'var(--quil-border-width) solid var(--quil-line)',
              borderRadius: 'var(--quil-radius-xs)',
              padding: 'var(--quil-space-1) var(--quil-space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--quil-text-xs)',
                color: 'var(--quil-text-100)',
                fontFamily: 'var(--quil-font-mono)',
              }}
            >
              Screen: Dashboard
            </span>
            <span
              style={{
                fontSize: 'var(--quil-text-xs)',
                color: 'var(--quil-text-70)',
              }}
            >
              ▾
            </span>
          </div>
        </div>

        {/* CLI prompt card — floating card, primary input */}
        <div
          style={{
            marginTop: '5px',
            marginLeft: '3px',
            marginRight: '3px',
            marginBottom: '5px',
            padding: 'var(--quil-space-4)',
            paddingBottom: '5px',
            background: 'var(--quil-raised)',
            border: 'var(--quil-border-width) solid var(--quil-line)',
            borderRadius: 'var(--quil-radius-xs)',
            boxShadow: 'var(--quil-shadow-1)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--quil-font-mono)',
              fontSize: 'var(--quil-text-base)',
              color: 'rgba(245, 240, 240, 0.85)',
              marginRight: 'var(--quil-space-2)',
              flexShrink: 0,
            }}
          >
            &gt;
          </div>
          <input
            type="text"
            placeholder="/generate variants -3"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'rgba(245, 240, 240, 0.85)',
              fontFamily: 'var(--quil-font-ui)',
              fontSize: 'var(--quil-text-base)',
              outline: 'none',
              minWidth: 0,
            }}
          />
        </div>

        {/* Variants stepper — [−] 3 [+] */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--quil-space-2)',
          }}
        >
          <button
            style={{
              width: 'var(--quil-target-icon)',
              height: 'var(--quil-target-icon)',
              background: 'var(--quil-surface-hover)',
              border: 'var(--quil-border-width) solid var(--quil-line)',
              borderRadius: 'var(--quil-radius-sm)',
              color: 'var(--quil-text-100)',
              fontSize: 'var(--quil-text-xs)',
              fontFamily: 'var(--quil-font-ui)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            −
          </button>
          <span
            style={{
              fontSize: 'var(--quil-text-xs)',
              color: 'var(--quil-text-100)',
              fontFamily: 'var(--quil-font-mono)',
              minWidth: '16px',
              textAlign: 'center',
            }}
          >
            3
          </span>
          <button
            style={{
              width: 'var(--quil-target-icon)',
              height: 'var(--quil-target-icon)',
              background: 'var(--quil-surface-hover)',
              border: 'var(--quil-border-width) solid var(--quil-line)',
              borderRadius: 'var(--quil-radius-sm)',
              color: 'var(--quil-text-100)',
              fontSize: 'var(--quil-text-xs)',
              fontFamily: 'var(--quil-font-ui)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
          <span
            style={{
              fontSize: 'var(--quil-text-xs)',
              color: 'var(--quil-text-70)',
              fontFamily: 'var(--quil-font-ui)',
            }}
          >
            variants (1–6)
          </span>
        </div>

        {/* Generation queue — progress card */}
        <div
          style={{
            padding: 'var(--quil-space-2) var(--quil-space-3)',
            background: 'var(--quil-surface)',
            border: 'var(--quil-border-width) solid var(--quil-line)',
            borderRadius: 'var(--quil-radius-xs)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--quil-space-2)',
              marginBottom: 'var(--quil-space-1)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--quil-text-xs)',
                color: 'var(--quil-ok)',
                fontFamily: 'var(--quil-font-mono)',
              }}
            >
              ✔
            </span>
            <span
              style={{
                fontSize: 'var(--quil-text-xs)',
                color: 'var(--quil-text-70)',
                fontFamily: 'var(--quil-font-ui)',
              }}
            >
              3 / 5 frames
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '4px',
              background: 'var(--quil-line)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '60%',
                height: '100%',
                background: 'var(--quil-accent)',
              }}
            />
          </div>
        </div>

        {/* Variant tray — fills remaining space, scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--quil-space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--quil-space-3)',
          }}
        >
          <div
            style={{
              color: 'var(--quil-text-70)',
              fontSize: 'var(--quil-text-xs)',
              fontFamily: 'var(--quil-font-ui)',
            }}
          >
            No variants yet
          </div>
        </div>
      </div>
    </aside>
  )
}
