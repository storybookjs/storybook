/**
 * Consolidated packages are packages that have been merged into the main storybook package. This
 * object maps the old package name to the new package name.
 */
export const consolidatedPackages = {
  '@storybook/channels': 'storybook/internal/channels',
  '@storybook/client-logger': 'storybook/internal/client-logger',
  '@storybook/core-common': 'storybook/internal/common',
  '@storybook/core-events': 'storybook/internal/core-events',
  '@storybook/csf': 'storybook/internal/csf',
  '@storybook/csf-tools': 'storybook/internal/csf-tools',
  '@storybook/docs-tools': 'storybook/internal/docs-tools',
  '@storybook/node-logger': 'storybook/internal/node-logger',
  '@storybook/preview-api': 'storybook/preview-api',
  '@storybook/router': 'storybook/internal/router',
  '@storybook/telemetry': 'storybook/internal/telemetry',
  '@storybook/theming': 'storybook/theming',
  '@storybook/types': 'storybook/internal/types',
  '@storybook/manager-api': 'storybook/manager-api',
  '@storybook/manager': 'storybook/internal/manager',
  '@storybook/preview': 'storybook/internal/preview',
  '@storybook/core-server': 'storybook/internal/core-server',
  '@storybook/builder-manager': 'storybook/internal/builder-manager',
  '@storybook/components': 'storybook/internal/components',
  '@storybook/test': 'storybook/test',
  '@storybook/experimental-nextjs-vite': '@storybook/nextjs-vite',
  '@storybook/instrumenter': 'storybook/internal/instrumenter',
  '@storybook/blocks': '@storybook/addon-docs/blocks',
} as const;

export type ConsolidatedPackage = keyof typeof consolidatedPackages;
