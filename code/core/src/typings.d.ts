/// <reference path="../typings.d.ts" />

declare var CONFIG_TYPE: 'DEVELOPMENT' | 'PRODUCTION';
declare var FEATURES: import('./types/modules/core-common').StorybookConfigRaw['features'];
declare var LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;
declare var REFS: any;
declare var VERSIONCHECK: any;

declare var STORYBOOK_ADDON_STATE: Record<string, any>;
declare var STORYBOOK_BUILDER: string | undefined;
declare var STORYBOOK_FRAMEWORK: string | undefined;
declare var STORYBOOK_HOOKS_CONTEXT: any;
declare var STORYBOOK_RENDERER: string | undefined;

declare var __STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__: any;
declare var __STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__: any;
declare var __STORYBOOK_ADDONS_CHANNEL__: any;
declare var __STORYBOOK_ADDONS_MANAGER: any;
declare var __STORYBOOK_ADDONS_PREVIEW: import('./preview-api/modules/addons/main').AddonStore;
declare var __STORYBOOK_PREVIEW__: import('./preview-api/modules/preview-web/PreviewWeb').PreviewWeb<any>;
declare var __STORYBOOK_STORY_STORE__: any;
declare var __STORYBOOK_TEST__: any;
declare var __STORYBOOK_TEST_SPY_LISTENERS__: Set<any>;
declare var __STORYBOOK_ACTIONS__: any;
declare var __STORYBOOK_VITEST_MOCKER__: any;

declare module '@aw-web-design/x-default-browser';
declare module 'ansi-to-html';
declare module 'better-opn';
declare module 'lazy-universal-dotenv';
declare module 'open';
declare module 'pnp-webpack-plugin';
declare module 'react-inspector';

declare var STORIES: any;

declare var CHANNEL_OPTIONS: any;
declare var DOCS_OPTIONS: any;
declare var TAGS_OPTIONS: import('./types/modules/core-common').StorybookConfigRaw['tags'];

// To enable user code to detect if it is running in Storybook
declare var IS_STORYBOOK: boolean;

// ClientApi (and StoreStore) are really singletons. However they are not created until the
// relevant framework instantiates them via `start.js`. The good news is this happens right away.
declare var sendTelemetryError: (error: any) => void;

declare class AnsiToHtml {
  constructor(options: { escapeHtml: boolean });

  toHtml: (ansi: string) => string;
}

declare module '*.md';
declare module '*.mdx';
declare module '*.png';
