/**
 * Get additional dependencies required by @storybook/addon-a11y
 *
 * Note: addon-a11y doesn't require additional dependencies during init. It only runs an
 * automigration during postinstall to configure the addon for testing.
 */
export function getAddonA11yDependencies(): string[] {
  return [];
}
