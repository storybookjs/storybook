import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  getStorybookConfiguration,
  getStorybookInfo,
  isCI,
  loadMainConfig,
  versions,
} from 'storybook/internal/common';
import { getInterpretedFile } from 'storybook/internal/common';
import { readConfig } from 'storybook/internal/csf-tools';
import type { PackageJson, StorybookConfig } from 'storybook/internal/types';

import * as pkg from 'empathic/package';

import { version } from '../../package.json';
import { globalSettings } from '../cli/globalSettings';
import { getApplicationFileCount } from './get-application-file-count';
import { getChromaticVersionSpecifier } from './get-chromatic-version';
import { getFrameworkInfo } from './get-framework-info';
import { getHasRouterPackage } from './get-has-router-package';
import { analyzeEcosystemPackages } from './get-known-packages';
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
  '@tanstack/react-router': 'tanstack-react',
  '@react-router/dev': 'react-router',
  '@remix-run/dev': 'remix',
} as Record<string, string>;

export const sanitizeAddonName = (name: string) => {
  const normalized = name.replace(/\\/g, '/');

  let candidate: string = normalized;

  if (normalized.includes('/node_modules/')) {
    // common case for package manager cache/pnp mode so we take the segment after node_modules
    candidate = normalized.split('/node_modules/').pop() ?? normalized;
  }

  const cleaned = cleanPaths(candidate)
    .replace(/^file:\/\//i, '')
    .replace(/\/+$/, '')
    .replace(/\/dist\/.*/, '')
    .replace(/\.[mc]?[tj]?s[x]?$/, '')
    .replace(/\/(register|manager|preset|index)$/, '')
    .replace(/\$SNIP?/g, '');

  let prefix = '';
  if(cleaned.startsWith('file') || cleaned.startsWith('.') || cleaned.startsWith('/') || cleaned.includes(':')) {
    prefix = 'CUSTOM:';
  }

  const scopedMatches = cleaned.match(/@[^/]+\/[^/]+/g);
  if (scopedMatches?.length) {
    return scopedMatches.at(-1) as string;
  }

  const parts = cleaned.split('/').filter(Boolean);
  const addonLike = [...parts].reverse().find((part) => part.includes('addon-') || part.includes('-addon'));

  if (addonLike) {
    return `${prefix}${addonLike}`;
  }

  if (parts.length >= 2 && parts[parts.length - 2].startsWith('@')) {
    return `${prefix}${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }

  if (parts.length) {
    return `${prefix}${parts[parts.length - 1]}`;
  }

  return `${prefix}${candidate}`;
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

  metadata.knownPackages = await analyzeEcosystemPackages(packageJson);
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

  const frameworkInfo = await getFrameworkInfo(mainConfig, configDir);

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

  const storybookInfo = await getStorybookInfo(configDir);

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
    storybookVersionSpecifier: storybookInfo.versionSpecifier ?? '',
    language,
    storybookPackages,
    addons,
    hasStorybookEslint,
    packageJsonType: packageJson.type ?? 'unknown',
  };
};

async function getPackageJsonDetails() {
  const packageJsonPath = pkg.up();
  if (packageJsonPath) {
    return {
      packageJsonPath,
      packageJson: JSON.parse(await readFile(packageJsonPath, 'utf8')),
    };
  }

  // If we don't find a `package.json`, we assume it "would have" been in the current working directory
  return {
    packageJsonPath: process.cwd(),
    packageJson: {},
  };
}

// Cache metadata keyed by a hash of the main config file to avoid caching
// empty/incorrect values during init flows when the configDir is created/updated.
const metadataCache = new Map<string, StorybookMetadata>();

async function hashMainConfig(configDir: string): Promise<string> {
  try {
    const mainPath = getInterpretedFile(resolve(configDir, 'main')) as string | null;

    if (!mainPath || !existsSync(mainPath)) {
      return 'missing';
    }
    const content = await readFile(mainPath);
    const hash = createHash('sha256').update(new Uint8Array(content)).digest('hex');
    return hash;
  } catch {
    return 'unknown';
  }
}

export const getStorybookMetadata = async (_configDir?: string) => {
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
  const contentHash = await hashMainConfig(configDir);
  const cacheKey = `${configDir}::${contentHash}`;
  const cached = metadataCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const mainConfig = await loadMainConfig({ configDir }).catch(() => undefined);
  const computed = await computeStorybookMetadata({
    mainConfig,
    packageJson,
    packageJsonPath,
    configDir,
  });
  metadataCache.set(cacheKey, computed);
  return computed;
};
