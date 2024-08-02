import { findPackage } from 'fd-package-json';
import { detect, getNpmVersion } from 'detect-package-manager';
import {
  loadMainConfig,
  getStorybookInfo,
  getStorybookConfiguration,
  getProjectRoot,
} from '@storybook/core/common';
import type { StorybookConfig, PackageJson } from '@storybook/core/types';
import { readConfig } from '@storybook/core/csf-tools';

import type { StorybookMetadata, Dependency, StorybookAddon } from './types';
import { getActualPackageVersion, getActualPackageVersions } from './package-json';
import { getMonorepoType } from './get-monorepo-type';
import { cleanPaths } from './sanitize';
import { getFrameworkInfo } from './get-framework-info';
import { getChromaticVersionSpecifier } from './get-chromatic-version';

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
  packageJson,
  mainConfig,
}: {
  packageJson: PackageJson;
  mainConfig: StorybookConfig & Record<string, any>;
}): Promise<StorybookMetadata> => {
  const metadata: Partial<StorybookMetadata> = {
    generatedAt: new Date().getTime(),
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
      version,
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
    'vite-plugin-storybook-nextjs',
  ];
  const testPackageDeps = Object.keys(allDependencies).filter((dep) =>
    testPackages.find((pkg) => dep.includes(pkg))
  );
  metadata.testPackages = Object.fromEntries(
    await Promise.all(
      testPackageDeps.map(async (dep) => [dep, (await getActualPackageVersion(dep))?.version])
    )
  );

  const monorepoType = getMonorepoType();
  if (monorepoType) {
    metadata.monorepo = monorepoType;
  }

  try {
    const packageManagerType = await detect({ cwd: getProjectRoot() });
    const packageManagerVersion = await getNpmVersion(packageManagerType);

    metadata.packageManager = {
      type: packageManagerType,
      version: packageManagerVersion,
    };
    // Better be safe than sorry, some codebases/paths might end up breaking with something like "spawn pnpm ENOENT"
    // so we just set the package manager if the detection is successful
  } catch (err) {}

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
    addons[name].version = version;
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
    storybookPackages[name].version = version;
  });

  const language = allDependencies.typescript ? 'typescript' : 'javascript';

  const hasStorybookEslint = !!allDependencies['eslint-plugin-storybook'];

  const storybookInfo = getStorybookInfo(packageJson);

  try {
    const { previewConfig } = storybookInfo;
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

  const storybookVersion = storybookPackages[storybookInfo.frameworkPackage]?.version;

  return {
    ...metadata,
    ...frameworkInfo,
    storybookVersion,
    storybookVersionSpecifier: storybookInfo.version,
    language,
    storybookPackages,
    addons,
    hasStorybookEslint,
  };
};

let cachedMetadata: StorybookMetadata;
export const getStorybookMetadata = async (_configDir?: string) => {
  if (cachedMetadata) {
    return cachedMetadata;
  }

  const packageJson = (await findPackage(process.cwd())) || {};
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
  const mainConfig = await loadMainConfig({ configDir });
  cachedMetadata = await computeStorybookMetadata({ mainConfig, packageJson });
  return cachedMetadata;
};
