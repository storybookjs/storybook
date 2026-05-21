import { readFile, rename, rm, writeFile } from 'node:fs/promises';

import { join } from 'path';

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
 * 2. Pin Yarn 4 via the `package.json` `packageManager` field so corepack
 *    resolves it deterministically (no network `yarn set version`).
 * 3. Set `npmMinimalAgeGate` to 7 days so resolution skips quarantined versions.
 * 4. Run `yarn up '*'` then `yarn install` (both `--mode=update-lockfile`).
 *    `yarn up` runs first so it rewrites bleeding-edge `package.json` ranges
 *    to the newest gate-satisfying versions before the install resolves them.
 *
 * `YARN_ENABLE_IMMUTABLE_INSTALLS=false` is set via env (not `.yarnrc.yml`) so
 * the consumer-facing config stays clean.
 */
export async function refreshBeforeStorybookLockfile({
  cwd,
  debug,
  disableMinAgeGate,
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

  const gateMinutes = disableMinAgeGate ? 0 : BEFORE_SANDBOX_MIN_AGE_MINUTES;
  await runCommand(`yarn config set npmMinimalAgeGate ${gateMinutes}`, { cwd, env }, debug);

  // `yarn up` must run BEFORE `yarn install`. The template's CLI pins
  // bleeding-edge versions (`ng new` → `@angular/build@^21.x`) that are inside
  // the age-gate window; resolving those as-is fails with "No candidates
  // found". `yarn up '*'` rewrites every direct dependency in package.json to
  // the newest version that satisfies the gate, so the subsequent install
  // resolves cleanly.
  //
  // `yarn up '*'` errors when the project has no direct dependencies
  // (`internal/server-webpack5` is just `yarn init -y`) — non-fatal, the
  // install below still produces a valid lockfile.
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
 * Copy the monorepo's pinned Yarn version into the sandbox `package.json`
 * `packageManager` field. corepack then resolves Yarn 4 deterministically for
 * every `yarn` command run in the sandbox, with no network `yarn set version`.
 */
async function pinYarnPackageManager(cwd: string) {
  const rootPackageJson = JSON.parse(
    await readFile(join(ROOT_DIRECTORY, 'package.json'), 'utf-8')
  );
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
