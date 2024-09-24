import { join } from 'node:path';

import { pathExists, readJSON, writeJSON } from 'fs-extra';

// TODO -- should we generate this file a second time outside of CLI?
import storybookVersions from '../../code/core/src/common/versions';
import type { TemplateKey } from '../get-template';
import { exec } from './exec';
import touch from './touch';

export type YarnOptions = {
  cwd: string;
  dryRun: boolean;
  debug: boolean;
};

const logger = console;

export const addPackageResolutions = async ({ cwd, dryRun }: YarnOptions) => {
  logger.info(`🔢 Adding package resolutions:`);

  if (dryRun) {
    return;
  }

  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJSON(packageJsonPath);
  packageJson.resolutions = {
    ...packageJson.resolutions,
    ...storybookVersions,
    'enhanced-resolve': '~5.10.0', // TODO, remove this
    // this is for our CI test, ensure we use the same version as docker image, it should match version specified in `./code/package.json` and `.circleci/config.yml`
    '@swc/core': '1.5.7',
    playwright: '1.46.0',
    'playwright-core': '1.46.0',
    '@playwright/test': '1.46.0',
  };
  await writeJSON(packageJsonPath, packageJson, { spaces: 2 });
};

export const installYarn2 = async ({ cwd, dryRun, debug }: YarnOptions) => {
  const pnpApiExists = await pathExists(join(cwd, '.pnp.cjs'));

  const command = [
    touch('yarn.lock'),
    touch('.yarnrc.yml'),
    `yarn set version berry`,

    // Use the global cache so we aren't re-caching dependencies each time we run sandbox
    `yarn config set enableGlobalCache true`,
    `yarn config set checksumBehavior ignore`,
  ];

  if (!pnpApiExists) {
    command.push(`yarn config set nodeLinker node-modules`);
  }

  await exec(
    command,
    { cwd },
    {
      dryRun,
      debug,
      startMessage: `🧶 Installing Yarn 2`,
      errorMessage: `🚨 Installing Yarn 2 failed`,
    }
  );
};

export const addWorkaroundResolutions = async ({ cwd, dryRun }: YarnOptions) => {
  logger.info(`🔢 Adding resolutions for workarounds`);

  if (dryRun) {
    return;
  }

  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJSON(packageJsonPath);
  packageJson.resolutions = {
    ...packageJson.resolutions,
    // Due to our support of older vite versions
    '@vitejs/plugin-react': '4.2.0',
    '@sveltejs/vite-plugin-svelte': '3.0.1',
    '@vitejs/plugin-vue': '4.5.0',
    '@testing-library/dom': '^9.3.4',
    '@testing-library/jest-dom': '^6.5.0',
    '@testing-library/user-event': '^14.5.2',
    // TODO: Remove as soon as @storybook/csf@0.1.10 is released
    '@storybook/csf': '0.1.10--canary.d841bb4.0',
  };
  await writeJSON(packageJsonPath, packageJson, { spaces: 2 });
};

export const configureYarn2ForVerdaccio = async ({
  cwd,
  dryRun,
  debug,
  key,
}: YarnOptions & { key: TemplateKey }) => {
  const command = [
    // We don't want to use the cache or we might get older copies of our built packages
    // (with identical versions), as yarn (correctly I guess) assumes the same version hasn't changed
    `yarn config set enableGlobalCache false`,
    `yarn config set enableMirror false`,
    // ⚠️ Need to set registry because Yarn 2 is not using the conf of Yarn 1 (URL is hardcoded in CircleCI config.yml)
    `yarn config set npmRegistryServer "http://localhost:6001/"`,
    // Some required magic to be able to fetch deps from local registry
    `yarn config set unsafeHttpWhitelist --json '["localhost"]'`,
    // Disable fallback mode to make sure everything is required correctly
    `yarn config set pnpFallbackMode none`,
    // We need to be able to update lockfile when bootstrapping the examples
    `yarn config set enableImmutableInstalls false`,
  ];

  if (
    key.includes('svelte-kit') ||
    // React prereleases will have INCOMPATIBLE_PEER_DEPENDENCY errors because of transitive dependencies not allowing v19 betas
    key.includes('nextjs/prerelease') ||
    key.includes('react-vite/prerelease') ||
    key.includes('react-webpack/prerelease')
  ) {
    // Don't error with INCOMPATIBLE_PEER_DEPENDENCY for SvelteKit sandboxes, it is expected to happen with @sveltejs/vite-plugin-svelte
    command.push(
      `yarn config set logFilters --json '[ { "code": "YN0013", "level": "discard" } ]'`
    );
  } else {
    // Discard all YN0013 - FETCH_NOT_CACHED messages
    // Error on YN0060 - INCOMPATIBLE_PEER_DEPENDENCY
    command.push(
      `yarn config set logFilters --json '[ { "code": "YN0013", "level": "discard" }, { "code": "YN0060", "level": "error" } ]'`
    );
  }

  await exec(
    command,
    { cwd },
    {
      dryRun,
      debug,
      startMessage: `🎛 Configuring Yarn 2`,
      errorMessage: `🚨 Configuring Yarn 2 failed`,
    }
  );
};
