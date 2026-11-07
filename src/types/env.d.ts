// src/types/env.d.ts
declare interface ImportMetaEnv {
  DEV?: boolean
  PROD?: boolean
}

declare interface ImportMeta {
  env: ImportMetaEnv
}
