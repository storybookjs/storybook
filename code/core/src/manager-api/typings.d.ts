declare var __STORYBOOK_ADDONS_MANAGER: any;

declare var CONFIG_TYPE: string;
declare var FEATURES: import('storybook/internal/types').StorybookConfigRaw['features'];
declare var TAGS_OPTIONS: import('storybook/internal/types').StorybookConfigRaw['tags'];
declare var REFS: any;
declare var VERSIONCHECK: any;
declare var LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;
declare var STORYBOOK_ADDON_STATE: Record<string, any>;
declare var STORYBOOK_FRAMEWORK: import('storybook/internal/types').SupportedFramework | undefined;
declare var STORYBOOK_RENDERER: import('storybook/internal/types').SupportedRenderer | undefined;
declare var STORYBOOK_BUILDER: import('storybook/internal/types').SupportedBuilder | undefined;
