# Quil

Guided design workspace: every approved design decision is stored as a scoped
constraint and applied deterministically.

## Run locally

1. Install dependencies:

   npm i

2. Copy the example env file and enable fake auth:

   cp .env.example .env.local

   Set `VITE_TEST_FAKE_AUTH=true` to sign in without Supabase credentials.

3. Start the dev server:

   npm run dev

   Open http://localhost:5173

4. Checks:

   npm run typecheck   # tsc --noEmit
   npm run lint        # eslint
   npm test            # vitest run --no-file-parallelism
