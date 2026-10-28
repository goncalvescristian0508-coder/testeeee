/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'http'
  readonly VITE_API_URL?: string
  readonly VITE_IDENTITY_MODE?: 'mock' | 'http'
  readonly VITE_ROUTER?: 'memory' | 'browser'
}
