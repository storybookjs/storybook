declare const BROWSER_CONFIG: object;
declare var STORYBOOK_BUILDER: import('storybook/internal/types').SupportedBuilder | undefined;

interface ImportMetaEnv {
  __STORYBOOK_URL__?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
