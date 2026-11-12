import { readFile, rm, writeFile } from 'node:fs/promises';

import { join } from 'pathe';
import semver from 'semver';

import { packageManager as monorepoPackageManager } from '../../../package.json';
import { BEFORE_SANDBOX_NPM_MIN_VERSION } from '../../utils/constants.ts';
import { SANDBOX_MINIMUM_RELEASE_AGE, updateWorkspaceConfig } from '../../utils/pnpm.ts';
import { runCommand } from '../generate.ts';

export { BEFORE_SANDBOX_NPM_MIN_VERSION };

export {
  LOCALLY_PUBLISHED_PACKAGE_PATTERNS,
  preapproveLocallyPublishedPackages,
} from '../../utils/preapprove-local-packages.ts';

export const PUBLISHED_SANDBOX_PACKAGE_MANAGER: string = monorepoPackageManager;

/** The user agent the pinned pnpm sends. */
export const PUBLISHED_SANDBOX_USER_AGENT = `${PUBLISHED_SANDBOX_PACKAGE_MANAGER.split('+')[0].replace('@', '/')} npm/? node/${process.version} ${process.platform} ${process.arch}`;

/** npm `min-release-age` is in days (npm 11.10+). */
export const BEFORE_SANDBOX_NPM_MIN_RELEASE_AGE_DAYS = 7;

export const AFTER_SANDBOX_MINIMUM_RELEASE_AGE = 1440;

const AGE_GATE = `${SANDBOX_MINIMUM_RELEASE_AGE / 1440}-day age gate`;

export async function ensureNpmSupportsMinReleaseAge() {
  const { stdout } = await runCommand('npm --version', { cwd: process.cwd() });
  const version = String(stdout).trim();
  if (!semver.gte(version, BEFORE_SANDBOX_NPM_MIN_VERSION)) {
    throw new Error(
      `Sandbox generation requires npm >= ${BEFORE_SANDBOX_NPM_MIN_VERSION} so NPM_CONFIG_MIN_RELEASE_AGE and min-release-age-exclude are honored (found ${version}). Upgrade with: npm install -g npm@${BEFORE_SANDBOX_NPM_MIN_VERSION}`
    );
  }
}

/** Writes the npm age-gate exclusions for a before-script, which environment variables cannot express. */
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

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

type Dependencies = Record<string, string>;

type Manifest = { packageManager?: string; resolutions?: Dependencies } & {
  [field in (typeof DEPENDENCY_FIELDS)[number]]?: Dependencies;
};

const readManifest = async (cwd: string): Promise<Manifest> =>
  JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8'));

// Sorts the dependency maps as Yarn did.
const writeManifest = async (cwd: string, manifest: Manifest) => {
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest[field];
    if (dependencies) {
      manifest[field] = Object.fromEntries(
        Object.entries(dependencies).sort(([a], [b]) => (a < b ? -1 : 1))
      );
    }
  }
  await writeFile(join(cwd, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
};

interface RefreshLockfileOptions {
  cwd: string;
  debug?: boolean;
  /** Packages or globs exempt from the age gate, including everything released in lockstep. */
  minAgeGateExemptions?: string[];
}

/** Turns a scaffolded before-storybook folder into the pnpm project the sandboxes repository publishes. */
export async function refreshBeforeStorybookLockfile({
  cwd,
  debug,
  minAgeGateExemptions = [],
}: RefreshLockfileOptions) {
  await Promise.all(
    ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.yarnrc.yml', '.yarnrc', '.yarn'].map(
      (file) => rm(join(cwd, file), { recursive: true, force: true })
    )
  );

  const manifest = await readManifest(cwd);
  manifest.packageManager = PUBLISHED_SANDBOX_PACKAGE_MANAGER;
  await writeManifest(cwd, manifest);

  await updateWorkspaceConfig(cwd, (config) => ({
    ...config,
    packages: ['.'],
    nodeLinker: 'hoisted',
    minimumReleaseAge: SANDBOX_MINIMUM_RELEASE_AGE,
    ...(minAgeGateExemptions.length > 0 && {
      minimumReleaseAgeExclude: Array.from(
        new Set([...(config.minimumReleaseAgeExclude ?? []), ...minAgeGateExemptions])
      ),
    }),
  }));

  await resolveUnderAgeGate({ cwd, debug });
}

/** Sets the 1-day age gate and pins the dependencies that `resolutions` names to its versions. */
export async function finishAfterStorybook(cwd: string) {
  await updateWorkspaceConfig(cwd, (config) => ({
    ...config,
    minimumReleaseAge: AFTER_SANDBOX_MINIMUM_RELEASE_AGE,
  }));

  const manifest = await readManifest(cwd);
  const { resolutions = {} } = manifest;
  for (const dependencies of [manifest.dependencies, manifest.devDependencies]) {
    for (const name of Object.keys(dependencies ?? {})) {
      if (resolutions[name] && dependencies) {
        dependencies[name] = resolutions[name];
      }
    }
  }
  await writeManifest(cwd, manifest);
}

const GATE_ERROR = 'ERR_PNPM_NO_MATURE_MATCHING_VERSION';

const RESOLVE_COMMAND =
  'pnpm install --lockfile-only --registry=https://registry.npmjs.org/ --reporter=ndjson';

// Error records embed whole registry documents.
const RESOLVE_MAX_BUFFER = 256 * 1024 * 1024;

const OUTPUT_TAIL = 4000;

const MAX_WIDENING_ROUNDS = 25;

type PnpmErrorRecord = {
  code?: string;
  err?: { message?: string };
  package?: { name?: string };
  pkgsStack?: unknown[];
};

/** The error records of pnpm's `--reporter=ndjson` output, without their registry documents. */
export function parsePnpmErrorRecords(output: string): PnpmErrorRecord[] {
  return output.split('\n').flatMap((line) => {
    if (!line.startsWith('{')) {
      return [];
    }
    try {
      const record = JSON.parse(line);
      delete record.packageMeta;
      return record.level === 'error' ? [record] : [];
    } catch {
      return [];
    }
  });
}

// The whole major of the range's lowest version.
function widenedRange(name: string, range: string): string {
  const floor = semver.validRange(range) ? semver.minVersion(range) : null;
  if (!floor) {
    throw new Error(
      `${name}@${range} is quarantined by the ${AGE_GATE}, and its range names no version to widen from. Add ${name} to the template's minAgeGateExemptions.`
    );
  }

  if (semver.prerelease(floor)) {
    throw new Error(
      `${name}@${range} is quarantined by the ${AGE_GATE}, and widening a prerelease range would resolve it to a stable release. Add ${name} to the template's minAgeGateExemptions.`
    );
  }

  // Caret treats a 0.x major as breaking, so those keep their minor.
  return floor.major === 0 ? `^0.${floor.minor}.0` : `^${floor.major}.0.0`;
}

function resolutionFailure(error: unknown, records: PnpmErrorRecord[]) {
  const {
    shortMessage = `\`${RESOLVE_COMMAND}\` failed`,
    stdout = '',
    stderr = '',
  } = error as { shortMessage?: string; stdout?: string; stderr?: string };
  // Without a record, pnpm failed before its reporter ran.
  const reasons = records.length
    ? records.map(({ code, err }) => `${code ?? 'error'}: ${err?.message ?? ''}`)
    : [String(stdout).slice(-OUTPUT_TAIL)];

  return new Error(
    [shortMessage, ...reasons, String(stderr).slice(-OUTPUT_TAIL)]
      .map((part) => part.trim())
      .filter(Boolean)
      .join('\n')
  );
}

const UNREADABLE_GATE_ERROR = `Could not read the quarantined package out of pnpm's output. The age-gate workaround cannot run until this parser is updated.`;

/** Resolves the lockfile under the age gate, widening each direct range with no mature release to its major. */
export async function resolveUnderAgeGate({ cwd, debug }: { cwd: string; debug?: boolean }) {
  const env = { ...process.env, CI: 'true', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
  const widened = new Map<string, string>();

  for (let round = 0; round <= MAX_WIDENING_ROUNDS; round++) {
    const failure = await runCommand(
      RESOLVE_COMMAND,
      { cwd, env, stdout: 'pipe', maxBuffer: RESOLVE_MAX_BUFFER },
      debug
    ).then(
      () => undefined,
      (error: unknown) => error ?? new Error(`\`${RESOLVE_COMMAND}\` failed`)
    );

    if (!failure) {
      if (widened.size) {
        const ranges = [...widened].map(([name, range]) => `${name}@${range}`);
        console.warn(
          `⚠️ widened ${widened.size} range(s) with no release older than the ${AGE_GATE}: ${ranges.join(', ')}`
        );
      }
      return;
    }

    const { stdout = '', stderr = '' } = failure as { stdout?: string; stderr?: string };
    const records = parsePnpmErrorRecords(String(stdout));
    const gated = records.filter(({ code }) => code === GATE_ERROR);

    if (!gated.length) {
      if (`${stdout}${stderr}`.includes(GATE_ERROR)) {
        throw new Error(UNREADABLE_GATE_ERROR);
      }
      throw resolutionFailure(failure, records);
    }

    const reported = gated.flatMap(({ package: pkg, pkgsStack }) =>
      typeof pkg?.name === 'string' ? [{ name: pkg.name, viaParent: !!pkgsStack?.length }] : []
    );
    if (reported.length < gated.length) {
      throw new Error(UNREADABLE_GATE_ERROR);
    }

    const manifest = await readManifest(cwd);
    const direct = new Map<string, Dependencies>();
    const transitive = new Set<string>();
    for (const { name, viaParent } of reported) {
      const declaring = viaParent
        ? undefined
        : [manifest.dependencies, manifest.devDependencies].find(
            (dependencies) => dependencies?.[name] !== undefined
          );
      if (declaring) {
        direct.set(name, declaring);
      } else {
        transitive.add(name);
      }
    }

    if (transitive.size) {
      throw new Error(
        `${[...transitive].join(', ')} is quarantined by the ${AGE_GATE} but is not a direct dependency, so only its parent can move off it. This usually clears once it passes the gate. To unblock sooner, add it to the template's minAgeGateExemptions if it is trusted.`
      );
    }

    const stuck = [...direct.keys()].filter((name) => widened.has(name));
    if (stuck.length) {
      throw new Error(
        `${stuck.map((name) => `${name}@${widened.get(name)}`).join(', ')} still has no release older than the ${AGE_GATE}. Pick a version by hand, or add it to the template's minAgeGateExemptions if it is trusted.`
      );
    }

    for (const [name, declaring] of direct) {
      const range = widenedRange(name, declaring[name]);
      declaring[name] = range;
      widened.set(name, range);
    }
    await writeManifest(cwd, manifest);
  }

  throw new Error(
    `Still hitting the ${AGE_GATE} after ${MAX_WIDENING_ROUNDS} rounds of widening (${[...widened.keys()].join(', ')}).`
  );
}
