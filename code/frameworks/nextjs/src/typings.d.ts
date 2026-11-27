declare var FEATURES: import('storybook/internal/types').StorybookConfigRaw['features'];

declare module 'sb-original/react/jsx-runtime' {
  export * from 'react/jsx-runtime';
}

declare module 'sb-original/react/jsx-dev-runtime' {
  export * from 'react/jsx-dev-runtime';
}
