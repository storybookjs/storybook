declare var __STORYBOOK_ADDONS_MANAGER: any;

declare var CONFIG_TYPE: string;
declare var TAGS_OPTIONS: import('@storybook/core/internal/types').StorybookConfigRaw['tags'];
declare var REFS: any;
declare var VERSIONCHECK: any;
declare var LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;
declare var STORYBOOK_ADDON_STATE: Record<string, any>;
declare var STORYBOOK_FRAMEWORK:
  | import('@storybook/core/internal/types').SupportedFramework
  | undefined;
declare var STORYBOOK_RENDERER:
  | import('@storybook/core/internal/types').SupportedRenderer
  | undefined;
declare var STORYBOOK_BUILDER:
  | import('@storybook/core/internal/types').SupportedBuilder
  | undefined;
declare var STORYBOOK_LAST_EVENTS: Record<
  import('@storybook/core/internal/telemetry').EventType,
  import('@storybook/core/internal/telemetry').CacheEntry
>;
declare var STORYBOOK_SESSION_ID: string | undefined;
