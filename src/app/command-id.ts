// Command ids must satisfy ID_PATTERN (max 64 chars). Date.now() collided inside one
// millisecond and the replay guard silently dropped the second command.
let seq = 0
const prefixPattern = /^[a-z][a-z0-9-]{0,19}$/

export function newId(prefix: string): string {
  const safe = prefixPattern.test(prefix) ? prefix : 'id'
  return `${safe}-${++seq}-${Math.random().toString(36).slice(2, 10)}`
}

export function newCommandId(prefix: string): string {
  return `cmd-${newId(prefix)}` as never
}
