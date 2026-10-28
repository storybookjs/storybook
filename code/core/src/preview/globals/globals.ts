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

/** The owning package's specifier of each globalized `storybook/*` key that only re-exports it. */
export const globalsPackageSpecifiers = {
  'storybook/test': '@storybook/core/test',
  'storybook/preview-api': '@storybook/core/preview-api',
  'storybook/internal/channels': '@storybook/core/internal/channels',
  'storybook/internal/client-logger': '@storybook/core/internal/client-logger',
  'storybook/internal/core-events': '@storybook/core/internal/core-events',
  'storybook/internal/preview-errors': '@storybook/core/internal/preview-errors',
  'storybook/internal/types': '@storybook/core/internal/types',
  'storybook/internal/preview-api': '@storybook/core/internal/preview-api',
} as const satisfies Partial<Record<keyof typeof globalsNameReferenceMap, string>>;

/**
 * Every specifier a builder swaps for a global: each key above and its owning package's specifier,
 * so product code importing `@storybook/core/preview-api` gets the runtime's instance too.
 */
export const builderGlobalsNameReferenceMap: Record<string, string> = {
  ...globalsNameReferenceMap,
  ...Object.fromEntries(
    Object.entries(globalsPackageSpecifiers).map(([key, packageSpecifier]) => [
      packageSpecifier,
      globalsNameReferenceMap[key as keyof typeof globalsPackageSpecifiers],
    ])
  ),
};
