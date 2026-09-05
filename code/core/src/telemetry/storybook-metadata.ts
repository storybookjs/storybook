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

import { RN_STORYBOOK_DIR } from '../shared/constants/config-folder.ts';

import * as pkg from 'empathic/package';

import { version } from '../../package.json';
import { globalSettings } from '../cli/globalSettings.ts';
import { detectAgent } from './detect-agent.ts';
import { getApplicationFileCount } from './get-application-file-count.ts';
import { getChromaticVersionSpecifier } from './get-chromatic-version.ts';
import { getFrameworkInfo } from './get-framework-info.ts';
import { getHasModuleFederation } from './get-has-module-federation.ts';
import { getHasRouterPackage } from './get-has-router-package.ts';
import { getHasNextCustomWebpack } from './get-has-next-custom-webpack.ts';
import { getRendererPackages } from './get-renderer-packages.ts';
import { getHasTurbopack } from './get-has-turbopack.ts';
import { analyzeEcosystemPackages } from './get-known-packages.ts';
import { getMonorepoType } from '../shared/utils/get-monorepo-type.ts';
import { getPackageManagerInfo } from './get-package-manager-info.ts';
import { getPortableStoriesFileCount } from './get-portable-stories-usage.ts';
import { getActualPackageVersion, getActualPackageVersions } from './package-json.ts';
import { cleanPaths } from './sanitize.ts';
import type { Dependency, StorybookAddon, StorybookMetadata } from './types.ts';

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
  expo: 'expo',
  'vike-react': 'vike-react',
  'vike-vue': 'vike-vue',
  'vike-solid': 'vike-solid',
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
  if (
    cleaned.startsWith('file') ||
    cleaned.startsWith('.') ||
    cleaned.startsWith('/') ||
    cleaned.includes(':')
  ) {
    prefix = 'CUSTOM:';
  }

  const scopedMatches = cleaned.match(/@[^/]+\/[^/]+/g);
  if (scopedMatches?.length) {
    return scopedMatches.at(-1) as string;
  }

  const parts = cleaned.split('/').filter(Boolean);
  const addonLike = [...parts]
    .reverse()
    .find((part) => part.includes('addon-') || part.includes('-addon'));

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
  const allDependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
    ...packageJson?.peerDependencies,
  };

  const metaFramework = Object.keys(allDependencies).find((dep) => !!metaFrameworks[dep]);

  const [settings, metaFrameworkVersion, knownPackages, packageManager] = await Promise.all([
    isCI() && !detectAgent() ? undefined : globalSettings(),
    metaFramework ? getActualPackageVersion(metaFramework) : undefined,
    analyzeEcosystemPackages(packageJson),
    getPackageManagerInfo(),
  ]);

  const metadata: Partial<StorybookMetadata> = {
    generatedAt: new Date().getTime(),
    userSince: settings?.value.userSince,
    hasCustomBabel: false,
    hasCustomWebpack: false,
    hasCustomVite: false,
    hasStaticDirs: false,
    hasStorybookEslint: false,
    refCount: 0,
  };

  if (metaFramework) {
    metadata.metaFramework = {
      name: metaFrameworks[metaFramework],
      packageName: metaFramework,
      version: metaFrameworkVersion?.version || 'unknown',
    };
  }

  metadata.knownPackages = knownPackages;
  metadata.hasRouterPackage = getHasRouterPackage(packageJson);
  metadata.hasTurbopack = getHasTurbopack(packageJson);
  metadata.hasModuleFederation = getHasModuleFederation(packageJson);

  const monorepoType = getMonorepoType();
  if (monorepoType) {
    metadata.monorepo = monorepoType;
  }

  metadata.packageManager = packageManager;

  const language = allDependencies.typescript ? 'typescript' : 'javascript';

  if (!mainConfig) {
    return {
      ...metadata,
      storybookVersionSpecifier: versions.storybook,
      language,
    };
  }
  metadata.hasCustomBabel = !!mainConfig.babel;
  metadata.hasCustomWebpack =
    !!mainConfig.webpackFinal ||
    (!!allDependencies.next && getHasNextCustomWebpack(dirname(packageJsonPath)));
  metadata.hasCustomVite = !!mainConfig.viteFinal;
  metadata.hasStaticDirs = !!mainConfig.staticDirs;

  if (typeof mainConfig.typescript === 'object') {
    metadata.typescriptOptions = mainConfig.typescript;
  }

  const addons = collectAddons(mainConfig, packageJson);
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

  const [
    { frameworkInfo, rendererPackages },
    addonVersions,
    storybookPackageVersions,
    { storybookInfo, usesGlobals },
    portableStoriesFileCount,
    applicationFileCount,
  ] = await Promise.all([
    getFrameworkInfo(mainConfig, configDir).then(async (info) => ({
      frameworkInfo: info,
      rendererPackages: await resolveRendererPackages(info.renderer),
    })),
    getActualPackageVersions(addons),
    getActualPackageVersions(storybookPackages),
    getStorybookInfo(configDir).then(async (info) => ({
      storybookInfo: info,
      usesGlobals: await previewUsesGlobals(info.previewConfigPath),
    })),
    getPortableStoriesFileCount(),
    getApplicationFileCount(dirname(packageJsonPath)),
  ]);

  if (Object.keys(rendererPackages).length > 0) {
    metadata.knownPackages = { ...metadata.knownPackages, rendererPackages };
  }

  if (typeof mainConfig.refs === 'object') {
    metadata.refCount = Object.keys(mainConfig.refs).length;
  }

  if (typeof mainConfig.features === 'object') {
    metadata.features = mainConfig.features;
  }

  addonVersions.forEach(({ name, version }) => {
    addons[name] = addons[name] || {
      name,
      version,
    };
    addons[name].version = version || undefined;
  });

  storybookPackageVersions.forEach(({ name, version }) => {
    storybookPackages[name] = storybookPackages[name] || {
      name,
      version,
    };

    storybookPackages[name].version = version || undefined;
  });

  const hasStorybookEslint = !!allDependencies['eslint-plugin-storybook'];

  if (usesGlobals !== undefined) {
    metadata.preview = { ...metadata.preview, usesGlobals };
  }

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

function collectAddons(
  mainConfig: StorybookConfig,
  packageJson: PackageJson
): Record<string, StorybookAddon> {
  const addons: Record<string, StorybookAddon> = {};
  for (const addon of mainConfig.addons ?? []) {
    if (typeof addon === 'string') {
      addons[sanitizeAddonName(addon)] = { options: undefined, version: undefined };
    } else {
      addons[sanitizeAddonName(addon.name)] = {
        options: addon.name.includes('addon-essentials') ? addon.options : undefined,
        version: undefined,
      };
    }
  }

  const chromaticVersionSpecifier = getChromaticVersionSpecifier(packageJson);
  if (chromaticVersionSpecifier) {
    addons.chromatic = {
      version: undefined,
      versionSpecifier: chromaticVersionSpecifier,
      options: undefined,
    };
  }
  return addons;
}

async function resolveRendererPackages(renderer: string | undefined) {
  return Object.fromEntries(
    await Promise.all(
      getRendererPackages(renderer).map(async (packageName) => {
        const { version } = await getActualPackageVersion(packageName);
        return [packageName, version || 'unknown'];
      })
    )
  );
}

// Not critical information, and AST parsing of user code can fail, so a parse error yields nothing.
async function previewUsesGlobals(previewConfigPath: string | undefined) {
  if (!previewConfigPath) {
    return undefined;
  }
  try {
    const config = await readConfig(previewConfigPath);
    return !!(config.getFieldNode(['globals']) || config.getFieldNode(['globalTypes']));
  } catch {
    return undefined;
  }
}

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

function resolveDefaultConfigDir(packageJson: PackageJson): string {
  /*
    TODO: improve the way configDir is extracted, as a "storybook" script might not be present.
    Scenarios:
    1. user changed it to something else e.g. "storybook:dev"
    2. they are using angular/nx where the storybook config is defined somewhere else
    3. React Native on-device Storybook uses `.rnstorybook` and `storybook:ios`/`storybook:android`
       scripts (no `storybook` script), so the `.storybook` default never finds the config.
  */
  const fromScript = getStorybookConfiguration(
    String((packageJson?.scripts as Record<string, unknown> | undefined)?.storybook || ''),
    '-c',
    '--config-dir'
  ) as string | null;

  if (fromScript) {
    return fromScript;
  }

  if (existsSync(resolve(RN_STORYBOOK_DIR))) {
    return RN_STORYBOOK_DIR;
  }

  return '.storybook';
}

export const getStorybookMetadata = async (_configDir?: string) => {
  const { packageJson, packageJsonPath } = await getPackageJsonDetails();
  const configDir = _configDir || resolveDefaultConfigDir(packageJson);
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
