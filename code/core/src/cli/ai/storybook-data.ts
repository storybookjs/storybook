import { dirname, isAbsolute, join } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { JsPackageManagerFactory, getStorybookInfo } from 'storybook/internal/common';
import { getStoriesPathsFromConfig } from 'storybook/internal/core-server';
import { isCsfFactoryPreview, readConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

/** Gathers the project metadata `storybook ai setup` needs from the target Storybook. */
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
    configDir: configDirFromScript,
    previewConfigPath,
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
    versionInstalled,
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
