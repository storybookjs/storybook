import {
  extractFrameworkPackageName,
  frameworkPackages,
  getFrameworkNameFromConfig,
} from 'storybook/internal/common';
import { frameworkToRenderer } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/instance';

/**
 * Given a Storybook configuration object, retrieves the package name or file path of the framework.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The package name of the framework. If not found, returns null.
 */
export const getFrameworkPackageName = (mainConfig?: Pick<StorybookConfig, 'framework'>) => {
  const packageNameOrPath = getFrameworkNameFromConfig(mainConfig?.framework);

  if (!packageNameOrPath) {
    return null;
  }

  return extractFrameworkPackageName(packageNameOrPath);
};

/**
 * Given a Storybook configuration object, retrieves the inferred renderer name from the framework.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The renderer name. If not found, returns null.
 */
export const getRendererName = (mainConfig?: Pick<StorybookConfig, 'framework'>) => {
  const frameworkPackageName = getFrameworkPackageName(mainConfig);

  if (!frameworkPackageName) {
    return null;
  }

  const frameworkName = frameworkPackages[frameworkPackageName];

  return frameworkToRenderer[frameworkName as keyof typeof frameworkToRenderer];
};

export { getStorybookData, type GetStorybookData } from 'storybook/internal/cli';
