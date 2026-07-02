import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse, stringify } from 'yaml';

// TODO -- should we generate this file a second time outside of CLI?
import storybookVersions from '../../code/core/src/common/versions.ts';
import { allTemplates } from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import type { AllTemplatesKey } from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { ROOT_DIRECTORY } from './constants.ts';

export type YarnOptions = {
  cwd: string;
  dryRun: boolean;
  debug: boolean;
};

const logger = console;

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const addPackageResolutions = async ({ cwd, dryRun }: YarnOptions) => {
  logger.info(`🔢 Adding package resolutions:`);

  if (dryRun) {
    return;
  }

  const packageJsonPath = join(cwd, 'package.json');
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);
  packageJson.resolutions = {
    ...packageJson.resolutions,
    ...storybookVersions,
    // this is for our CI test, ensure we use the same version as docker image, it should match version specified in `./code/package.json` and `.circleci/config.yml`
    playwright: '1.58.2',
    'playwright-core': '1.58.2',
    '@playwright/test': '1.58.2',
  };
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
};

/**
 * Merge keys into the sandbox's .yarnrc.yml with a plain file write. Yarn
 * configuration used to happen through chained `yarn config set` calls, but
 * each of those boots a yarn process (~0.5s each on CI) and the very first
 * one triggers corepack network downloads - a measurable slice of every
 * sandbox create job for what is ultimately just YAML authoring.
 */
const mergeYarnrc = async (cwd: string, overrides: Record<string, unknown>) => {
  const yarnrcPath = join(cwd, '.yarnrc.yml');
  const current = await readFile(yarnrcPath, 'utf-8').catch(() => '');
  const config = { ...(parse(current) ?? {}), ...overrides };
  await writeFile(yarnrcPath, stringify(config));
};

export const installYarn2 = async ({ cwd, dryRun }: YarnOptions) => {
  logger.info(`🧶 Installing Yarn`);

  if (dryRun) {
    return;
  }

  await rm(join(cwd, '.yarnrc.yml'), { force: true }).catch(() => {});

  // TODO: Remove in SB11
  const pnpApiExists = await pathExists(join(cwd, '.pnp.cjs'));

  await mkdir(cwd, { recursive: true });
  await writeFile(join(cwd, 'yarn.lock'), '');

  // Vendor the repository's own pinned Yarn release instead of running
  // `yarn set version berry`, which downloads the latest Berry from the
  // network on every sandbox (on top of corepack fetching a bootstrap yarn).
  // Any bootstrap yarn - corepack's default or the image's classic yarn -
  // sees yarnPath and delegates to this file, so no download happens and the
  // sandbox runs the exact yarn version the monorepo itself is tested with.
  const { packageManager } = JSON.parse(
    await readFile(join(ROOT_DIRECTORY, 'package.json'), 'utf-8')
  );
  const yarnRelease = `yarn-${packageManager.replace(/^yarn@/, '')}.cjs`;
  const releaseSource = join(ROOT_DIRECTORY, '.yarn', 'releases', yarnRelease);
  // Fails loudly if the repo ever stops vendoring its yarn release.
  await access(releaseSource);
  await mkdir(join(cwd, '.yarn', 'releases'), { recursive: true });
  await copyFile(releaseSource, join(cwd, '.yarn', 'releases', yarnRelease));

  // Pin packageManager in the sandbox to the same version. Without the field,
  // corepack auto-pins whatever bootstrap yarn it resolves (classic 1.22.x)
  // on the first install; installs still work through yarnPath delegation,
  // but JsPackageManagerFactory reads the field first and would classify the
  // sandbox as Yarn 1, making the CLI run classic-syntax commands.
  const sandboxPackageJsonPath = join(cwd, 'package.json');
  let sandboxPackageJson: Record<string, unknown> | undefined;
  try {
    sandboxPackageJson = JSON.parse(await readFile(sandboxPackageJsonPath, 'utf-8'));
  } catch {
    sandboxPackageJson = undefined;
  }
  if (sandboxPackageJson) {
    sandboxPackageJson.packageManager = packageManager;
    await writeFile(sandboxPackageJsonPath, JSON.stringify(sandboxPackageJson, null, 2));
  }

  await mergeYarnrc(cwd, {
    yarnPath: `.yarn/releases/${yarnRelease}`,
    // Use the global cache so we aren't re-caching dependencies each time we run sandbox
    enableGlobalCache: true,
    checksumBehavior: 'ignore',
    // Yarn 4.15.0 defaults `npmMinimalAgeGate` to 1d, which quarantines freshly
    // published Storybook packages from the local Verdaccio registry. Disable
    // the gate inside sandboxes so installs aren't blocked.
    npmMinimalAgeGate: 0,
    ...(pnpApiExists ? {} : { nodeLinker: 'node-modules' }),
  });
};

export const isViteSandbox = (key?: AllTemplatesKey) => {
  return allTemplates[key as AllTemplatesKey]?.expected.builder === '@storybook/builder-vite';
};

export const addWorkaroundResolutions = async ({
  cwd,
  dryRun,
  key,
}: YarnOptions & { key?: AllTemplatesKey }) => {
  logger.info(`🔢 Adding resolutions for workarounds`);

  if (dryRun) {
    return;
  }

  const packageJsonPath = join(cwd, 'package.json');
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);

  let additionalResolutions = {};

  // add additional resolutions for React 19
  if (['nextjs/default-ts', 'nextjs/prerelease', 'react-native-web-vite/expo-ts'].includes(key)) {
    additionalResolutions = {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    };
  }

  if (key === 'react-webpack/prerelease-ts') {
    additionalResolutions = {
      ...additionalResolutions,
      react: packageJson.dependencies.react,
      'react-dom': packageJson.dependencies['react-dom'],
    };
  }

  if (key === 'react-rsbuild/default-ts') {
    additionalResolutions = {
      ...additionalResolutions,
      'react-docgen': '^8.0.2',
    };
  }

  packageJson.resolutions = {
    ...packageJson.resolutions,
    '@testing-library/dom': '^9.3.4',
    '@testing-library/jest-dom': '^6.6.3',
    '@testing-library/user-event': '^14.5.2',
    ...additionalResolutions,
  };

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
};

export const configureYarn2ForVerdaccio = async ({
  cwd,
  dryRun,
  key,
}: YarnOptions & { key: AllTemplatesKey }) => {
  logger.info(`🎛 Configuring Yarn 2`);

  if (dryRun) {
    return;
  }

  // On NX Cloud agents, we use the global cache to avoid duplicating .yarn/cache across sandboxes.
  // Stale @storybook/* packages are cleaned from the global cache in the agent init step (agents.yaml).
  // Locally and on CircleCI, we disable the global cache to avoid stale packages from previous runs.
  const useGlobalCache = Boolean(process.env.STORYBOOK_NX_CLOUD_AGENT);

  let logFilters: { code: string; level: string }[] | undefined;
  if (
    key.includes('svelte-kit') ||
    // React prereleases will have INCOMPATIBLE_PEER_DEPENDENCY errors because of transitive dependencies not allowing v19 betas
    key.includes('nextjs') ||
    key.includes('react-vite/prerelease') ||
    key.includes('react-webpack/prerelease') ||
    key.includes('react-rsbuild/default-ts') ||
    key.includes('vue-rsbuild/default-ts') ||
    key.includes('html-rsbuild/default-ts') ||
    key.includes('web-components-rsbuild/default-ts')
  ) {
    // Don't error with INCOMPATIBLE_PEER_DEPENDENCY for SvelteKit sandboxes, it is expected to happen with @sveltejs/vite-plugin-svelte
    logFilters = [{ code: 'YN0013', level: 'discard' }];
  } else if (key.includes('nuxt')) {
    // Nothing to do for Nuxt
  } else {
    // Discard all YN0013 - FETCH_NOT_CACHED and YN0060 - INCOMPATIBLE_PEER_DEPENDENCY messages
    logFilters = [
      { code: 'YN0013', level: 'discard' },
      { code: 'YN0060', level: 'discard' },
    ];
  }

  await mergeYarnrc(cwd, {
    enableGlobalCache: useGlobalCache,
    enableMirror: false,
    // ⚠️ Need to set registry because Yarn 2 is not using the conf of Yarn 1 (URL is hardcoded in CircleCI config.yml)
    npmRegistryServer: 'http://localhost:6001/',
    // Some required magic to be able to fetch deps from local registry
    unsafeHttpWhitelist: ['localhost'],
    // Disable fallback mode to make sure everything is required correctly
    pnpFallbackMode: 'none',
    // We need to be able to update lockfile when bootstrapping the examples
    enableImmutableInstalls: false,
    ...(logFilters ? { logFilters } : {}),
  });
};
