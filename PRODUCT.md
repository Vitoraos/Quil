# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo and technical developers who want great consistent UI for their product but are not pro designers and are wary of AI design slop.

## Product Purpose

Quil is a guided design workspace for websites. Users make design decisions progressively, and every approved decision is stored as a scoped constraint and applied deterministically to later generation and editing. Nothing becomes part of the design system just because AI generated it; it becomes canonical only after the user approves it.

## Positioning

Zero Design Drift. The problem: 40% of frontend engineering time is spent fixing UI regressions, pixel discrepancies, and manually aligning code with Figma files. The outcome: perfect, automated alignment between intended design and production release. UI changes propagate across the entire product ecosystem predictably — guaranteeing that what gets approved in design is exactly what ships. Emphasises design ownership and scalable design.

## Operating Context

Browser-based design workspace. Users approve scoped design constraints that are then applied deterministically to generation and editing across the product. Decisions are scoped (instance, page, global) with deterministic precedence (preview overlay > instance > page > global > component default). Same-scope conflicts resolve by a documented total order, never insertion order. Resolved design is derived from the document and the decisions; it is never stored as a second mutable copy.

## Capabilities and Constraints

- Keep Supabase authentication with BYOK keys and a fake provider for tests (no real network calls in the test suite).
- Remove the boutique-hotel MVP (Home + Rooms pages) as the reference project; do not carry it forward.
- Dark theme, monochrome with no pure white and no pure black, plus ONE strong accent reserved for very important details or decisions only.
- Background colours easy on the eye for long sessions.
- WCAG 2.2 AA: keyboard operable, visible focus, no colour-only state, aria-live for async status, reduced motion respected.
- Bounded IDs for elements, decisions, assets, candidates, and commands.
- core/ is pure (no React, DOM, network, or AI-provider imports) and runs in Node tests.
- Write-behind persistence; atomic saves of document, decisions (including superseded ones), asset references, and history metadata.

## Brand Commitments

Name: Quil. Monochrome palette with one strong accent reserved for important details or decisions only. No second accent, no gradients on chrome.

## Evidence on Hand

- AGENTS.md — architecture, module boundaries, perf contract, defensive coding standard, UI contract.
- design_plan.md — U0–U4 (design system, shell/auth/settings, intake, workspace/variants tray, landing page) marked complete.
- src/ui/tokens.css — existing design tokens.
- src/core/ — command bus, decisions, generation, fixtures (tsc clean, tests passing).
- src/app/ — workspace shell, renderer, inspector, scope picker, generation panel, preview overlay, store.
- package.json — React 19, TypeScript, Vite, zod, immer, dexie, react-router-dom, culori; Supabase auth.

## Product Principles

1. The model proposes; the application validates and applies. AI output is untrusted input.
2. Scope is first-class: instance, page, global; precedence is deterministic (preview overlay > instance > page > global > component default).
3. Resolved design is derived from the document and the decisions; never store a second mutable copy.
4. Every change to the document is a typed Command sent through ONE command bus; no component writes document state directly.
5. Keep the page spec, design decisions, and element tree separate.

## Accessibility & Inclusion

WCAG 2.2 AA: keyboard operable, visible focus, no colour-only state, aria-live for async status, reduced motion respected.
