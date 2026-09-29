import { extractFrameworkPackageName, frameworkPackages } from 'storybook/internal/common';
import { frameworkToRenderer } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import { readConfig, writeConfig as writeConfigFile } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { assertConfigMutationSuccess } from './config-object.ts';

/**
 * Given a Storybook configuration object, retrieves the package name or file path of the framework.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The package name of the framework. If not found, returns null.
 */
export const getFrameworkPackageName = (mainConfig?: StorybookConfigRaw) => {
  const packageNameOrPath =
    typeof mainConfig?.framework === 'string' ? mainConfig.framework : mainConfig?.framework?.name;

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
export const getRendererName = (mainConfig?: StorybookConfigRaw) => {
  const frameworkPackageName = getFrameworkPackageName(mainConfig);

  if (!frameworkPackageName) {
    return null;
  }

  const frameworkName = frameworkPackages[frameworkPackageName];

  return frameworkToRenderer[frameworkName as keyof typeof frameworkToRenderer];
};

export { getStorybookData, type GetStorybookData } from 'storybook/internal/cli';

/**
 * A helper function to safely read and write the main config file. At the end of the callback,
 * main.js will be overwritten. If it fails, it will handle the error and log a message to the user
 * explaining what to do.
 *
 * It receives a mainConfigPath and a callback which will have access to utilities to manipulate
 * main.js.
 *
 * @example
 *
 * ```ts
 * await safeWriteMain({ mainConfigPath, dryRun }, async ({ main }) => {
 *   // manipulate main.js here
 * });
 * ```
 */
export const updateMainConfig = async (
  { mainConfigPath, dryRun }: { mainConfigPath: string; dryRun: boolean },
  callback: (main: ConfigFile) => Promise<void> | void
) => {
  try {
    const main = await readConfig(mainConfigPath);
    await callback(main);
    assertConfigMutationSuccess(main);
    if (!dryRun) {
      await writeConfigFile(main);
    }
  } catch (e) {
    logger.log(
      `❌ The migration failed to update your ${picocolors.blue(
        mainConfigPath
      )} on your behalf because of the following error:
        ${e}\n`
    );
    logger.log(
      `⚠️ Storybook automigrations are based on AST parsing and it's possible that your ${picocolors.blue(
        mainConfigPath
      )} file contains a non-standard format (e.g. your export is not an object) or that there was an error when parsing dynamic values (e.g. "require" calls, or usage of environment variables). When your main config is non-standard, automigrations are unfortunately not possible. Please follow the instructions given previously and follow the documentation to make the updates manually.`
    );
  }
};
