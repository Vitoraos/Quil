# SECURITY.md: Threat Catalog & Defenses

Defensive coding rules catalog per the Quil master contract.

| Boundary | What goes wrong | Required defense | Test that proves it |
| --- | --- | --- | --- |
| AI output | Extra keys, wrong target, out-of-scope properties, fewer or duplicate candidates, NaN, injected instructions in text | Strict schema, per-target property allowlist, dedupe, hard constraints computed in code | Fuzz the validator with random mutations; a hero candidate patching button typography is rejected |
| Stored data | Old schema, truncated write, tampering, duplicate IDs, dangling references | Version stamp, migrate or quarantine, validateProject on load, backup before migration | Load a truncated fixture: recovery screen shown, original untouched |
| Style values | CSS injection through a value, url() exfiltration, oversized values | Per-property value validators, typed style map, no string-built CSS | Payload corpus run against every property |
| Text and names | XSS, RTL override characters, zero-width characters, megabyte strings | Render as text nodes only, length caps, normalization | A name containing an img onerror payload renders as literal text |
| URLs and assets | javascript: and data: URLs, scripted SVG, oversized or spoofed files, SSRF | Scheme allowlist, upload through Storage with size cap and MIME sniffing, no raw SVG, never fetch arbitrary URLs server-side | Hostile upload corpus rejected; private-IP URL refused |
| Object keys | __proto__ or constructor used as an ID or property name | Map or null-prototype objects, ID regex, strict schemas | Pollution probe leaves Object.prototype clean |
| Tree structure | Cycles, orphans, self-parent, depth bombs | Acyclic, orphan and depth checks in validateProject | Move-into-own-descendant rejected |
| Numbers | NaN, Infinity, negative sizes, overflow, float drift in layout | Reject non-finite values, clamp, fixed precision | Property test over extreme values |
| Concurrency | Edit during AI generation, double approve, undo mid-command, two tabs | Base-revision check, idempotent IDs, serialized command queue, Web Locks | Race matrix test; second tab opens read-only |
| Storage failure | Quota exceeded, aborted transaction, tab killed mid-write, offline | Atomic snapshot swap plus op log, save status stays unsaved until commit, capped retry | Fault injection at every step of a write |
| Provider failure | 429 or 5xx, timeout, stream cut, refusal | Deadline and abort, jittered backoff, circuit breaker, typed error in the UI, state preserved | Fake provider scripted to fail each way |
| Scope semantics | Deleting an element that has instance decisions, global rule with zero matches, equal-scope conflict, spec change after approval | Explicit orphan policy, deterministic tie-break, conflict surfaced instead of deleted | Oracle test: incremental resolve equals full resolve |
| Secrets (BYOK) | Key in logs, AI context, error reports or analytics | Redacting logger, context builder allowlist, encrypted at rest if stored server-side | Seed a fake key; assert it appears only in the provider request |
| Server | Missing RLS, IDOR, mass assignment, abuse | RLS on every table, server re-validates commands, rate limits | Two-user cross-access test; over-limit test |
