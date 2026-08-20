import { readFile, rename, rm, writeFile } from 'node:fs/promises';

import { join } from 'path';

import semver from 'semver';
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
 * 7-day age gate for generated sandboxes.
 *
 * - Yarn: `BEFORE_SANDBOX_MIN_AGE_GATE` / `BEFORE_SANDBOX_MIN_AGE_MINUTES`
 * - npm scaffold: `BEFORE_SANDBOX_NPM_MIN_RELEASE_AGE_DAYS` → `NPM_CONFIG_MIN_RELEASE_AGE`
 */
export const BEFORE_SANDBOX_MIN_AGE_GATE = '7d';
export const BEFORE_SANDBOX_MIN_AGE_MINUTES = 7 * 24 * 60;
/** npm `min-release-age` is in days (npm 11.10+). */
export const BEFORE_SANDBOX_NPM_MIN_RELEASE_AGE_DAYS = 7;
/**
 * npm below this version silently ignores `NPM_CONFIG_MIN_RELEASE_AGE`.
 * 11.17+ is required for `min-release-age-exclude`, which templates with
 * `minAgeGateExemptions` rely on during npx/npm scaffolds.
 */
export const BEFORE_SANDBOX_NPM_MIN_VERSION = '11.17.0';

export async function ensureNpmSupportsMinReleaseAge() {
  const { stdout } = await runCommand('npm --version', { cwd: process.cwd() });
  const version = String(stdout).trim();
  if (!semver.gte(version, BEFORE_SANDBOX_NPM_MIN_VERSION)) {
    throw new Error(
      `Sandbox generation requires npm >= ${BEFORE_SANDBOX_NPM_MIN_VERSION} so NPM_CONFIG_MIN_RELEASE_AGE and min-release-age-exclude are honored (found ${version}). Upgrade with: npm install -g npm@${BEFORE_SANDBOX_NPM_MIN_VERSION}`
    );
  }
}

/**
 * Templates with a Yarn allowlist also need matching npm exclusions when their
 * before-script runs through npx/npm. Array config cannot be expressed reliably
 * via environment variables, so write a scratch `.npmrc` in the scaffold cwd.
 */
export async function writeScaffoldNpmrc(cwd: string, minAgeGateExemptions: string[]) {
  if (!minAgeGateExemptions.length) {
    return;
  }

  const lines = [
    `min-release-age=${BEFORE_SANDBOX_NPM_MIN_RELEASE_AGE_DAYS}`,
    ...minAgeGateExemptions.map((pattern) => `min-release-age-exclude[]=${pattern}`),
  ];

  await writeFile(join(cwd, '.npmrc'), `${lines.join('\n')}\n`);
}

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
 * 4. Run `yarn install --mode=update-lockfile`, narrowing only the ranges that
 *    the gate leaves with no installable version (see `narrowQuarantinedRanges`).
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
    // Yarn colourises and hyperlinks its output whenever `CI` is set, which splits both
    // `YN0016:` and the `name@npm:range` descriptor that `narrowQuarantinedRanges` reads
    // back out of a failed install. Keep the output plain so it stays parseable.
    YARN_ENABLE_COLORS: 'false',
    YARN_ENABLE_HYPERLINKS: 'false',
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

  await narrowQuarantinedRanges({ cwd, env, debug });
}

/** `YN0016: @angular/build@npm:^22.1.3: All versions satisfying "^22.1.3" are quarantined` */
const QUARANTINED_RANGE = /YN0016:.*?(\S+)@npm:.*?are quarantined/g;

/** Present whenever the gate rejected something, whatever the surrounding formatting. */
const QUARANTINE_REPORTED = /are quarantined/;

function parseQuarantinedPackages(output: string): string[] {
  return [...output.matchAll(QUARANTINED_RANGE)].map(([, name]) => name);
}

/** Yarn's wording when `yarn up` is handed a package the manifest does not declare. */
const NOT_A_DIRECT_DEPENDENCY = /doesn't match any packages referenced by any workspace/;

/**
 * The `yarn up` descriptor that moves a quarantined package onto its newest installable
 * release without leaving the major the template asked for.
 *
 * A bare `yarn up typescript` ignores the declared range and takes the newest release of
 * any major. Passing an explicit range bounds it instead, and the gate then picks the
 * newest allowed version inside that range. Unparseable ranges (`latest`, `workspace:*`)
 * carry no major to preserve, so they fall back to the bare name.
 */
function narrowingDescriptor(name: string, range: string | undefined): string {
  const floor = range && semver.validRange(range) ? semver.minVersion(range) : null;
  if (!floor) {
    return name;
  }

  // Every stable release in the major sorts above a prerelease, so no range can admit
  // newer canaries without also admitting stable.
  if (semver.prerelease(floor)) {
    throw new Error(
      `${name}@${range} is quarantined by the ${BEFORE_SANDBOX_MIN_AGE_MINUTES}min age gate, and narrowing a prerelease range would resolve it to a stable release. Add ${name} to the template's minAgeGateExemptions.`
    );
  }

  // Caret treats a 0.x major as breaking, so those keep their minor.
  return floor.major === 0 ? `${name}@^0.${floor.minor}.0` : `${name}@^${floor.major}.0.0`;
}

async function declaredRange(cwd: string, name: string): Promise<string | undefined> {
  const manifest = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8'));
  return manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
}

/** Angular, the widest template, needs 12. The rest is headroom. */
const MAX_NARROWING_ROUNDS = 25;

/**
 * Resolve a lockfile under the age gate, rewriting as few manifest ranges as possible.
 *
 * A range whose every matching release is younger than the gate has nothing installable,
 * and `yarn install` fails outright. `yarn up` is the escape hatch, but it rewrites the
 * ranges of whatever it is given, so `yarn up '*'` rewrites the whole manifest — that is
 * what turned the Angular sandbox's `typescript: ~6.0.2` into `^7.0.2`, which Compodoc
 * (bundling TypeScript 6) cannot parse.
 *
 * Yarn reports one offending range per run and re-resolves the whole project on each
 * attempt, so the only way to fix them is to accumulate the names it reports and pass the
 * growing set to a single `yarn up`.
 */
async function narrowQuarantinedRanges({
  cwd,
  env,
  debug,
}: {
  cwd: string;
  env: NodeJS.ProcessEnv;
  debug?: boolean;
}) {
  const quarantined: string[] = [];
  const descriptors: string[] = [];
  let resolved = false;

  for (let round = 0; round <= MAX_NARROWING_ROUNDS && !resolved; round++) {
    const command = descriptors.length
      ? `yarn up ${descriptors.map((descriptor) => `'${descriptor}'`).join(' ')} --mode=update-lockfile`
      : `yarn install --mode=update-lockfile`;

    try {
      // Capture rather than stream even under `debug`: the rejection is only readable
      // off the failed command's stdout.
      const { stdout } = await runCommand(command, { cwd, env, stdout: 'pipe' }, debug);
      if (debug) {
        console.log(stdout);
      }
      resolved = true;
    } catch (error) {
      const output = `${(error as { stdout?: string }).stdout ?? ''}\n${
        (error as { stderr?: string }).stderr ?? ''
      }`;

      if (NOT_A_DIRECT_DEPENDENCY.test(output)) {
        throw new Error(
          `A transitively required package is quarantined by the ${BEFORE_SANDBOX_MIN_AGE_MINUTES}min age gate, and only its parent can move off it. Add it to the template's minAgeGateExemptions if it is trusted.`,
          { cause: error }
        );
      }

      const reported = parseQuarantinedPackages(output);

      // Yarn rejected a range but we could not read a package out of it, so the output
      // shape has moved (it already did once, when colour escapes split the descriptor).
      // Say that plainly instead of reporting it as an unrelated resolution failure.
      if (!reported.length && QUARANTINE_REPORTED.test(output)) {
        throw new Error(
          `Could not read the quarantined package out of Yarn's output. The age-gate workaround cannot run until this parser is updated.`,
          { cause: error }
        );
      }

      const fresh = reported.filter((name) => !quarantined.includes(name));

      // Either not an age-gate failure at all, or a package still quarantined across its
      // whole major. Widening further would leave the major, so let a human decide.
      if (!fresh.length) {
        throw error;
      }

      quarantined.push(...fresh);
      descriptors.push(
        ...(await Promise.all(
          fresh.map(async (name) => narrowingDescriptor(name, await declaredRange(cwd, name)))
        ))
      );
    }
  }

  if (!resolved) {
    throw new Error(
      `Still hitting the ${BEFORE_SANDBOX_MIN_AGE_MINUTES}min age gate after ${MAX_NARROWING_ROUNDS} rounds of narrowing (${quarantined.join(', ')}).`
    );
  }

  if (!descriptors.length) {
    return;
  }

  console.warn(
    `⚠️ narrowed ${descriptors.length} range(s) with no release older than the ${BEFORE_SANDBOX_MIN_AGE_MINUTES}min age gate: ${descriptors.join(', ')}`
  );

  // So the committed lockfile is always the product of a plain `yarn install`.
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
