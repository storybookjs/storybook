import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CoreWebpackCompiler, SupportedFramework } from 'storybook/internal/types';
import type {
  CoreCommon_StorybookInfo,
  PackageJson,
  StorybookConfigRaw,
} from 'storybook/internal/types';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import invariant from 'tiny-invariant';

import { JsPackageManager } from '../js-package-manager/JsPackageManager';
import { frameworkToBuilder } from './framework';
import { getAddonNames } from './get-addon-names';
import { extractFrameworkPackageName } from './get-framework-name';
import { extractRenderer } from './get-renderer-name';
import { getStorybookConfiguration } from './get-storybook-configuration';
import { loadMainConfig } from './load-main-config';

export const rendererPackages: Record<string, SupportedRenderer> = {
  '@storybook/react': SupportedRenderer.REACT,
  '@storybook/vue3': SupportedRenderer.VUE3,
  '@storybook/angular': SupportedRenderer.ANGULAR,
  '@storybook/html': SupportedRenderer.HTML,
  '@storybook/web-components': SupportedRenderer.WEB_COMPONENTS,
  '@storybook/ember': SupportedRenderer.EMBER,
  '@storybook/svelte': SupportedRenderer.SVELTE,
  '@storybook/preact': SupportedRenderer.PREACT,
  '@storybook/server': SupportedRenderer.SERVER,
  '@storybook/react-native': SupportedRenderer.REACT_NATIVE,

  // community (outside of monorepo)
  'storybook-framework-qwik': SupportedRenderer.QWIK,
  'storybook-solidjs-vite': SupportedRenderer.SOLID,
  '@stencil/storybook-plugin': SupportedRenderer.STENCIL,
};

export const frameworkPackages: Record<string, SupportedFramework> = {
  '@storybook/angular': SupportedFramework.ANGULAR,
  '@storybook/ember': SupportedFramework.EMBER,
  '@storybook/html-vite': SupportedFramework.HTML_VITE,
  '@storybook/nextjs': SupportedFramework.NEXTJS,
  '@storybook/preact-vite': SupportedFramework.PREACT_VITE,
  '@storybook/react-vite': SupportedFramework.REACT_VITE,
  '@storybook/react-webpack5': SupportedFramework.REACT_WEBPACK5,
  '@storybook/server-webpack5': SupportedFramework.SERVER_WEBPACK5,
  '@storybook/svelte-vite': SupportedFramework.SVELTE_VITE,
  '@storybook/sveltekit': SupportedFramework.SVELTEKIT,
  '@storybook/vue3-vite': SupportedFramework.VUE3_VITE,
  '@storybook/nextjs-vite': SupportedFramework.NEXTJS_VITE,
  '@storybook/react-native-web-vite': SupportedFramework.REACT_NATIVE_WEB_VITE,
  '@storybook/web-components-vite': SupportedFramework.WEB_COMPONENTS_VITE,
  // community (outside of monorepo)
  'storybook-framework-qwik': SupportedFramework.QWIK,
  'storybook-solidjs-vite': SupportedFramework.SOLID,
  'storybook-react-rsbuild': SupportedFramework.REACT_RSBUILD,
  'storybook-vue3-rsbuild': SupportedFramework.VUE3_RSBUILD,
  'storybook-web-components-rsbuild': SupportedFramework.WEB_COMPONENTS_RSBUILD,
  'storybook-html-rsbuild': SupportedFramework.HTML_RSBUILD,
  '@storybook-vue/nuxt': SupportedFramework.NUXT,
  '@stencil/storybook-plugin': SupportedFramework.STENCIL,
};

export const builderPackages: Record<string, SupportedBuilder> = {
  '@storybook/builder-webpack5': SupportedBuilder.WEBPACK5,
  '@storybook/builder-vite': SupportedBuilder.VITE,
  // community (outside of monorepo)
  'storybook-builder-rsbuild': SupportedBuilder.RSBUILD,
  '@stencil/storybook-plugin': SupportedBuilder.STENCIL,
};

export const compilerPackages: Record<string, CoreWebpackCompiler> = {
  '@storybook/addon-webpack5-compiler-babel': CoreWebpackCompiler.Babel,
  '@storybook/addon-webpack5-compiler-swc': CoreWebpackCompiler.SWC,
};

const findDependency = (
  { dependencies, devDependencies, peerDependencies }: PackageJson,
  predicate: (entry: [string, string | undefined]) => boolean
) =>
  [
    Object.entries(dependencies || {}).find(predicate),
    Object.entries(devDependencies || {}).find(predicate),
    Object.entries(peerDependencies || {}).find(predicate),
  ] as const;

const getStorybookVersionSpecifier = (configDir: string) => {
  const packageJsonPaths = JsPackageManager.listAllPackageJsonPaths(dirname(configDir));

  for (const packageJsonPath of packageJsonPaths) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    // Pull the viewlayer from dependencies in package.json
    const [dep, devDep, peerDep] = findDependency(packageJson, ([key]) => key === 'storybook');
    const [pkg, version] = dep || devDep || peerDep || [];

    if (pkg && version) {
      return version;
    }
  }

  return undefined;
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

export const getStorybookInfo = async (
  configDir = '.storybook',
  cwd?: string
): Promise<CoreCommon_StorybookInfo> => {
  const configInfo = getConfigInfo(configDir);
  const mainConfig = (await loadMainConfig({
    configDir: configInfo.configDir,
    cwd,
  })) as StorybookConfigRaw;

  invariant(mainConfig, `Unable to find or evaluate ${configInfo.mainConfigPath}`);

  const frameworkValue = mainConfig.framework;
  const frameworkField = typeof frameworkValue === 'string' ? frameworkValue : frameworkValue?.name;
  const addons = getAddonNames(mainConfig);
  const versionSpecifier = getStorybookVersionSpecifier(configDir);

  if (!frameworkField) {
    return {
      ...configInfo,
      versionSpecifier,
      addons,
      mainConfig,
      mainConfigPath: configInfo.mainConfigPath ?? undefined,
      previewConfigPath: configInfo.previewConfigPath ?? undefined,
      managerConfigPath: configInfo.managerConfigPath ?? undefined,
    };
  }

  const frameworkPackage = extractFrameworkPackageName(frameworkField);

  const framework = frameworkPackages[frameworkPackage];
  const renderer = await extractRenderer(frameworkPackage);
  const builder = frameworkToBuilder[framework];

  const rendererPackage = Object.entries(rendererPackages).find(
    ([, value]) => value === renderer
  )?.[0];

  const builderPackage = Object.entries(builderPackages).find(
    ([, value]) => value === builder
  )?.[0];

  return {
    ...configInfo,
    addons,
    mainConfig,
    framework,
    versionSpecifier,
    renderer: renderer ?? undefined,
    builder: builder ?? undefined,
    frameworkPackage,
    rendererPackage,
    builderPackage,
    mainConfigPath: configInfo.mainConfigPath ?? undefined,
    previewConfigPath: configInfo.previewConfigPath ?? undefined,
    managerConfigPath: configInfo.managerConfigPath ?? undefined,
  };
};
