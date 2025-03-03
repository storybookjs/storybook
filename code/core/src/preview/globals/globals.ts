// Here we map the name of a module to their REFERENCE in the global scope.

export const globalsNameReferenceMap = {
  '@storybook/global': '__STORYBOOK_MODULE_GLOBAL__',

  'storybook/internal/channels': '__STORYBOOK_MODULE_CHANNELS__',

  'storybook/internal/client-logger': '__STORYBOOK_MODULE_CLIENT_LOGGER__',

  'storybook/internal/core-events': '__STORYBOOK_MODULE_CORE_EVENTS__',

  'storybook/internal/preview-errors': '__STORYBOOK_MODULE_CORE_EVENTS_PREVIEW_ERRORS__',

  'storybook/internal/preview-api': '__STORYBOOK_MODULE_PREVIEW_API__',

  'storybook/internal/types': '__STORYBOOK_MODULE_TYPES__',
} as const;

export const globalPackages = Object.keys(globalsNameReferenceMap) as Array<
  keyof typeof globalsNameReferenceMap
>;
