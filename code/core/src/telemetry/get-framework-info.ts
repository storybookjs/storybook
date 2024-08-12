import path from 'node:path';

import { frameworkPackages } from '@storybook/core/common';
import type { PackageJson, StorybookConfig } from '@storybook/core/types';

import { getActualPackageJson } from './package-json';
import { cleanPaths } from './sanitize';

const knownRenderers = [
  'html',
  'react',
  'svelte',
  'vue3',
  'preact',
  'server',
  'vue',
  'web-components',
  'angular',
  'ember',
];

const knownBuilders = ['builder-webpack5', 'builder-vite'];

function findMatchingPackage(packageJson: PackageJson, suffixes: string[]) {
  const { name = '', version, dependencies, devDependencies, peerDependencies } = packageJson;

  const allDependencies = {
    // We include the framework itself because it may be a renderer too (e.g. angular)
    [name]: version,
    ...dependencies,
    ...devDependencies,
    ...peerDependencies,
  };

  return suffixes.map((suffix) => `@storybook/${suffix}`).find((pkg) => allDependencies[pkg]);
}

export const getFrameworkPackageName = (packageNameOrPath: string) => {
  const normalizedPath = path.normalize(packageNameOrPath).replace(new RegExp(/\\/, 'g'), '/');

  const knownFramework = Object.keys(frameworkPackages).find((pkg) => normalizedPath.endsWith(pkg));

  return knownFramework || cleanPaths(packageNameOrPath).replace(/.*node_modules[\\/]/, '');
};

export async function getFrameworkInfo(mainConfig: StorybookConfig) {
  if (!mainConfig?.framework) {
    return {};
  }

  const rawName =
    typeof mainConfig.framework === 'string' ? mainConfig.framework : mainConfig.framework?.name;
  if (!rawName) {
    return {};
  }

  const frameworkPackageJson = await getActualPackageJson(rawName);

  if (!frameworkPackageJson) {
    return {};
  }

  const builder = findMatchingPackage(frameworkPackageJson, knownBuilders);
  const renderer = findMatchingPackage(frameworkPackageJson, knownRenderers);

  // parse framework name and strip off pnp paths etc.
  const sanitizedFrameworkName = getFrameworkPackageName(rawName);
  const frameworkOptions =
    typeof mainConfig.framework === 'object' ? mainConfig.framework.options : {};

  return {
    framework: {
      name: sanitizedFrameworkName,
      options: frameworkOptions,
    },
    builder,
    renderer,
  };
}
