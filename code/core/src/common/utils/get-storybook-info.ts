import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type {
  CoreCommon_StorybookInfo,
  PackageJson,
  SupportedFrameworks,
} from 'storybook/internal/types';

import { JsPackageManager } from '../js-package-manager/JsPackageManager';
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
  'storybook-solidjs-vite': 'solid',

  /** @deprecated This is deprecated. */
  '@storybook/vue': 'vue',
};

export const frameworkPackages: Record<string, SupportedFrameworks> = {
  '@storybook/angular': 'angular',
  '@storybook/ember': 'ember',
  '@storybook/html-vite': 'html-vite',
  '@storybook/nextjs': 'nextjs',
  '@storybook/preact-vite': 'preact-vite',
  '@storybook/react-vite': 'react-vite',
  '@storybook/react-webpack5': 'react-webpack5',
  '@storybook/server-webpack5': 'server-webpack5',
  '@storybook/svelte-vite': 'svelte-vite',
  '@storybook/sveltekit': 'sveltekit',
  '@storybook/vue3-vite': 'vue3-vite',
  '@storybook/nextjs-vite': 'nextjs-vite',
  '@storybook/react-native-web-vite': 'react-native-web-vite',
  '@storybook/web-components-vite': 'web-components-vite',
  // community (outside of monorepo)
  'storybook-framework-qwik': 'qwik',
  'storybook-solidjs-vite': 'solid',
  'storybook-react-rsbuild': 'react-rsbuild',
  'storybook-vue3-rsbuild': 'vue3-rsbuild',
};

export const builderPackages = ['@storybook/builder-webpack5', '@storybook/builder-vite'];

const findDependency = (
  { dependencies, devDependencies, peerDependencies }: PackageJson,
  predicate: (entry: [string, string | undefined]) => string
) =>
  [
    Object.entries(dependencies || {}).find(predicate),
    Object.entries(devDependencies || {}).find(predicate),
    Object.entries(peerDependencies || {}).find(predicate),
  ] as const;

const getRendererInfo = (configDir: string) => {
  const packageJsonPaths = JsPackageManager.listAllPackageJsonPaths(dirname(configDir));

  for (const packageJsonPath of packageJsonPaths) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    // Pull the viewlayer from dependencies in package.json
    const [dep, devDep, peerDep] = findDependency(packageJson, ([key]) => rendererPackages[key]);
    const [pkg, version] = dep || devDep || peerDep || [];

    if (pkg && version) {
      return {
        version,
        frameworkPackage: pkg,
      };
    }
  }

  return {
    version: undefined,
    frameworkPackage: undefined,
  };
};

const validConfigExtensions = ['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs'];

export const findConfigFile = (prefix: string, configDir: string) => {
  const filePrefix = join(configDir, prefix);
  const extension = validConfigExtensions.find((ext: string) => existsSync(`${filePrefix}.${ext}`));
  return extension ? `${filePrefix}.${extension}` : null;
};

export const getConfigInfo = (configDir?: string) => {
  let storybookConfigDir = configDir ?? '.storybook';

  if (!existsSync(storybookConfigDir)) {
    const packageJsonPaths = JsPackageManager.listAllPackageJsonPaths(storybookConfigDir);

    for (const packageJsonPath of packageJsonPaths) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const storybookScript = packageJson.scripts?.storybook;
      if (storybookScript && !configDir) {
        const configParam = getStorybookConfiguration(storybookScript, '-c', '--config-dir');

        if (configParam) {
          storybookConfigDir = configParam;
          break;
        }
      }
    }
  }

  return {
    configDir: storybookConfigDir,
    mainConfigPath: findConfigFile('main', storybookConfigDir),
    previewConfigPath: findConfigFile('preview', storybookConfigDir),
    managerConfigPath: findConfigFile('manager', storybookConfigDir),
  };
};

export const getStorybookInfo = (configDir = '.storybook') => {
  const rendererInfo = getRendererInfo(configDir);
  const configInfo = getConfigInfo(configDir);

  return {
    ...rendererInfo,
    ...configInfo,
  } as CoreCommon_StorybookInfo;
};
