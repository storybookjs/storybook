import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type {
  CoreCommon_StorybookInfo,
  PackageJson,
  StorybookConfigRaw,
} from 'storybook/internal/types';
import { CoreWebpackCompiler, SupportedRenderer } from 'storybook/internal/types';

import invariant from 'tiny-invariant';

import { RN_FRAMEWORK_PACKAGE } from '../../shared/constants/config-folder.ts';
import { storybookConfigExtensions } from '../../shared/constants/extensions.ts';
import { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import {
  builderRegistry,
  frameworkPackages,
  frameworkToBuilder,
  rendererRegistry,
} from './framework.ts';
import { getAddonNames } from './get-addon-names.ts';
import { getFrameworkPackageName } from './get-framework-name.ts';
import { extractRenderer } from './get-renderer-name.ts';
import { getStorybookConfiguration } from './get-storybook-configuration.ts';
import { loadMainConfig } from './load-main-config.ts';

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

export const findConfigFile = (prefix: string, configDir: string) => {
  const filePrefix = join(configDir, prefix);
  const extension = storybookConfigExtensions.find((ext) => existsSync(`${filePrefix}${ext}`));
  return extension ? `${filePrefix}${extension}` : null;
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
  cwd?: string,
  { skipCache }: { skipCache?: boolean } = {}
): Promise<CoreCommon_StorybookInfo> => {
  const configInfo = getConfigInfo(configDir);
  const mainConfig = (await loadMainConfig({
    configDir: configInfo.configDir,
    cwd,
    // When the main config may have been rewritten earlier in the same process (e.g. an
    // automigration switching frameworks), callers must skip the module cache to read the
    // current on-disk config instead of a stale, previously-evaluated version.
    skipCache,
  })) as StorybookConfigRaw;

  invariant(mainConfig, `Unable to find or evaluate ${configInfo.mainConfigPath}`);

  const frameworkPackage = getFrameworkPackageName(mainConfig, configInfo.configDir);
  const addons = getAddonNames(mainConfig);
  const versionSpecifier = getStorybookVersionSpecifier(configDir);

  const base = {
    ...configInfo,
    versionSpecifier,
    addons,
    mainConfig,
    mainConfigPath: configInfo.mainConfigPath ?? undefined,
    previewConfigPath: configInfo.previewConfigPath ?? undefined,
    managerConfigPath: configInfo.managerConfigPath ?? undefined,
  };

  if (!frameworkPackage) {
    return base;
  }

  if (frameworkPackage === RN_FRAMEWORK_PACKAGE) {
    return {
      ...base,
      frameworkPackage,
      rendererPackage: RN_FRAMEWORK_PACKAGE,
      renderer: SupportedRenderer.REACT_NATIVE,
    };
  }

  const framework = frameworkPackages[frameworkPackage];
  const renderer = await extractRenderer(frameworkPackage);
  const builder = frameworkToBuilder[framework];

  const rendererPackage = renderer ? rendererRegistry[renderer].packageName : undefined;
  const builderPackage = builder ? builderRegistry[builder].packageName : undefined;

  return {
    ...base,
    framework,
    renderer: renderer ?? undefined,
    builder: builder ?? undefined,
    frameworkPackage,
    rendererPackage,
    builderPackage,
  };
};
