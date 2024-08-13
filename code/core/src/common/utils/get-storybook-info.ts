import { join } from 'node:path';

import type { SupportedFrameworks } from '@storybook/core/types';
import type { CoreCommon_StorybookInfo, PackageJson } from '@storybook/core/types';

import { pathExistsSync } from 'fs-extra';

import { getStorybookConfiguration } from './get-storybook-configuration';

export const rendererPackages: Record<string, string> = {
  '@storybook/react': 'react',
  '@storybook/vue3': 'vue3',
  '@storybook/angular': 'angular',
  '@storybook/html': 'html',
  '@storybook/web-components': 'web-components',
  '@storybook/polymer': 'polymer',
  '@storybook/ember': 'ember',
  '@storybook/svelte': 'svelte',
  '@storybook/preact': 'preact',
  '@storybook/server': 'server',

  // community (outside of monorepo)
  'storybook-framework-qwik': 'qwik',
  'storybook-solidjs': 'solid',

  /**
   * @deprecated This is deprecated.
   */
  '@storybook/vue': 'vue',
};

export const frameworkPackages: Record<string, SupportedFrameworks> = {
  '@storybook/angular': 'angular',
  '@storybook/ember': 'ember',
  '@storybook/html-vite': 'html-vite',
  '@storybook/html-webpack5': 'html-webpack5',
  '@storybook/nextjs': 'nextjs',
  '@storybook/preact-vite': 'preact-vite',
  '@storybook/preact-webpack5': 'preact-webpack5',
  '@storybook/react-vite': 'react-vite',
  '@storybook/react-webpack5': 'react-webpack5',
  '@storybook/server-webpack5': 'server-webpack5',
  '@storybook/svelte-vite': 'svelte-vite',
  '@storybook/svelte-webpack5': 'svelte-webpack5',
  '@storybook/sveltekit': 'sveltekit',
  '@storybook/vue3-vite': 'vue3-vite',
  '@storybook/vue3-webpack5': 'vue3-webpack5',
  '@storybook/web-components-vite': 'web-components-vite',
  '@storybook/web-components-webpack5': 'web-components-webpack5',
  // community (outside of monorepo)
  'storybook-framework-qwik': 'qwik',
  'storybook-solidjs-vite': 'solid',
};

export const builderPackages = ['@storybook/builder-webpack5', '@storybook/builder-vite'];

const logger = console;

const findDependency = (
  { dependencies, devDependencies, peerDependencies }: PackageJson,
  predicate: (entry: [string, string | undefined]) => string
) =>
  [
    Object.entries(dependencies || {}).find(predicate),
    Object.entries(devDependencies || {}).find(predicate),
    Object.entries(peerDependencies || {}).find(predicate),
  ] as const;

const getRendererInfo = (packageJson: PackageJson) => {
  // Pull the viewlayer from dependencies in package.json
  const [dep, devDep, peerDep] = findDependency(packageJson, ([key]) => rendererPackages[key]);
  const [pkg, version] = dep || devDep || peerDep || [];

  if (dep && devDep && dep[0] === devDep[0]) {
    logger.warn(
      `Found "${dep[0]}" in both "dependencies" and "devDependencies". This is probably a mistake.`
    );
  }
  if (dep && peerDep && dep[0] === peerDep[0]) {
    logger.warn(
      `Found "${dep[0]}" in both "dependencies" and "peerDependencies". This is probably a mistake.`
    );
  }

  return {
    version,
    frameworkPackage: pkg,
  };
};

const validConfigExtensions = ['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs'];

export const findConfigFile = (prefix: string, configDir: string) => {
  const filePrefix = join(configDir, prefix);
  const extension = validConfigExtensions.find((ext: string) =>
    pathExistsSync(`${filePrefix}.${ext}`)
  );
  return extension ? `${filePrefix}.${extension}` : null;
};

export const getConfigInfo = (packageJson: PackageJson, configDir?: string) => {
  let storybookConfigDir = configDir ?? '.storybook';
  const storybookScript = packageJson.scripts?.storybook;
  if (storybookScript && !configDir) {
    const configParam = getStorybookConfiguration(storybookScript, '-c', '--config-dir');
    if (configParam) storybookConfigDir = configParam;
  }

  return {
    configDir: storybookConfigDir,
    mainConfig: findConfigFile('main', storybookConfigDir),
    previewConfig: findConfigFile('preview', storybookConfigDir),
    managerConfig: findConfigFile('manager', storybookConfigDir),
  };
};

export const getStorybookInfo = (packageJson: PackageJson, configDir?: string) => {
  const rendererInfo = getRendererInfo(packageJson);
  const configInfo = getConfigInfo(packageJson, configDir);

  return {
    ...rendererInfo,
    ...configInfo,
  } as CoreCommon_StorybookInfo;
};
