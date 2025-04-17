/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/naming-convention */
declare module '@egoist/vue-to-react';
declare module 'acorn-jsx';
declare module 'vue/dist/vue';

declare module 'sveltedoc-parser' {
  export function parse(options: any): Promise<any>;
}

declare var FEATURES: import('storybook/internal/types').StorybookConfigRaw['features'];
declare var __DOCS_CONTEXT__: any;
declare var PREVIEW_URL: any;
declare var LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;
declare var TAGS_OPTIONS: import('storybook/internal/types').TagsOptions;

declare module '*.md';
declare module '*.md?raw';
