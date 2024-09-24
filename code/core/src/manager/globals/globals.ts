// Here we map the name of a module to their REFERENCE in the global scope.
export const globalsNameReferenceMap = {
  react: '__REACT__',
  'react-dom': '__REACT_DOM__',
  'react-dom/client': '__REACT_DOM_CLIENT__',
  '@storybook/icons': '__STORYBOOK_ICONS__',

  'storybook/internal/manager-api': '__STORYBOOK_API__',
  '@storybook/manager-api': '__STORYBOOK_API__',
  '@storybook/core/manager-api': '__STORYBOOK_API__',

  'storybook/internal/components': '__STORYBOOK_COMPONENTS__',
  '@storybook/components': '__STORYBOOK_COMPONENTS__',
  '@storybook/core/components': '__STORYBOOK_COMPONENTS__',

  'storybook/internal/channels': '__STORYBOOK_CHANNELS__',
  '@storybook/channels': '__STORYBOOK_CHANNELS__',
  '@storybook/core/channels': '__STORYBOOK_CHANNELS__',

  'storybook/internal/core-errors': '__STORYBOOK_CORE_EVENTS__',
  '@storybook/core-events': '__STORYBOOK_CORE_EVENTS__',
  '@storybook/core/core-events': '__STORYBOOK_CORE_EVENTS__',

  'storybook/internal/manager-errors': '__STORYBOOK_CORE_EVENTS_MANAGER_ERRORS__',
  '@storybook/core-events/manager-errors': '__STORYBOOK_CORE_EVENTS_MANAGER_ERRORS__',
  '@storybook/core/manager-errors': '__STORYBOOK_CORE_EVENTS_MANAGER_ERRORS__',

  'storybook/internal/router': '__STORYBOOK_ROUTER__',
  '@storybook/router': '__STORYBOOK_ROUTER__',
  '@storybook/core/router': '__STORYBOOK_ROUTER__',

  'storybook/internal/theming': '__STORYBOOK_THEMING__',
  '@storybook/theming': '__STORYBOOK_THEMING__',
  '@storybook/core/theming': '__STORYBOOK_THEMING__',
  'storybook/internal/theming/create': '__STORYBOOK_THEMING_CREATE__',
  '@storybook/theming/create': '__STORYBOOK_THEMING_CREATE__',
  '@storybook/core/theming/create': '__STORYBOOK_THEMING_CREATE__',

  'storybook/internal/client-logger': '__STORYBOOK_CLIENT_LOGGER__',
  '@storybook/client-logger': '__STORYBOOK_CLIENT_LOGGER__',
  '@storybook/core/client-logger': '__STORYBOOK_CLIENT_LOGGER__',

  'storybook/internal/types': '__STORYBOOK_TYPES__',
  '@storybook/types': '__STORYBOOK_TYPES__',
  '@storybook/core/types': '__STORYBOOK_TYPES__',
} as const;

export const globalPackages = Object.keys(globalsNameReferenceMap) as Array<
  keyof typeof globalsNameReferenceMap
>;
