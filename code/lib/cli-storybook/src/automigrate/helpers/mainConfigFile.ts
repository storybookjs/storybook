import { normalize } from 'node:path';

import { frameworkToRenderer } from 'storybook/internal/cli';
import {
  builderPackages,
  extractProperFrameworkName,
  frameworkPackages,
  getStorybookInfo,
  loadMainConfig,
  rendererPackages,
} from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import { getCoercedStorybookVersion } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import { readConfig, writeConfig as writeConfigFile } from 'storybook/internal/csf-tools';
import type { StorybookConfig, StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

const logger = console;

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

  return extractProperFrameworkName(packageNameOrPath);
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

/**
 * Given a Storybook configuration object, retrieves the package name or file path of the builder.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The package name of the builder. If not found, returns null.
 */
export const getBuilderPackageName = (mainConfig?: StorybookConfigRaw) => {
  const frameworkOptions = getFrameworkOptions(mainConfig);

  const frameworkBuilder = frameworkOptions?.builder;

  const frameworkBuilderName =
    typeof frameworkBuilder === 'string' ? frameworkBuilder : frameworkBuilder?.options?.name;

  const coreBuilderName =
    typeof mainConfig?.core?.builder === 'string'
      ? mainConfig.core.builder
      : mainConfig?.core?.builder?.name;

  const packageNameOrPath = coreBuilderName ?? frameworkBuilderName;

  if (!packageNameOrPath) {
    return null;
  }

  const normalizedPath = normalize(packageNameOrPath).replace(new RegExp(/\\/, 'g'), '/');

  return builderPackages.find((pkg) => normalizedPath.endsWith(pkg)) || packageNameOrPath;
};

/**
 * Given a Storybook configuration object, retrieves the configuration for the framework.
 *
 * @param mainConfig - The main Storybook configuration object to lookup.
 * @returns - The configuration for the framework. If not found, returns null.
 */
export const getFrameworkOptions = (
  mainConfig?: StorybookConfigRaw
): Record<string, any> | null => {
  return typeof mainConfig?.framework === 'string'
    ? null
    : (mainConfig?.framework?.options ?? null);
};

/**
 * Returns a renderer package name given a framework package name.
 *
 * @param frameworkPackageName - The package name of the framework to lookup.
 * @returns - The corresponding package name in `rendererPackages`. If not found, returns null.
 */
export const getRendererPackageNameFromFramework = (frameworkPackageName: string) => {
  if (frameworkPackageName) {
    if (Object.keys(rendererPackages).includes(frameworkPackageName)) {
      // at some point in 6.4 we introduced a framework field, but filled with a renderer package
      return frameworkPackageName;
    }

    if (Object.values(rendererPackages).includes(frameworkPackageName)) {
      // for scenarios where the value is e.g. "react" instead of "@storybook/react"
      return Object.keys(rendererPackages).find(
        (k) => rendererPackages[k] === frameworkPackageName
      );
    }
  }

  return null;
};

export const getStorybookData = async ({
  packageManager,
  configDir: userDefinedConfigDir,
}: {
  packageManager: JsPackageManager;
  configDir?: string;
}) => {
  const packageJson = await packageManager.retrievePackageJson();
  const {
    mainConfig: mainConfigPath,
    version: storybookVersionSpecifier,
    configDir: configDirFromScript,
    previewConfig: previewConfigPath,
  } = getStorybookInfo(packageJson, userDefinedConfigDir);
  const storybookVersion = await getCoercedStorybookVersion(packageManager);

  const configDir = userDefinedConfigDir || configDirFromScript || '.storybook';

  let mainConfig: StorybookConfigRaw;
  try {
    mainConfig = (await loadMainConfig({ configDir, noCache: true })) as StorybookConfigRaw;
  } catch (err) {
    throw new Error(
      dedent`Unable to find or evaluate ${picocolors.blue(mainConfigPath)}: ${String(err)}`
    );
  }

  return {
    configDir,
    mainConfig,
    storybookVersionSpecifier,
    storybookVersion,
    mainConfigPath,
    previewConfigPath,
  };
};
export type GetStorybookData = typeof getStorybookData;

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
    if (!dryRun) {
      await writeConfigFile(main);
    }
  } catch (e) {
    logger.info(
      `❌ The migration failed to update your ${picocolors.blue(
        mainConfigPath
      )} on your behalf because of the following error:
        ${e}\n`
    );
    logger.info(
      `⚠️ Storybook automigrations are based on AST parsing and it's possible that your ${picocolors.blue(
        mainConfigPath
      )} file contains a non-standard format (e.g. your export is not an object) or that there was an error when parsing dynamic values (e.g. "require" calls, or usage of environment variables). When your main config is non-standard, automigrations are unfortunately not possible. Please follow the instructions given previously and follow the documentation to make the updates manually.`
    );
  }
};

export const getAddonNames = (mainConfig: StorybookConfig): string[] => {
  const addons = mainConfig.addons || [];
  const addonList = addons.map((addon) => {
    let name = '';
    if (typeof addon === 'string') {
      name = addon;
    } else if (typeof addon === 'object') {
      name = addon.name;
    }

    if (name.startsWith('.')) {
      return undefined;
    }

    return name
      .replace(/\/dist\/.*/, '')
      .replace(/\.[mc]?[tj]?s[x]?$/, '')
      .replace(/\/register$/, '')
      .replace(/\/manager$/, '')
      .replace(/\/preset$/, '');
  });

  return addonList.filter((item): item is NonNullable<typeof item> => item != null);
};
