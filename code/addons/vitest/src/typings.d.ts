declare const BROWSER_CONFIG: object;
/** Mirrors SupportedBuilder string values without importing the enum (avoids dual-identity under --no-link). */
declare var STORYBOOK_BUILDER: 'webpack5' | 'vite' | 'rsbuild' | undefined;

interface ImportMetaEnv {
  __STORYBOOK_URL__?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*?raw' {
  const content: string;
  export default content;
}
