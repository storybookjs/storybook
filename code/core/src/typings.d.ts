declare module 'lazy-universal-dotenv';
declare module '@aw-web-design/x-default-browser';
declare module '@discoveryjs/json-ext';
declare module 'watchpack';

declare var TAGS_OPTIONS: import('@storybook/core/internal/types').TagsOptions;

declare var CONFIG_TYPE: 'DEVELOPMENT' | 'PRODUCTION';
declare var LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;
declare var REFS: any;
declare var VERSIONCHECK: any;

declare var STORYBOOK_WEBSOCKET_TOKEN: string;

declare var STORYBOOK_ADDON_STATE: Record<string, any>;
declare var STORYBOOK_BUILDER: import('./types/modules/builders.ts').SupportedBuilder | undefined;
declare var STORYBOOK_FRAMEWORK:
  | import('./types/modules/frameworks.ts').SupportedFramework
  | undefined;
declare var STORYBOOK_RENDERER:
  | import('./types/modules/renderers.ts').SupportedRenderer
  | undefined;
declare var STORYBOOK_HOOKS_CONTEXT: any;
declare var STORYBOOK_CURRENT_TASK_LOG: undefined | null | Array<any>;
declare var SB_TELEMETRY_STATE: 'enabled' | 'disabled' | undefined;
declare var SB_TELEMETRY_QUEUE: Array<import('./telemetry/index.ts').QueuedEvent>;
declare var PAYLOAD_ERROR_HANDLER: import('./telemetry/index.ts').PayloadErrorHandler | undefined;

declare var STORYBOOK_LAST_EVENTS: Record<
  import('./telemetry/index.ts').EventType,
  import('./telemetry/index.ts').CacheEntry
>;
declare var STORYBOOK_SESSION_ID: string | undefined;
declare var STORYBOOK_NETWORK_ADDRESS: string | undefined;

declare var __STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__: any;
declare var __STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__: any;
declare var __STORYBOOK_ADDONS_CHANNEL__: any;
declare var __STORYBOOK_ADDONS_MANAGER: any;
declare var __STORYBOOK_ADDONS_PREVIEW: import('./preview-api/modules/addons/main.ts').AddonStore;
declare var __STORYBOOK_PREVIEW__: import('./preview-api/modules/preview-web/PreviewWeb.tsx').PreviewWeb<any>;
declare var __STORYBOOK_STORY_STORE__: any;
declare var __STORYBOOK_TEST__: any;
declare var __STORYBOOK_TEST_SPY_LISTENERS__: Set<any>;
declare var __STORYBOOK_ACTIONS__: any;
declare var __STORYBOOK_VITEST_MOCKER__: any;

declare module '@aw-web-design/x-default-browser';
declare module 'ansi-to-html';
declare module 'lazy-universal-dotenv';
declare module 'react-inspector';
// CLI-only entry with no "types" condition in package.json exports.
declare module '@storybook/core/internal/bin/loader' {
  const load: typeof import('./bin/loader.ts').load;
  export { load };
}

declare var STORIES: any;

declare var CHANNEL_OPTIONS: any;
declare var INSECURE_IFRAME_MESSAGING: boolean | undefined;
declare var DOCS_OPTIONS: any;
declare var TAGS_OPTIONS: import('./types/modules/core-common.ts').StorybookConfigRaw['tags'];

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
