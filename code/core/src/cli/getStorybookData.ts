import { dirname, isAbsolute, join } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { JsPackageManagerFactory, getStorybookInfo } from 'storybook/internal/common';
import { getStoriesPathsFromConfig } from 'storybook/internal/core-server';
import { isCsfFactoryPreview, readConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

/**
 * Gathers the project metadata CLI commands need from the target Storybook: config, framework,
 * package manager, installed version, and story paths. The canonical collector — `automigrate`,
 * `doctor`, `add`, and `ai setup` all consume it.
 */
export const getStorybookData = async ({
  configDir: userDefinedConfigDir,
  packageManagerName,
}: {
  configDir?: string;
  packageManagerName?: PackageManagerName;
}) => {
  logger.debug('Getting Storybook info...');
  const {
    mainConfig,
    mainConfigPath,
    configDir: configDirFromScript,
    previewConfigPath,
    versionSpecifier,
    frameworkPackage,
    rendererPackage,
    renderer,
    builderPackage,
    addons,
  } = await getStorybookInfo(
    userDefinedConfigDir,
    userDefinedConfigDir ? dirname(userDefinedConfigDir) : undefined
  );

  const configDir = userDefinedConfigDir || configDirFromScript || '.storybook';

  const workingDir = isAbsolute(configDir)
    ? dirname(configDir)
    : dirname(join(process.cwd(), configDir));

  logger.debug('Getting stories paths...');
  const storiesPaths = await getStoriesPathsFromConfig({
    stories: mainConfig.stories,
    configDir,
    workingDir,
  });

  logger.debug('Getting package manager...');
  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: packageManagerName,
    configDir,
    storiesPaths,
  });

  logger.debug('Getting Storybook version...');
  const versionInstalled = (await packageManager.getModulePackageJSON('storybook'))?.version;

  logger.debug('Detecting CSF factory usage...');
  const hasCsfFactoryPreview = previewConfigPath
    ? isCsfFactoryPreview(await readConfig(previewConfigPath))
    : false;

  return {
    configDir,
    workingDir,
    mainConfig,
    /** The version specifier of Storybook from the user's package.json */
    versionSpecifier,
    /** The version of Storybook installed in the user's project */
    versionInstalled,
    mainConfigPath,
    previewConfigPath,
    packageManager,
    storiesPaths,
    hasCsfFactoryPreview,
    frameworkPackage,
    rendererPackage,
    renderer,
    builderPackage,
    addons,
  };
};

export type GetStorybookData = typeof getStorybookData;
