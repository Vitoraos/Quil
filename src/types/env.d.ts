// src/types/env.d.ts
declare interface ImportMetaEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
  VITE_TEST_FAKE_AUTH?: string
  DEV?: boolean
  PROD?: boolean
}

declare interface ImportMeta {
  env: ImportMetaEnv
}
