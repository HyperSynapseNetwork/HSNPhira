/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_TARGET: string
  readonly VITE_USE_PROXY: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// PWA install prompt global
interface Window {
  __pwaInstallPrompt: any | null
  __pwaInstallReady: boolean
}
