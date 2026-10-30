/** Manager API specifiers recognized in manager config files. `storybook/internal/manager-api` is legacy (no export since Storybook 10, still seen when upgrading from Storybook 9); do not delete. */
export const managerApiPackages = new Set([
  'storybook/manager-api',
  'storybook/internal/manager-api',
  '@storybook/manager-api',
]);
