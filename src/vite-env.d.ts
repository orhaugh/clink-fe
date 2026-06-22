/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLINK_TARGET?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
