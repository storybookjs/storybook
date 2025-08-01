import { dirname } from 'node:path';

import {
  getStorybookConfiguration,
  getStorybookInfo,
  isCI,
  loadMainConfig,
  versions,
} from 'storybook/internal/common';
import { readConfig } from 'storybook/internal/csf-tools';
import type { PackageJson, StorybookConfig } from 'storybook/internal/types';

import { findPackage, findPackagePath } from 'fd-package-json';

import { version } from '../../package.json';
import { globalSettings } from '../cli/globalSettings';
import { getApplicationFileCount } from './get-application-file-count';
import { getChromaticVersionSpecifier } from './get-chromatic-version';
import { getFrameworkInfo } from './get-framework-info';
import { getHasRouterPackage } from './get-has-router-package';
import { getMonorepoType } from './get-monorepo-type';
import { getPackageManagerInfo } from './get-package-manager-info';
import { getPortableStoriesFileCount } from './get-portable-stories-usage';
import { getActualPackageVersion, getActualPackageVersions } from './package-json';
import { cleanPaths } from './sanitize';
import type { Dependency, StorybookAddon, StorybookMetadata } from './types';

export const metaFrameworks = {
  next: 'Next',
  'react-scripts': 'CRA',
  gatsby: 'Gatsby',
  '@nuxtjs/storybook': 'nuxt',
  '@nrwl/storybook': 'nx',
  '@vue/cli-service': 'vue-cli',
  '@sveltejs/kit': 'sveltekit',
} as Record<string, string>;

export const sanitizeAddonName = (name: string) => {
  return cleanPaths(name)
    .replace(/\/dist\/.*/, '')
    .replace(/\.[mc]?[tj]?s[x]?$/, '')
    .replace(/\/register$/, '')
    .replace(/\/manager$/, '')
    .replace(/\/preset$/, '');
};

// Analyze a combination of information from main.js and package.json
// to provide telemetry over a Storybook project
export const computeStorybookMetadata = async ({
  packageJsonPath,
  packageJson,
  mainConfig,
  configDir,
}: {
  packageJsonPath: string;
  packageJson: PackageJson;
  mainConfig?: StorybookConfig & Record<string, any>;
  configDir: string;
}): Promise<StorybookMetadata> => {
  const settings = isCI() ? undefined : await globalSettings();
  const metadata: Partial<StorybookMetadata> = {
    generatedAt: new Date().getTime(),
    userSince: settings?.value.userSince,
    hasCustomBabel: false,
    hasCustomWebpack: false,
    hasStaticDirs: false,
    hasStorybookEslint: false,
    refCount: 0,
  };

  const allDependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
    ...packageJson?.peerDependencies,
  };

  const metaFramework = Object.keys(allDependencies).find((dep) => !!metaFrameworks[dep]);
  if (metaFramework) {
    const { version } = await getActualPackageVersion(metaFramework);
    metadata.metaFramework = {
      name: metaFrameworks[metaFramework],
      packageName: metaFramework,
      version: version || 'unknown',
    };
  }

  const testPackages = [
    'playwright',
    'vitest',
    'jest',
    'cypress',
    'nightwatch',
    'webdriver',
    '@web/test-runner',
    'puppeteer',
    'karma',
    'jasmine',
    'chai',
    'testing-library',
    '@ngneat/spectator',
    'wdio',
    'msw',
    'miragejs',
    'sinon',
    'chromatic',
  ];
  const testPackageDeps = Object.keys(allDependencies).filter((dep) =>
    testPackages.find((pkg) => dep.includes(pkg))
  );
  metadata.testPackages = Object.fromEntries(
    await Promise.all(
      testPackageDeps.map(async (dep) => [dep, (await getActualPackageVersion(dep))?.version])
    )
  );

  metadata.hasRouterPackage = getHasRouterPackage(packageJson);

  const monorepoType = getMonorepoType();
  if (monorepoType) {
    metadata.monorepo = monorepoType;
  }

  metadata.packageManager = await getPackageManagerInfo();

  const language = allDependencies.typescript ? 'typescript' : 'javascript';

  if (!mainConfig) {
    return {
      ...metadata,
      storybookVersionSpecifier: versions.storybook,
      language,
    };
  }
  metadata.hasCustomBabel = !!mainConfig.babel;
  metadata.hasCustomWebpack = !!mainConfig.webpackFinal;
  metadata.hasStaticDirs = !!mainConfig.staticDirs;

  if (typeof mainConfig.typescript === 'object') {
    metadata.typescriptOptions = mainConfig.typescript;
  }

  const frameworkInfo = await getFrameworkInfo(mainConfig);

  if (typeof mainConfig.refs === 'object') {
    metadata.refCount = Object.keys(mainConfig.refs).length;
  }

  if (typeof mainConfig.features === 'object') {
    metadata.features = mainConfig.features;
  }

  const addons: Record<string, StorybookAddon> = {};
  if (mainConfig.addons) {
    mainConfig.addons.forEach((addon) => {
      let addonName;
      let options;

      if (typeof addon === 'string') {
        addonName = sanitizeAddonName(addon);
      } else {
        if (addon.name.includes('addon-essentials')) {
          options = addon.options;
        }
        addonName = sanitizeAddonName(addon.name);
      }

      addons[addonName] = {
        options,
        version: undefined,
      };
    });
  }

  const chromaticVersionSpecifier = getChromaticVersionSpecifier(packageJson);
  if (chromaticVersionSpecifier) {
    addons.chromatic = {
      version: undefined,
      versionSpecifier: chromaticVersionSpecifier,
      options: undefined,
    };
  }

  const addonVersions = await getActualPackageVersions(addons);
  addonVersions.forEach(({ name, version }) => {
    addons[name] = addons[name] || {
      name,
      version,
    };
    addons[name].version = version || undefined;
  });

  const addonNames = Object.keys(addons);

  // all Storybook deps minus the addons
  const storybookPackages = Object.keys(allDependencies)
    .filter((dep) => dep.includes('storybook') && !addonNames.includes(dep))
    .reduce((acc, dep) => {
      return {
        ...acc,
        [dep]: { version: undefined },
      };
    }, {}) as Record<string, Dependency>;

  const storybookPackageVersions = await getActualPackageVersions(storybookPackages);
  storybookPackageVersions.forEach(({ name, version }) => {
    storybookPackages[name] = storybookPackages[name] || {
      name,
      version,
    };

    storybookPackages[name].version = version || undefined;
  });

  const hasStorybookEslint = !!allDependencies['eslint-plugin-storybook'];

  const storybookInfo = getStorybookInfo(configDir);

  try {
    const { previewConfigPath: previewConfig } = storybookInfo;
    if (previewConfig) {
      const config = await readConfig(previewConfig);
      const usesGlobals = !!(
        config.getFieldNode(['globals']) || config.getFieldNode(['globalTypes'])
      );
      metadata.preview = { ...metadata.preview, usesGlobals };
    }
  } catch (e) {
    // gracefully handle error, as it's not critical information and AST parsing can cause trouble
  }

  const portableStoriesFileCount = await getPortableStoriesFileCount();
  const applicationFileCount = await getApplicationFileCount(dirname(packageJsonPath));

  return {
    ...metadata,
    ...frameworkInfo,
    portableStoriesFileCount,
    applicationFileCount,
    storybookVersion: version,
    storybookVersionSpecifier: storybookInfo.version,
    language,
    storybookPackages,
    addons,
    hasStorybookEslint,
  };
};

async function getPackageJsonDetails() {
  const packageJsonPath = await findPackagePath(process.cwd());
  if (packageJsonPath) {
    return {
      packageJsonPath,
      packageJson: (await findPackage(packageJsonPath)) || {},
    };
  }

  // If we don't find a `package.json`, we assume it "would have" been in the current working directory
  return {
    packageJsonPath: process.cwd(),
    packageJson: {},
  };
}

let cachedMetadata: StorybookMetadata;
export const getStorybookMetadata = async (_configDir?: string) => {
  if (cachedMetadata) {
    return cachedMetadata;
  }

  const { packageJson, packageJsonPath } = await getPackageJsonDetails();
  // TODO: improve the way configDir is extracted, as a "storybook" script might not be present
  // Scenarios:
  // 1. user changed it to something else e.g. "storybook:dev"
  // 2. they are using angular/nx where the storybook config is defined somewhere else
  const configDir =
    (_configDir ||
      (getStorybookConfiguration(
        String((packageJson?.scripts as Record<string, unknown> | undefined)?.storybook || ''),
        '-c',
        '--config-dir'
      ) as string)) ??
    '.storybook';
  const mainConfig = await loadMainConfig({ configDir }).catch(() => undefined);
  cachedMetadata = await computeStorybookMetadata({
    mainConfig,
    packageJson,
    packageJsonPath,
    configDir,
  });
  return cachedMetadata;
};
