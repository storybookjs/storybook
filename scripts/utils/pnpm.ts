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

/** The 7-day age gate published sandboxes are generated under, in minutes. */
export const SANDBOX_MINIMUM_RELEASE_AGE = 10080;

/** The local registry proxy started by `scripts/run-registry.ts`. */
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

/** The monorepo's `packageManager` spec, e.g. `pnpm@10.34.9+sha512.…`. */
async function getMonorepoPackageManager(): Promise<string> {
  const { packageManager } = await readJson(join(ROOT_DIRECTORY, 'package.json'));
  return packageManager;
}

/**
 * Sandboxes install with the monorepo's pnpm. An older pnpm on PATH ignores the sandbox's
 * `packageManager` pin and silently drops settings it does not know, the age gate among them.
 */
async function assertPinnedPnpm(cwd: string) {
  const expected = (await getMonorepoPackageManager()).replace(/^pnpm@/, '').split('+')[0];
  const { stdout } = await execaCommand('pnpm --version', { cwd, shell: true });
  const actual = stdout.trim();
  if (actual !== expected) {
    throw new Error(
      `Sandboxes need pnpm ${expected}, but \`pnpm\` in ${cwd} is ${actual}. Run \`corepack enable pnpm\` so the pinned version is used.`
    );
  }
}

/**
 * Turn a freshly created sandbox into a standalone pnpm project that keeps the published sandbox's
 * protections: the locked dependency versions and a 7-day age gate.
 *
 * - Pins the monorepo's pnpm through `packageManager`.
 * - Writes the sandbox's own `pnpm-workspace.yaml`, so pnpm never treats the sandbox as part of an
 *   enclosing workspace (the NX cache copy lives inside the monorepo). It carries the age gate, with
 *   the locally published Storybook packages and the template's exemptions excluded from it, and
 *   the hoisted linker, which lays out `node_modules` like the Yarn sandboxes did.
 * - Allows lockfile updates on CI, as Yarn's `enableImmutableInstalls false` did: `storybook init`
 *   and later steps change the manifest.
 */
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

  // A template's own Yarn allowlist (if any) carries over to the pnpm exclusions.
  const yarnConfig = await readYaml(join(cwd, '.yarnrc.yml'));

  await updateWorkspaceConfig(cwd, (config) => ({
    ...config,
    packages: ['.'],
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
    frozenLockfile: false,
  }));

  await assertPinnedPnpm(cwd);

  if (debug) {
    logger.log(`Configured pnpm in ${cwd}`);
  }
};

/**
 * Convert the published sandbox's `yarn.lock` with `pnpm import`, which keeps its locked versions,
 * then remove what is left of Yarn: the Storybook CLI picks Yarn while a `yarn.lock` exists, and a
 * Yarn-installed `node_modules` would survive a pnpm install. Run it after the registry is
 * configured, so the import resolves through the same registry as the install.
 */
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
  // pnpm reads a top-level `resolutions` field as overrides. Every sandbox writer uses it, because
  // a non-empty `resolutions` makes pnpm ignore the `overrides` in pnpm-workspace.yaml entirely.
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

/**
 * Point the sandbox at the local registry, which serves the Storybook packages published from this
 * checkout. The registry belongs in `.npmrc`: pnpm ignores a `registry` key in pnpm-workspace.yaml.
 *
 * Each run republishes the same versions with new contents, while pnpm reuses cached registry
 * metadata (up to the age gate's 7 days old) without asking the registry again. Drop the cached
 * metadata of the locally published packages so this install sees what was just published.
 */
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

/**
 * Install every publishable monorepo package into the sandbox from its `code/` directory, through
 * `file:` overrides. pnpm hard-links the package's published files from `code/` and installs its
 * dependencies in the sandbox, resolving peers such as react, next or @angular/* against the
 * sandbox, as Yarn portals did. A `link:` symlink would make the package resolve everything from
 * the monorepo's own `node_modules` instead.
 *
 * The hard links share their files with `code/`, so editing one edits the monorepo, but a build
 * replaces the files; `syncLinkedPackages` links the new build.
 */
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

  // The linked manifests still carry `workspace:` peer ranges; the hook rewrites them.
  await updateWorkspaceConfig(cwd, (config) => ({ ...config, pnpmfile: WORKSPACE_PEERS_HOOK }));

  if (debug) {
    logger.log(`Linked ${workspaces.length} packages into ${cwd}`);
  }
};

/** The packages the sandbox installs from this checkout's `code/` through `file:` resolutions. */
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

/** Whether the sandbox installs the monorepo packages from `code/` (link mode). */
export async function isLinkedSandbox(cwd: string) {
  return (await getLinkedPackageNames(cwd)).length > 0;
}

/**
 * Bring the sandbox's linked packages up to date with the latest build. pnpm links a `file:`
 * package's files once and never re-imports an installed one (not even with `--force`), while a
 * build deletes `dist` and writes new content-hashed chunks. Remove the installed packages, so the
 * install links the current build; being non-frozen, it also installs new dependencies of a package.
 */
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
