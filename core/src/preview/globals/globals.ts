// Here we map the name of a module to their REFERENCE in the global scope.

export const globalsNameReferenceMap = {
  '@storybook/global': '__STORYBOOK_MODULE_GLOBAL__',

  'storybook/test': '__STORYBOOK_MODULE_TEST__',
  'storybook/actions': '__STORYBOOK_MODULE_ACTIONS__',
  'storybook/preview-api': '__STORYBOOK_MODULE_PREVIEW_API__',

  'storybook/internal/channels': '__STORYBOOK_MODULE_CHANNELS__',
  'storybook/internal/client-logger': '__STORYBOOK_MODULE_CLIENT_LOGGER__',
  'storybook/internal/core-events': '__STORYBOOK_MODULE_CORE_EVENTS__',
  'storybook/internal/preview-errors': '__STORYBOOK_MODULE_CORE_EVENTS_PREVIEW_ERRORS__',
  'storybook/internal/types': '__STORYBOOK_MODULE_TYPES__',

  // @deprecated TODO: Remove in 9.1 or some point in the future, I guess
  'storybook/internal/preview-api': '__STORYBOOK_MODULE_PREVIEW_API__',
} as const;

export const globalPackages = Object.keys(globalsNameReferenceMap) as Array<
  keyof typeof globalsNameReferenceMap
>;
