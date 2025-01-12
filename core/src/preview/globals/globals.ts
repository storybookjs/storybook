// Here we map the name of a module to their REFERENCE in the global scope.

export const globalsNameReferenceMap = {
  '@storybook/global': '__STORYBOOK_MODULE_GLOBAL__',

  'storybook/internal/channels': '__STORYBOOK_MODULE_CHANNELS__',
  '@storybook/channels': '__STORYBOOK_MODULE_CHANNELS__',
  '@storybook/core/channels': '__STORYBOOK_MODULE_CHANNELS__',

  'storybook/internal/client-logger': '__STORYBOOK_MODULE_CLIENT_LOGGER__',
  '@storybook/client-logger': '__STORYBOOK_MODULE_CLIENT_LOGGER__',
  '@storybook/core/client-logger': '__STORYBOOK_MODULE_CLIENT_LOGGER__',

  'storybook/internal/core-events': '__STORYBOOK_MODULE_CORE_EVENTS__',
  '@storybook/core-events': '__STORYBOOK_MODULE_CORE_EVENTS__',
  '@storybook/core/core-events': '__STORYBOOK_MODULE_CORE_EVENTS__',

  'storybook/internal/preview-errors': '__STORYBOOK_MODULE_CORE_EVENTS_PREVIEW_ERRORS__',
  '@storybook/core-events/preview-errors': '__STORYBOOK_MODULE_CORE_EVENTS_PREVIEW_ERRORS__',
  '@storybook/core/preview-errors': '__STORYBOOK_MODULE_CORE_EVENTS_PREVIEW_ERRORS__',

  'storybook/internal/preview-api': '__STORYBOOK_MODULE_PREVIEW_API__',
  '@storybook/preview-api': '__STORYBOOK_MODULE_PREVIEW_API__',
  '@storybook/core/preview-api': '__STORYBOOK_MODULE_PREVIEW_API__',

  'storybook/internal/types': '__STORYBOOK_MODULE_TYPES__',
  '@storybook/types': '__STORYBOOK_MODULE_TYPES__',
  '@storybook/core/types': '__STORYBOOK_MODULE_TYPES__',
} as const;

export const globalPackages = Object.keys(globalsNameReferenceMap) as Array<
  keyof typeof globalsNameReferenceMap
>;
