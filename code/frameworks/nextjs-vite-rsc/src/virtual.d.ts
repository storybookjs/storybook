declare module 'virtual:vite-rsc-browser-mode/build-client-references' {
  const default_: Record<string, () => Promise<any>>;
  export default default_;
}

declare module 'virtual:vite-rsc-browser-mode/build-server-references' {
  const default_: Record<string, () => Promise<any>>;
  export default default_;
}

declare module 'virtual:vite-rsc-browser-mode/load-client' {
  const default_: () => Promise<typeof import('./react-client')>;
  export default default_;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly __vite_rsc_build__?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}