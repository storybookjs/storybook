import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import type {
  CoreCommon_StorybookInfo,
  PackageJson,
  StorybookConfigRaw,
} from 'storybook/internal/types';
import { CoreWebpackCompiler, SupportedRenderer } from 'storybook/internal/types';

import invariant from 'tiny-invariant';

import { RN_STORYBOOK_DIR } from '../../shared/constants/config-folder.ts';
import { storybookConfigExtensions } from '../../shared/constants/extensions.ts';
import { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import {
  builderRegistry,
  frameworkPackages,
  frameworkToBuilder,
  rendererRegistry,
} from './framework.ts';
import { getAddonNames } from './get-addon-names.ts';
import { extractFrameworkPackageName } from './get-framework-name.ts';
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

  const frameworkValue = mainConfig.framework;
  const frameworkField =
    (typeof frameworkValue === 'string' ? frameworkValue : frameworkValue?.name) ||
    /*
      React Native on-device Storybook historically omitted `framework` from main.ts.
      When the config lives in `.rnstorybook`, infer the framework so telemetry
      `metadata.framework.name` is populated for existing projects (scoped to the
      RN config dir to avoid mis-attributing web Storybooks in the same monorepo).
    */
    (basename(configInfo.configDir) === RN_STORYBOOK_DIR
      ? rendererRegistry[SupportedRenderer.REACT_NATIVE].packageName
      : undefined);
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

  const rendererPackage = renderer ? rendererRegistry[renderer].packageName : undefined;
  const builderPackage = builder ? builderRegistry[builder].packageName : undefined;

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
