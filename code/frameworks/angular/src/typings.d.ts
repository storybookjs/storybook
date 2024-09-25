/* eslint-disable no-underscore-dangle, @typescript-eslint/naming-convention */

// will be provided by the webpack define plugin
declare var NODE_ENV: string | undefined;

declare var __STORYBOOK_ADDONS_CHANNEL__: any;
declare var __STORYBOOK_ADDONS_PREVIEW: any;
declare var __STORYBOOK_COMPODOC_JSON__: any;
declare var __STORYBOOK_PREVIEW__: any;
declare var __STORYBOOK_STORY_STORE__: any;
declare var CHANNEL_OPTIONS: any;
declare var DOCS_OPTIONS: any;

declare var FEATURES: import('storybook/internal/types').StorybookConfigRaw['features'];

declare var IS_STORYBOOK: any;
declare var LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;
declare var STORIES: any;
declare var STORYBOOK_ENV: 'angular';
declare var STORYBOOK_HOOKS_CONTEXT: any;
