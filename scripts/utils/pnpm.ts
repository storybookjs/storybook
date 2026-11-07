import { access, readFile, rm, writeFile } from 'node:fs/promises';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import { join, relative } from 'pathe';
import yml from 'yaml';

// TODO -- should we generate this file a second time outside of CLI?
import storybookVersions from '../../code/core/src/common/versions.ts';
import { allTemplates } from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import type { AllTemplatesKey } from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { CODE_DIRECTORY, ROOT_DIRECTORY, SCRIPTS_DIRECTORY } from './constants.ts';
import { exec } from './exec.ts';
import { LOCALLY_PUBLISHED_PACKAGE_PATTERNS } from './preapprove-local-packages.ts';
import { getCodeWorkspaces } from './workspace.ts';

export type SandboxPmOptions = {
  cwd: string;
  dryRun: boolean;
  debug: boolean;
};

const logger = console;

// 7 days in minutes, the age gate the published sandboxes are generated with.
export const SANDBOX_MINIMUM_RELEASE_AGE = 10080;

const LOCAL_REGISTRY_URL = 'http://localhost:6001/';

const WORKSPACE_PEERS_HOOK = join(SCRIPTS_DIRECTORY, 'utils', 'workspace-peers.pnpmfile.cjs');

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

async function readJson(path: string) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function writeJson(path: string, json: unknown) {
  await writeFile(path, JSON.stringify(json, null, 2));
}

async function readYaml(path: string): Promise<Record<string, any>> {
  if (!(await pathExists(path))) {
    return {};
  }
  return (yml.parse(await readFile(path, 'utf-8')) ?? {}) as Record<string, any>;
}

const workspaceConfigPath = (cwd: string) => join(cwd, 'pnpm-workspace.yaml');

async function updateWorkspaceConfig(
  cwd: string,
  update: (config: Record<string, any>) => Record<string, any>
) {
  const path = workspaceConfigPath(cwd);
  await writeFile(path, yml.stringify(update(await readYaml(path))));
}

async function getMonorepoPackageManager(): Promise<string> {
  const { packageManager } = await readJson(join(ROOT_DIRECTORY, 'package.json'));
  return packageManager;
}

// An older pnpm on PATH ignores the `packageManager` pin and silently drops settings it does not
// know, such as the age gate.
async function assertPinnedPnpm(cwd: string) {
  const expected = (await getMonorepoPackageManager()).replace(/^pnpm@/, '').split('+')[0];
  const { stdout } = await execaCommand('pnpm --version', { cwd, shell: true });
  const actual = stdout.trim();
  if (actual !== expected) {
    throw new Error(
      `Sandboxes need pnpm ${expected}, but \`pnpm\` in ${cwd} is ${actual}. Install pnpm 10 or later, which switches to the version the \`packageManager\` field pins.`
    );
  }
}

export const installPnpm = async ({
  cwd,
  dryRun,
  debug,
  key,
}: SandboxPmOptions & { key: AllTemplatesKey }) => {
  if (dryRun) {
    return;
  }

  logger.info(`📦 Configuring pnpm`);

  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJson(packageJsonPath);
  packageJson.packageManager = await getMonorepoPackageManager();
  await writeJson(packageJsonPath, packageJson);

  const yarnConfig = await readYaml(join(cwd, '.yarnrc.yml'));

  // Without its own pnpm-workspace.yaml, a sandbox inside the monorepo (the NX cache copy) would
  // install the monorepo instead.
  await updateWorkspaceConfig(cwd, (config) => ({
    ...config,
    packages: ['.'],
    // Matches the flat node_modules of the published sandboxes, which are Yarn projects.
    nodeLinker: 'hoisted',
    minimumReleaseAge: SANDBOX_MINIMUM_RELEASE_AGE,
    minimumReleaseAgeExclude: Array.from(
      new Set([
        ...(config.minimumReleaseAgeExclude ?? []),
        ...(yarnConfig.npmPreapprovedPackages ?? []),
        ...LOCALLY_PUBLISHED_PACKAGE_PATTERNS,
        ...(allTemplates[key].minAgeGateExemptions ?? []),
      ])
    ),
    // pnpm installs frozen on CI, but `storybook init` and later steps change the manifest.
    frozenLockfile: false,
    // cmd.exe on Windows cannot run the sandbox scripts' `VAR=value command` prefixes.
    shellEmulator: true,
  }));

  await assertPinnedPnpm(cwd);

  if (debug) {
    logger.log(`Configured pnpm in ${cwd}`);
  }
};

// Run it after the registry is configured, so `pnpm import` uses the same registry as the install.
export const importYarnLockfile = async ({ cwd, dryRun, debug }: SandboxPmOptions) => {
  if (dryRun) {
    return;
  }

  if (await pathExists(join(cwd, 'yarn.lock'))) {
    await exec(
      'pnpm import',
      { cwd },
      {
        debug,
        startMessage: `🔒 Converting the sandbox lockfile`,
        errorMessage: `🚨 Converting the sandbox lockfile failed`,
      }
    );
  }

  await Promise.all(
    ['yarn.lock', '.yarnrc.yml', '.yarnrc', '.yarn', 'package-lock.json', 'node_modules'].map(
      (file) => rm(join(cwd, file), { recursive: true, force: true })
    )
  );
};

export const addPackageResolutions = async ({ cwd, dryRun }: SandboxPmOptions) => {
  logger.info(`🔢 Adding package resolutions:`);

  if (dryRun) {
    return;
  }

  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJson(packageJsonPath);
  // A non-empty `resolutions` makes pnpm ignore the `overrides` in pnpm-workspace.yaml, so every
  // sandbox override goes in `resolutions`.
  packageJson.resolutions = {
    ...packageJson.resolutions,
    ...storybookVersions,
    // this is for our CI test, ensure we use the same version as docker image, it should match version specified in `./code/package.json` and `.circleci/config.yml`
    playwright: '1.58.2',
    'playwright-core': '1.58.2',
    '@playwright/test': '1.58.2',
  };
  await writeJson(packageJsonPath, packageJson);
};

export const isViteSandbox = (key?: AllTemplatesKey) => {
  return allTemplates[key as AllTemplatesKey]?.expected.builder === '@storybook/builder-vite';
};

export const addWorkaroundResolutions = async ({
  cwd,
  dryRun,
  key,
}: SandboxPmOptions & { key?: AllTemplatesKey }) => {
  logger.info(`🔢 Adding resolutions for workarounds`);

  if (dryRun) {
    return;
  }

  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJson(packageJsonPath);

  let additionalResolutions = {};

  // add additional resolutions for React 19
  if (
    key !== undefined &&
    ['nextjs/default-ts', 'nextjs/prerelease', 'react-native-web-vite/expo-ts'].includes(key)
  ) {
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
    '@testing-library/jest-dom': '6.9.1',
    '@testing-library/user-event': '^14.5.2',
    ...additionalResolutions,
  };

  await writeJson(packageJsonPath, packageJson);
};

// pnpm ignores a `registry` key in pnpm-workspace.yaml. Each run republishes the same versions
// with new contents, which pnpm's metadata cache would hide.
export const configurePnpmForVerdaccio = async ({ cwd, dryRun, debug }: SandboxPmOptions) => {
  if (dryRun) {
    return;
  }

  logger.info(`🎛 Configuring pnpm for the local registry`);

  const npmrcPath = join(cwd, '.npmrc');
  const existing = (await pathExists(npmrcPath)) ? await readFile(npmrcPath, 'utf-8') : '';
  await writeFile(
    npmrcPath,
    `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}registry=${LOCAL_REGISTRY_URL}\n`
  );

  const patterns = LOCALLY_PUBLISHED_PACKAGE_PATTERNS.map((pattern) => `'${pattern}'`).join(' ');
  await exec(
    [
      `pnpm cache delete --registry=${LOCAL_REGISTRY_URL} ${patterns}`,
      // Installs under minimumReleaseAge keep the full metadata in a separate cache, which
      // `pnpm cache` only targets in time-based resolution mode.
      `pnpm cache delete --registry=${LOCAL_REGISTRY_URL} --config.resolution-mode=time-based ${patterns}`,
    ],
    { cwd },
    {
      debug,
      startMessage: `🧹 Dropping cached registry metadata of locally published packages`,
      errorMessage: `🚨 Dropping cached registry metadata failed`,
    }
  );
};

// `file:` installs each package's dependencies and peers in the sandbox, where `link:` would
// resolve them from the monorepo's `node_modules`. `syncLinkedPackages` picks up a new build.
export const linkMonorepoPackages = async ({ cwd, dryRun, debug }: SandboxPmOptions) => {
  logger.info(`🔗 Linking monorepo packages`);

  if (dryRun) {
    return;
  }

  const workspaces = await getCodeWorkspaces(false);
  const resolutions: Record<string, string> = {};

  for (const { name, location } of workspaces) {
    resolutions[name] = `file:${relative(cwd, join(CODE_DIRECTORY, location))}`;
  }

  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJson(packageJsonPath);
  packageJson.resolutions = { ...packageJson.resolutions, ...resolutions };
  // The same additions `storybook link` makes to the projects it links.
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    ...(!packageJson.devDependencies?.vite && { 'webpack-hot-middleware': '*' }),
    '@types/node': '^22',
  };
  await writeJson(packageJsonPath, packageJson);

  await updateWorkspaceConfig(cwd, (config) => ({ ...config, pnpmfile: WORKSPACE_PEERS_HOOK }));

  if (debug) {
    logger.log(`Linked ${workspaces.length} packages into ${cwd}`);
  }
};

async function getLinkedPackageNames(cwd: string): Promise<string[]> {
  const packageJsonPath = join(cwd, 'package.json');
  if (!(await pathExists(packageJsonPath))) {
    return [];
  }
  const { resolutions = {} } = await readJson(packageJsonPath);
  return Object.entries(resolutions)
    .filter(
      ([, spec]) =>
        typeof spec === 'string' &&
        spec.startsWith('file:') &&
        !relative(CODE_DIRECTORY, join(cwd, spec.slice('file:'.length))).startsWith('..')
    )
    .map(([name]) => name);
}

export async function isLinkedSandbox(cwd: string) {
  return (await getLinkedPackageNames(cwd)).length > 0;
}

// pnpm never re-imports an installed `file:` package, not even with `--force`, so a new build only
// reaches the sandbox once the installed copies are removed.
export const syncLinkedPackages = async ({ cwd, dryRun, debug }: SandboxPmOptions) => {
  if (!dryRun) {
    // The resolutions pin one version of each linked package, so the hoisted linker installs it at
    // the top of node_modules.
    const names = await getLinkedPackageNames(cwd);
    await Promise.all(
      names.map((name) => rm(join(cwd, 'node_modules', name), { recursive: true, force: true }))
    );
  }

  await exec(
    'pnpm install --prefer-offline',
    { cwd },
    {
      dryRun,
      debug,
      startMessage: `🔗 Refreshing the linked monorepo packages`,
      errorMessage: `🚨 Refreshing the linked monorepo packages failed`,
    }
  );
};
