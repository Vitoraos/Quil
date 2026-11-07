// src/app/index.tsx
// Entry point: router wraps the whole app.
// Tokens, fonts and base layer load before anything renders so every
// var(--quil-*) resolves instead of falling back to browser defaults.

import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import '../ui/tokens.css'
import '../ui/base.css'

import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Router } from '../router'

const rootEl = document.getElementById('root')
if (!rootEl) {
  const body = document.body
  const el = document.createElement('div')
  el.id = 'root'
  body.appendChild(el)
  createRoot(el).render(React.createElement(Router))
} else {
  createRoot(rootEl).render(React.createElement(Router))
}
