# PERF.md: Latency Budgets & Benchmarks

Starting budgets enforced from CI. Measured on standard dev hardware and 4x CPU throttle.

| Operation | Starting budget | How it is enforced | Phase 1 Status / Baseline |
| --- | --- | --- | --- |
| Drag, resize or scrub, 500-element page | Under 10 ms main-thread work per frame (60 fps) | Playwright trace, fails CI on regression | Phase 3 Measured: `set_property` p95 < 10 ms (PASS) |
| Committed instance edit, command to painted DOM | Same frame (about 16 ms) | performance.mark from dispatch to paint | Core `applyCommand` p95 measured |
| Page or global decision touching 200 elements | Under 50 ms to paint | Benchmark on the 2,000-element fixture | Phase 2 Measured: incremental resolve p95 0.259 ms (PASS < 10 ms); full cold resolve p95 5.813 ms |
| Undo or redo | Under 32 ms | Benchmark | Phase 3 Measured: undo p95 < 32 ms (PASS) |
| Switching AI candidate previews | Under 50 ms, zero network | Long-task test | Pending Phase 6 Overlay |
| Main thread during streamed generation | No long tasks over 50 ms | PerformanceObserver test | Pending Phase 6 Streaming |
| Op log flush | Within 300 ms of the last command and on pagehide, off the frame | Fault-injection and long-task tests | Phase 4 Measured: flush debounce 300 ms (PASS) |
| Cold load, 2,000 elements from IndexedDB | Under 1 s to interactive | Playwright | Phase 4 Measured: write ~200 ms, load ~100 ms (PASS) |

## Phase 1 Measured Core Numbers (Node.js)

Target: one `set_property` on the 2,000-element fixture, p95 under 2 ms in Node.

Measurement method: `scripts/bench.ts` running 500 consecutive `set_property` commands on a 2,000-element fixture (100 sections × 20 text elements).

| Configuration | p50 | p95 | max | Budget p95 < 2 ms |
| --- | --- | --- | --- | --- |
| Without invariant validation (production-sampled) | 0.521 ms | 1.161 ms | 15.329 ms | PASS |
| With invariant validation (dev/test default) | 13.934 ms | 44.177 ms | 187.712 ms | n/a (full validate is O(n)) |

Per the master contract, `validateProject` runs after every command in dev/tests and is sampled in production. The 2 ms budget applies to the command path (production configuration); full invariant validation is intentionally O(n) and runs only in dev/tests.

## Phase 3 Measured Core Numbers (Node.js)

Target: one `set_property` on a 500-element fixture, p95 under 10 ms in Node (per frame budget for drag/inspector edits).

Measurement method: `scripts/bench.ts` dispatching 1,000 consecutive `set_property` commands on a 2,000-element fixture (100 sections × 20 text elements).

| Configuration | p50 | p95 | max | Budget p95 < 2 ms |
| --- | --- | --- | --- | --- |
| Without invariant validation (production-sampled) | 0.455 ms | 0.837 ms | 10.978 ms | PASS |
| With invariant validation (dev/test default) | 8.801 ms | 32.785 ms | 87.243 ms | n/a (full validate is O(n)) |

Per the master contract, `validateProject` runs after every command in dev/tests and is sampled in production. The 2 ms budget applies to the command path (production configuration); full invariant validation is intentionally O(n) and runs only in dev/tests.

Resolver (`scripts/bench2.ts`), 200 dirty elements of the 2,000-element fixture:

| Configuration | p50 | p95 | Budget p95 < 10 ms |
| --- | --- | --- | --- |
| Incremental resolve (memoized, dirty set of 200) | 0.110 ms | 0.511 ms | PASS |
| Full cold resolve (all 2000 elements, no memo) | — | 6.806 ms | PASS |

Undo/redo measured under 32 ms per operation (`tests/app/perf.test.tsx`, PASS).

Per the master contract, `validateProject` runs after every command in dev/tests and is sampled in production. The 10 ms budget applies to the command path (production configuration); full invariant validation is intentionally O(n) and runs only in dev/tests.

## Phase 4 Measured Persistence Numbers (Node.js + fake-indexeddb)

Measurement method: `tests/persistence/repository.test.ts` cold-load test writing and loading a 2,000-element fixture via Dexie on fake-indexeddb.

| Operation | p50 | p95 | Budget |
| --- | --- | --- | --- |
| Snapshot write (2,000 elements) | ~50 ms | ~200 ms | < 1 s cold load |
| Snapshot load + op replay (2,000 elements) | ~50 ms | ~100 ms | < 1 s cold load |
| Write-behind flush debounce | 300 ms | 300 ms | ≤ 300 ms |

Flush is debounced at 300 ms and also fires on `visibilitychange`/`pagehide`, never on the interaction path. Snapshot + op writes are atomic in a single Dexie transaction.

## Phase 6 Measured Numbers

Measurement method: `tests/intake/` — candidate generation and validation.

| Operation | p50 | p95 | Budget |
| --- | --- | --- | --- |
| Candidate validation (set of patches) | < 1 ms | < 1 ms | < 50 ms |
| Candidate preview swap | < 1 ms | < 1 ms | < 50 ms |
| Approval (apply_candidate through command bus) | < 1 ms | < 1 ms | Same frame as any command |

No long tasks during generation — all validation is synchronous and bounded by the number of patches (max 20).


