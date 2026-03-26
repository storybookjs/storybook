declare module '@egoist/vue-to-react';
declare module 'acorn-jsx';
declare module 'vue/dist/vue';

declare var FEATURES: import('storybook/internal/types').StorybookConfigRaw['features'];
declare var __DOCS_CONTEXT__: import('react').Context<
  | import('storybook/internal/types').DocsContextProps<import('storybook/internal/types').Renderer>
  | null
>;
declare var PREVIEW_URL: string | undefined;
declare var LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;
declare var TAGS_OPTIONS: import('storybook/internal/types').TagsOptions;

declare module '*.md';
declare module '*.md?raw';
