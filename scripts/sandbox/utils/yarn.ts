import { rename, rm, writeFile } from 'node:fs/promises';

import { join } from 'path';

import { runCommand } from '../generate.ts';

interface SetupYarnOptions {
  cwd: string;
  // TODO: Evaluate if this is correct after removing pnp compatibility code in SB11
  pnp?: boolean;
  version?: 'berry' | 'classic';
}

// NOTE: `version` defaults to `classic` (Yarn 1). This sets up Yarn only in the
// scratch `createBaseDir`, which is the *parent* of the generated sandbox. It must
// stay Yarn 1: Yarn 4 is strict about nested projects and would reject any install
// a template's before-script runs inside the `before-storybook` subdirectory. The
// sandbox itself is migrated to Yarn 4 afterwards by `refreshBeforeStorybookLockfile`.
export async function setupYarn({ cwd, pnp = false, version = 'classic' }: SetupYarnOptions) {
  // force yarn
  await writeFile(join(cwd, 'yarn.lock'), '', { flag: 'a' });
  await runCommand(`yarn set version ${version}`, { cwd });
  if (version === 'berry' && !pnp) {
    await runCommand('yarn config set nodeLinker node-modules', { cwd });
  }
  await rm(join(cwd, 'package.json'), { force: true });
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
 * 7 days, in minutes — the Yarn `npmMinimalAgeGate` window applied to the
 * generated `before-storybook` sandbox.
 *
 * Consumers who pull a sandbox and run `yarn install` are protected from
 * dependency versions published within this window (defense against
 * supply-chain attacks via freshly-published malicious packages).
 */
export const BEFORE_SANDBOX_MIN_AGE_MINUTES = 7 * 24 * 60;

interface RefreshLockfileOptions {
  cwd: string;
  debug?: boolean;
  /**
   * Skip the `npmMinimalAgeGate` setting. Required for templates that pin
   * intentionally-fresh dependency versions (e.g. `create-next-app@canary`)
   * whose pinned versions would otherwise be quarantined.
   */
  disableMinAgeGate?: boolean;
}

/**
 * Bring a freshly-bootstrapped `before-storybook` directory into a Yarn 4
 * lockfile state that we can commit to the public sandboxes repository:
 *
 * 1. Drop any non-Yarn-4 lockfile the template's CLI produced (`package-lock.json`,
 *    legacy `yarn.lock`, `pnpm-lock.yaml`).
 * 2. Re-set Yarn 4 in `package.json` (the template recreated `package.json`
 *    after `setupYarn`, so the `packageManager` field needs to be restored).
 * 3. Set `npmMinimalAgeGate` to 7 days so resolution skips quarantined versions.
 * 4. Run `yarn install` + `yarn up '*'` in `--mode=update-lockfile` to produce
 *    a deterministic Yarn 4 lockfile pinned to the newest non-quarantined
 *    versions matching the template's `package.json` ranges.
 *
 * `YARN_ENABLE_IMMUTABLE_INSTALLS=false` is set via env (not `.yarnrc.yml`) so
 * the consumer-facing config stays clean.
 */
export async function refreshBeforeStorybookLockfile({
  cwd,
  debug,
  disableMinAgeGate,
}: RefreshLockfileOptions) {
  // Drop any non-Yarn-4 lockfile the template's CLI produced.
  await Promise.allSettled([
    rm(join(cwd, 'package-lock.json'), { force: true }),
    rm(join(cwd, 'pnpm-lock.yaml'), { force: true }),
  ]);

  // Truncate yarn.lock to empty (instead of removing it). An empty yarn.lock here
  // marks `cwd` as a self-contained Yarn 4 project, otherwise Yarn 4 walks up the
  // filesystem and tries to treat `createBaseDir`'s leftover yarn.lock as the
  // project root — which fails with `nearest package directory doesn't seem to be
  // part of the project`.
  await writeFile(join(cwd, 'yarn.lock'), '');

  // Also clear the parent's leftover yarn.lock (left there by setupYarn so we
  // could `yarn set version berry` against an empty fixture) — its presence is
  // what makes Yarn 4 think `cwd` is a workspace of a non-existent project.
  await rm(join(cwd, '..', 'yarn.lock'), { force: true });

  await runCommand(`yarn set version berry`, { cwd }, debug);
  await runCommand(`yarn config set nodeLinker node-modules`, { cwd }, debug);

  const gateMinutes = disableMinAgeGate ? 0 : BEFORE_SANDBOX_MIN_AGE_MINUTES;
  await runCommand(`yarn config set npmMinimalAgeGate ${gateMinutes}`, { cwd }, debug);

  const env = {
    ...process.env,
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
    CI: 'true',
  };

  await runCommand(`yarn install --mode=update-lockfile`, { cwd, env }, debug);

  // `yarn up '*'` errors when the project has no direct dependencies
  // (`internal/server-webpack5` is just `yarn init -y`). The lockfile from
  // `yarn install` is already valid; a failure here is non-fatal.
  try {
    await runCommand(`yarn up '*' --mode=update-lockfile`, { cwd, env }, debug);
  } catch (error) {
    console.warn(
      `⚠️ yarn up '*' skipped (likely no upgradeable dependencies); keeping the ` +
        `lockfile from yarn install.`
    );
    if (debug) {
      console.warn(error);
    }
  }
}
