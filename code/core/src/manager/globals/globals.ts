// Here we map the name of a module to their REFERENCE in the global scope.
export const globalsNameReferenceMap = {
  react: '__REACT__',
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
