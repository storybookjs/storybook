import { readFile, rename, rm, writeFile } from 'node:fs/promises';

import { join } from 'path';

import yml from 'yaml';

import { STORYBOOK_PACKAGE_PATTERNS } from '../../../code/core/src/common/js-package-manager/util.ts';
import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { runCommand } from '../generate.ts';

interface SetupYarnOptions {
  cwd: string;
  // TODO: Evaluate if this is correct after removing pnp compatibility code in SB11
  pnp?: boolean;
}

/**
 * Install Yarn 4 (Berry) into `cwd` — the scratch parent directory a template's
 * before-script runs in.
 *
 * `cwd` is deliberately left in a non-project state afterwards: it keeps the
 * `.yarn/` release and `.yarnrc.yml` config (so `yarn create …` invocations and
 * the nested `before-storybook` install inherit Yarn 4), but has NO `yarn.lock`
 * and NO `package.json`.
 *
 * This matters because the generated sandbox lives at `cwd/before-storybook`. If
 * `cwd` looked like a Yarn project, Yarn 4 would either (a) error immediately on
 * any `yarn` command run in `cwd` — a `yarn.lock` with no `package.json` is a
 * broken project — or (b) treat `before-storybook` as a stray nested package and
 * reject it. A bare config-only directory sidesteps both: `before-storybook`,
 * which has its own `package.json`, is correctly resolved as the project root.
 *
 * The scratch `yarn.lock` exists only while `yarn set version` runs, then is
 * removed.
 */
export async function setupYarn({ cwd, pnp = false }: SetupYarnOptions) {
  // `yarn set version` treats `cwd` as a project when a yarn.lock is present.
  await writeFile(join(cwd, 'yarn.lock'), '', { flag: 'a' });
  await runCommand(`yarn set version berry`, { cwd });
  if (!pnp) {
    await runCommand('yarn config set nodeLinker node-modules', { cwd });
  }
  await rm(join(cwd, 'package.json'), { force: true });
  await rm(join(cwd, 'yarn.lock'), { force: true });
}

export async function localizeYarnConfigFiles(baseDir: string, beforeDir: string) {
  await Promise.allSettled([
    writeFile(join(beforeDir, 'yarn.lock'), '', { flag: 'a' }),
    rename(join(baseDir, '.yarn'), join(beforeDir, '.yarn')),
    rename(join(baseDir, '.yarnrc.yml'), join(beforeDir, '.yarnrc.yml')),
    rename(join(baseDir, '.yarnrc'), join(beforeDir, '.yarnrc')),
  ]);
}

/**
 * 7-day Yarn `npmMinimalAgeGate` window applied to generated sandboxes.
 *
 * Consumers who pull a sandbox and run `yarn install` are protected from
 * dependency versions published within this window (defense against
 * supply-chain attacks via freshly-published malicious packages).
 *
 * Use the duration string for `YARN_NPM_MINIMAL_AGE_GATE` (scaffold env) and
 * the minute value for `yarn config set npmMinimalAgeGate`.
 */
export const BEFORE_SANDBOX_MIN_AGE_GATE = '7d';
export const BEFORE_SANDBOX_MIN_AGE_MINUTES = 7 * 24 * 60;

interface RefreshLockfileOptions {
  cwd: string;
  debug?: boolean;
  /**
   * Package names or glob patterns exempted from the age gate, for templates
   * that deliberately track a prerelease line (`next@canary`, Expo SDK). The
   * gate still applies to every other dependency in those templates.
   *
   * Yarn applies the gate transitively, so the list has to cover the whole
   * family of packages published in lockstep with the prerelease, not just the
   * direct dependency.
   */
  minAgeGateExemptions?: string[];
}

/**
 * Bring a freshly-bootstrapped `before-storybook` directory into a Yarn 4
 * lockfile state that we can commit to the public sandboxes repository:
 *
 * 1. Drop any non-Yarn-4 lockfile the template's CLI produced (`package-lock.json`,
 *    legacy `yarn.lock`, `pnpm-lock.yaml`).
 * 2. Pin Yarn 4 via the `package.json` `packageManager` field so corepack
 *    resolves it deterministically (no network `yarn set version`).
 * 3. Set `npmMinimalAgeGate` to 7 days so resolution skips quarantined versions,
 *    plus any per-template `npmPreapprovedPackages` allowlist.
 * 4. Run `yarn install --mode=update-lockfile`, falling back to `yarn up '*'`
 *    plus a retry only when the template's own ranges cannot resolve under the
 *    gate. Installing first keeps deliberately pinned majors intact.
 *
 * `YARN_ENABLE_IMMUTABLE_INSTALLS=false` is set via env (not `.yarnrc.yml`) so
 * the consumer-facing config stays clean.
 */
export async function refreshBeforeStorybookLockfile({
  cwd,
  debug,
  minAgeGateExemptions,
}: RefreshLockfileOptions) {
  // Start from a clean Yarn state. Drop the lockfiles the template's CLI
  // produced, plus any `.yarnrc.yml` / `.yarn/` left behind by the staged
  // setup: a stale `yarnPath` there points at a different Yarn release than
  // the `packageManager` field we pin below, and corepack aborts on that
  // version mismatch.
  await Promise.allSettled([
    rm(join(cwd, 'package-lock.json'), { force: true }),
    rm(join(cwd, 'pnpm-lock.yaml'), { force: true }),
    rm(join(cwd, '.yarnrc.yml'), { force: true }),
    rm(join(cwd, '.yarnrc'), { force: true }),
    rm(join(cwd, '.yarn'), { recursive: true, force: true }),
  ]);

  // An empty yarn.lock marks `cwd` as a self-contained Yarn 4 project,
  // otherwise Yarn 4 walks up the filesystem and tries to treat a parent
  // directory as the project root.
  await writeFile(join(cwd, 'yarn.lock'), '');

  // Also clear any leftover yarn.lock in the parent directory — its presence
  // would make Yarn 4 think `cwd` is a workspace of a non-existent project.
  await rm(join(cwd, '..', 'yarn.lock'), { force: true });

  // Pin Yarn 4 via the package.json `packageManager` field so corepack resolves
  // it deterministically. We deliberately do NOT run `yarn set version` here: it
  // re-downloads Yarn over the network (and fails intermittently in CI), and is
  // redundant — the sandbox only needs *a* Yarn 4 to produce the lockfile.
  await pinYarnPackageManager(cwd);

  const env = {
    ...process.env,
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
    COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
    CI: 'true',
  };

  await runCommand(`yarn config set nodeLinker node-modules`, { cwd, env }, debug);

  // Every template keeps the full gate. Prerelease templates narrow it to a
  // named allowlist rather than switching it off, so a compromised release of
  // anything they do not explicitly track is still quarantined.
  await runCommand(
    `yarn config set npmMinimalAgeGate ${BEFORE_SANDBOX_MIN_AGE_MINUTES}`,
    { cwd, env },
    debug
  );

  if (minAgeGateExemptions?.length) {
    await runCommand(
      `yarn config set npmPreapprovedPackages --json ${JSON.stringify(
        JSON.stringify(minAgeGateExemptions)
      )}`,
      { cwd, env },
      debug
    );
  }

  // Resolve the template's own ranges first. This is the path almost every
  // template takes, and it is the only one that preserves deliberately pinned
  // majors: `nextjs/14-ts`, `react-webpack/17-ts`, `ember/3-js` and friends
  // exist to exercise an old framework version, and `yarn up '*'` would rewrite
  // those ranges to latest and silently turn them into duplicates of the
  // `default` templates.
  try {
    await runCommand(`yarn install --mode=update-lockfile`, { cwd, env }, debug);
    return;
  } catch (error) {
    if (debug) {
      console.warn(error);
    }

    // Widening would move a prerelease template onto the stable release, which
    // is the one outcome it must never produce. Warn if the minageGateExemptions list is incomplete
    if (minAgeGateExemptions?.length) {
      console.warn(
        `Install failed under the age gate and the allowlist (${minAgeGateExemptions.join(
          ', '
        )}) does not cover every quarantined package. Add the missing ones rather than widening, which would drop this template to the stable release.`,
        { cause: error }
      );
    }
  }

  // The install only fails here when the template's CLI pinned a version that
  // is itself inside the age-gate window (`ng new` → `@angular/build@^21.x`),
  // leaving the range with no resolvable candidates. Widening is the last
  // resort, and it is safe for these templates precisely because they track
  // latest anyway.
  console.warn(
    `⚠️ install failed under the ${BEFORE_SANDBOX_MIN_AGE_MINUTES}min age gate; widening ranges via yarn up`
  );

  // `yarn up '*'` errors when the project has no direct dependencies
  // (`internal/server-webpack5` is just `yarn init -y`) — non-fatal.
  try {
    await runCommand(`yarn up '*' --mode=update-lockfile`, { cwd, env }, debug);
  } catch (error) {
    console.warn(`⚠️ yarn up '*' skipped (likely no upgradeable dependencies).`);
    if (debug) {
      console.warn(error);
    }
  }

  await runCommand(`yarn install --mode=update-lockfile`, { cwd, env }, debug);
}

/**
 * Packages served by the local Verdaccio registry during sandbox generation.
 * They are published seconds before they are installed, so they can never
 * satisfy the age gate on their own.
 */
export const LOCALLY_PUBLISHED_PACKAGE_PATTERNS = [
  ...STORYBOOK_PACKAGE_PATTERNS,
  'create-storybook',
  'sb',
];

/**
 * Allow the locally published Storybook packages past the age gate for the
 * `after-storybook` install, keeping the gate itself in force.
 *
 * This install is the only step in sandbox generation that executes package
 * code (lifecycle scripts, addon postinstall hooks), and it resolves
 * third-party dependencies from the upstream registry through Verdaccio.
 * Switching the gate off here would leave the one dangerous step unprotected,
 * so name the packages that genuinely cannot satisfy it instead.
 *
 * Merges with whatever the template already allows, so a prerelease template
 * does not lose its own entries. Phase 1 strips both keys from the published
 * `after-storybook` tree, so none of this reaches consumers.
 */
export async function preapproveLocallyPublishedPackages(cwd: string) {
  const configPath = join(cwd, '.yarnrc.yml');

  let config: Record<string, unknown> = {};
  try {
    config = (yml.parse(await readFile(configPath, 'utf-8')) ?? {}) as Record<string, unknown>;
  } catch {
    // No config yet (the lockfile refresh may have bailed); start from scratch.
  }

  const existing = Array.isArray(config.npmPreapprovedPackages)
    ? (config.npmPreapprovedPackages as string[])
    : [];

  config.npmPreapprovedPackages = Array.from(
    new Set([...existing, ...LOCALLY_PUBLISHED_PACKAGE_PATTERNS])
  );

  await writeFile(configPath, yml.stringify(config));
}

/**
 * Copy the monorepo's pinned Yarn version into the sandbox `package.json`
 * `packageManager` field. corepack then resolves Yarn 4 deterministically for
 * every `yarn` command run in the sandbox, with no network `yarn set version`.
 */
async function pinYarnPackageManager(cwd: string) {
  const rootPackageJson = JSON.parse(await readFile(join(ROOT_DIRECTORY, 'package.json'), 'utf-8'));
  const packageManager: string | undefined = rootPackageJson.packageManager;
  if (!packageManager?.startsWith('yarn@')) {
    throw new Error(
      `Expected a yarn "packageManager" in the monorepo package.json, got: ${packageManager}`
    );
  }

  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
  packageJson.packageManager = packageManager;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
