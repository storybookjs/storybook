import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// TODO -- should we generate this file a second time outside of CLI?
import storybookVersions from '../../code/core/src/common/versions';
import type { TemplateKey } from '../get-template';
import { exec } from './exec';

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
    playwright: '1.52.0',
    'playwright-core': '1.52.0',
    '@playwright/test': '1.52.0',
  };
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
};

export const installYarn2 = async ({ cwd, dryRun, debug }: YarnOptions) => {
  await rm(join(cwd, '.yarnrc.yml'), { force: true }).catch(() => {});

  const [pnpApiExists] = await Promise.all([
    // TODO: Remove in SB11
    pathExists(join(cwd, '.pnp.cjs')),
    mkdir(cwd, { recursive: true }).then(() =>
      Promise.all([
        //
        writeFile(join(cwd, 'yarn.lock'), ''),
        writeFile(join(cwd, '.yarnrc.yml'), ''),
      ])
    ),
  ]);

  const command = [
    `yarn set version berry`,
    `yarn config set enableGlobalCache true`, // Use the global cache so we aren't re-caching dependencies each time we run sandbox
    `yarn config set checksumBehavior ignore`,
  ];

  if (!pnpApiExists) {
    command.push(`yarn config set nodeLinker node-modules`);
  }

  await exec(
    command.join(' && '),
    { cwd },
    {
      dryRun,
      debug,
      startMessage: `🧶 Installing Yarn`,
      errorMessage: `🚨 Installing Yarn failed`,
    }
  );
};

export const addWorkaroundResolutions = async ({
  cwd,
  dryRun,
  key,
}: YarnOptions & { key?: TemplateKey }) => {
  logger.info(`🔢 Adding resolutions for workarounds`);

  if (dryRun) {
    return;
  }

  const packageJsonPath = join(cwd, 'package.json');
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);

  const additionalReact19Resolutions = [
    'nextjs/default-ts',
    'nextjs/prerelease',
    'react-native-web-vite/expo-ts',
  ].includes(key)
    ? {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      }
    : key === 'react-webpack/prerelease-ts'
      ? {
          react: packageJson.dependencies.react,
          'react-dom': packageJson.dependencies['react-dom'],
        }
      : key === 'react-rsbuild/default-ts'
        ? {
            'react-docgen': '^8.0.2',
          }
        : {};

  packageJson.resolutions = {
    ...packageJson.resolutions,
    ...additionalReact19Resolutions,
    '@testing-library/dom': '^9.3.4',
    '@testing-library/jest-dom': '^6.6.3',
    '@testing-library/user-event': '^14.5.2',
  };

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
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
    // TODO publish unique versions instead
    `yarn config set enableGlobalCache false`,
    `yarn config set enableMirror false`,
    // ⚠️ Need to set registry because Yarn 2 is not using the conf of Yarn 1 (URL is hardcoded in CircleCI config.yml)
    `yarn config set npmRegistryServer "http://localhost:6001/"`,
    // Some required magic to be able to fetch deps from local registry
    `yarn config set unsafeHttpWhitelist "localhost"`,
    // Disable fallback mode to make sure everything is required correctly
    `yarn config set pnpFallbackMode none`,
    // We need to be able to update lockfile when bootstrapping the examples
    `yarn config set enableImmutableInstalls false`,
  ];

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
    command.push(
      `yarn config set logFilters --json "[{\\"code\\":\\"YN0013\\",\\"level\\":\\"discard\\"}]"`
    );
  } else if (key.includes('nuxt')) {
    // Nothing to do for Nuxt
  } else {
    // Discard all YN0013 - FETCH_NOT_CACHED messages
    // Error on YN0060 - INCOMPATIBLE_PEER_DEPENDENCY
    command.push(
      `yarn config set logFilters --json "[{\\"code\\":\\"YN0013\\",\\"level\\":\\"discard\\"},{\\"code\\":\\"YN0060\\",\\"level\\":\\"error\\"}]"`
    );
  }

  await exec(
    command.join(' && '),
    { cwd },
    {
      dryRun,
      debug,
      startMessage: `🎛 Configuring Yarn 2`,
      errorMessage: `🚨 Configuring Yarn 2 failed`,
    }
  );
};
