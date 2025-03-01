// Here we map the name of a module to their REFERENCE in the global scope.
export const globalsNameReferenceMap = {
  react: '__REACT__',
  'react-dom': '__REACT_DOM__',
  'react-dom/client': '__REACT_DOM_CLIENT__',
  '@storybook/icons': '__STORYBOOK_ICONS__',

  'storybook/internal/manager-api': '__STORYBOOK_API__',

  'storybook/internal/components': '__STORYBOOK_COMPONENTS__',

  'storybook/internal/channels': '__STORYBOOK_CHANNELS__',

  'storybook/internal/core-errors': '__STORYBOOK_CORE_EVENTS__',
  'storybook/internal/core-events': '__STORYBOOK_CORE_EVENTS__',

  'storybook/internal/manager-errors': '__STORYBOOK_CORE_EVENTS_MANAGER_ERRORS__',

  'storybook/internal/router': '__STORYBOOK_ROUTER__',
  '@storybook/router': '__STORYBOOK_ROUTER__',

  'storybook/internal/theming': '__STORYBOOK_THEMING__',
  'storybook/internal/theming/create': '__STORYBOOK_THEMING_CREATE__',

  'storybook/internal/client-logger': '__STORYBOOK_CLIENT_LOGGER__',

  'storybook/internal/types': '__STORYBOOK_TYPES__',
} as const;

export const globalPackages = Object.keys(globalsNameReferenceMap) as Array<
  keyof typeof globalsNameReferenceMap
>;
