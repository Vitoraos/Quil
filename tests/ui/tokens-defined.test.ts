// tests/ui/tokens-defined.test.ts
// Regression test: every var(--quil-*) reference under src/ must be declared
// in src/ui/tokens.css. Undefined CSS variables are silently dropped by the
// browser, causing unstyled HTML. This test catches that class of bug.

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const TOKENS_CSS = readFileSync(resolve(__dirname, '../../src/ui/tokens.css'), 'utf8')

// Extract all token names declared in tokens.css
const declaredTokens = new Set<string>()
const tokenDeclRegex = /(--quil-[a-z0-9-]+)\s*:/g
let match: RegExpExecArray | null
while ((match = tokenDeclRegex.exec(TOKENS_CSS)) !== null) {
  declaredTokens.add(match[1]!)
}

// Find all var(--quil-*) references in src/
const usedTokens = new Set<string>()

function scanDir(dir: string): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    const fullPath = join(dir, name)
    try {
      if (statSync(fullPath).isDirectory()) {
        if (name === 'node_modules' || name === '.codegraph') continue
        scanDir(fullPath)
      } else if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.css')) {
        const content = readFileSync(fullPath, 'utf8')
        const varRegex = /var\s*\(\s*(--quil-[a-z0-9-]+)/g
        let m: RegExpExecArray | null
        while ((m = varRegex.exec(content)) !== null) {
          usedTokens.add(m[1]!)
        }
      }
    } catch {
      // skip unreadable entries
    }
  }
}

scanDir(resolve(__dirname, '../../src'))

describe('tokens-defined', () => {
  it('every var(--quil-*) reference under src/ is declared in tokens.css', () => {
    const undeclared = [...usedTokens].filter((t) => !declaredTokens.has(t))
    expect(undeclared).toEqual([])
  })
})
