/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Base URL of the hosted dataset API; overrides the built-in production default. */
  readonly VITE_DATA_API?: string;
}
