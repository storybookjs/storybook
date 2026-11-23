import { frameworkPackages, getFrameworkPackageName } from 'storybook/internal/common';
import { frameworkToRenderer } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

/**
 * Given a Storybook configuration object, retrieves the inferred renderer name from the framework.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The renderer name. If not found, returns null.
 */
export const getRendererName = (mainConfig?: StorybookConfigRaw) => {
  const frameworkPackageName = getFrameworkPackageName(mainConfig);

  if (!frameworkPackageName) {
    return null;
  }

  const frameworkName = frameworkPackages[frameworkPackageName];

  return frameworkToRenderer[frameworkName as keyof typeof frameworkToRenderer];
};

export { getStorybookData, type GetStorybookData } from 'storybook/internal/cli';
