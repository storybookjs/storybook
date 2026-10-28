// Here we map the name of a module to their REFERENCE in the global scope.
export const globalsNameReferenceMap = {
  react: '__REACT__',
  'react/jsx-runtime': '__REACT_JSX_RUNTIME__',
  'react/jsx-dev-runtime': '__REACT_JSX_DEV_RUNTIME__',
  'react-dom': '__REACT_DOM__',
  'react-dom/client': '__REACT_DOM_CLIENT__',
  // FocusScope keeps a module-level scope tree, so all manager code must share the copy bundled
  // with the components' Modal — scopes from a second copy cannot nest inside the Modal's scope.
  'react-aria/FocusScope': '__REACT_ARIA_FOCUS_SCOPE__',
  '@storybook/icons': '__STORYBOOK_ICONS__',

  'storybook/manager-api': '__STORYBOOK_API__',

  'storybook/theming': '__STORYBOOK_THEMING__',
  'storybook/theming/create': '__STORYBOOK_THEMING_CREATE__',

  'storybook/test': '__STORYBOOK_TEST__',

  'storybook/internal/channels': '__STORYBOOK_CHANNELS__',
  'storybook/internal/client-logger': '__STORYBOOK_CLIENT_LOGGER__',
  'storybook/internal/components': '__STORYBOOK_COMPONENTS__',
  'storybook/internal/core-events': '__STORYBOOK_CORE_EVENTS__',
  'storybook/internal/manager-errors': '__STORYBOOK_CORE_EVENTS_MANAGER_ERRORS__',
  'storybook/internal/router': '__STORYBOOK_ROUTER__',
  'storybook/internal/types': '__STORYBOOK_TYPES__',
} as const;

export const globalPackages = Object.keys(globalsNameReferenceMap) as Array<
  keyof typeof globalsNameReferenceMap
>;

/** The owning package's specifier of each globalized `storybook/*` key that only re-exports it. */
export const globalsPackageSpecifiers = {
  'storybook/manager-api': '@storybook/manager/manager-api',
  'storybook/theming': '@storybook/ui/theming',
  'storybook/theming/create': '@storybook/ui/theming/create',
  'storybook/test': '@storybook/core/test',
  'storybook/internal/channels': '@storybook/core/internal/channels',
  'storybook/internal/client-logger': '@storybook/core/internal/client-logger',
  'storybook/internal/components': '@storybook/ui/internal/components',
  'storybook/internal/core-events': '@storybook/core/internal/core-events',
  'storybook/internal/manager-errors': '@storybook/core/internal/manager-errors',
  'storybook/internal/router': '@storybook/manager/internal/router',
  'storybook/internal/types': '@storybook/core/internal/types',
} as const satisfies Partial<Record<keyof typeof globalsNameReferenceMap, string>>;
