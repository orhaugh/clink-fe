/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLINK_TARGET?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

// The console's version, injected from package.json by vite.config.ts.
declare const __CONSOLE_VERSION__: string
