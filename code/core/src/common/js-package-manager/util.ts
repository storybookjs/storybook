import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import { compare, gt, maxSatisfying, prerelease, satisfies, valid } from 'semver';

import { logger } from '../../node-logger/index.ts';
import { isCI } from '../utils/envs.ts';
import versions from '../versions.ts';
import type { JsPackageManager } from './JsPackageManager.ts';
import { PackageManagerName } from './JsPackageManager.ts';
import type { InstallationMetadata, PublishedManifest, ReleaseAgeGate } from './types.ts';

export type StorybookInstallContext = 'create' | 'upgrade';

// Storybook's packages depend on each other at exact versions, so an age gate that lets one of them
// through has to let all of them through.
export const STORYBOOK_PACKAGE_NAMES: readonly string[] = [
  ...Object.keys(versions),
  '@chromatic-com/storybook',
  'chromatic',
];

export const STORYBOOK_PACKAGE_PATTERNS: readonly string[] = [
  '@storybook/*',
  ...STORYBOOK_PACKAGE_NAMES.filter((name) => !name.startsWith('@storybook/')),
];

const escapePatternForRegex = (pattern: string) => pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const packagePatternToRegex = (pattern: string, questionMarkWildcard = false) => {
  const source = escapePatternForRegex(pattern).replace(/\\\*/g, '.*');
  return new RegExp(`^${questionMarkWildcard ? source.replace(/\\\?/g, '.') : source}$`);
};

export const NO_RELEASE_AGE_GATE: ReleaseAgeGate = {
  strict: true,
  getMinutes: () => 0,
  isExcluded: () => false,
};

const excludesStorybookPackages = (gate: ReleaseAgeGate, version: string) =>
  STORYBOOK_PACKAGE_NAMES.every((name) => gate.isExcluded(name, version));

export const getStorybookReleaseAgeGateMinutes = (
  gate: ReleaseAgeGate | null,
  storybookVersion: string
) =>
  gate?.strict && !excludesStorybookPackages(gate, storybookVersion)
    ? gate.getMinutes('storybook')
    : 0;

export const parseExactVersionsPattern = (
  pattern: string
): { packageName: string; versions: string[] } | null => {
  const separator = pattern.indexOf('@', 1);
  if (separator === -1) {
    return { packageName: pattern, versions: [] };
  }

  const exactVersions = pattern
    .slice(separator + 1)
    .split('||')
    .map((version) => valid(version));
  return exactVersions.every((version): version is string => version !== null)
    ? { packageName: pattern.slice(0, separator), versions: exactVersions }
    : null;
};

/**
 * Checks whether the package manager's age gate would block this Storybook version, before a
 * command installs it. Throws `MinimumReleaseAgeHandledError` once the user has been told how to
 * go on. A precheck that fails for another reason does not stop the command.
 */
export const runStorybookInstallPrecheck = async (
  packageManager: Pick<JsPackageManager, 'precheckStorybookPackageInstall'>,
  {
    yes,
    ...options
  }: { storybookVersion: string; installContext: StorybookInstallContext; yes: boolean }
) => {
  try {
    await packageManager.precheckStorybookPackageInstall({
      ...options,
      nonInteractive: yes || !process.stdout.isTTY || !!isCI(),
    });
  } catch (error) {
    if (error instanceof MinimumReleaseAgeHandledError) {
      throw error;
    }
    logger.debug(`Skipping minimum-release-age precheck after an unexpected failure: ${error}`);
  }
};

type DependencyTree = Record<string, { version: string; dependencies?: DependencyTree }>;

// Breadth-first, so the version a project depends on comes before those its dependencies bring in.
export const findInstallationsInDependencyTree = (
  tree: DependencyTree,
  pattern: string[]
): Pick<InstallationMetadata, 'dependencies' | 'duplicatedDependencies'> => {
  const regexes = pattern.map((entry) => packagePatternToRegex(entry));
  const versions: Record<string, string[]> = {};
  let level = Object.entries(tree);
  while (level.length > 0) {
    for (const [name, { version }] of level) {
      if (regexes.some((regex) => regex.test(name)) && !versions[name]?.includes(version)) {
        (versions[name] ??= []).push(version);
      }
    }
    level = level.flatMap(([, node]) => Object.entries(node.dependencies ?? {}));
  }
  const found = Object.entries(versions);
  return {
    dependencies: Object.fromEntries(
      found.map(([name, list]) => [name, list.map((version) => ({ version, location: '' }))])
    ),
    duplicatedDependencies: Object.fromEntries(found.filter(([, list]) => list.length > 1)),
  };
};

// input: @storybook/addon-essentials@npm:7.0.0
// output: { name: '@storybook/addon-essentials', value: { version : '7.0.0', location: '' } }
export const parsePackageData = (packageName = '') => {
  const descriptor = packageName.replace(/[└─├]+/g, '').trim();
  const separator = descriptor.indexOf('@', 1);
  const name = descriptor.slice(0, separator);
  const reference = descriptor.slice(separator + 1);
  // Yarn Berry lists patched packages, such as its built-in `typescript` compat patch, as
  // `typescript@patch:typescript@npm%3A7.0.2#optional!builtin<compat/typescript>::version=7.0.2&hash=…`.
  const version = reference.match(/::version=([^&]+)/)?.[1] ?? reference.replace('npm:', '');

  const value = { version, location: '' };
  return { name, value };
};

export const parsePositiveIntegerConfigValue = (value: string | null | undefined) => {
  const normalizedValue = value?.trim() ?? '';

  if (
    !normalizedValue ||
    normalizedValue === 'undefined' ||
    normalizedValue === 'null' ||
    normalizedValue === 'false'
  ) {
    return null;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const YARN_AGE_GATE_UNITS_IN_MINUTES = {
  ms: 1 / 60_000,
  s: 1 / 60,
  m: 1,
  h: 60,
  d: 60 * 24,
  w: 60 * 24 * 7,
} as const;

export const parseYarnMinimalAgeGateMinutes = (value: string | null | undefined): number | null => {
  const normalizedValue = value?.trim() ?? '';

  if (
    !normalizedValue ||
    normalizedValue === 'undefined' ||
    normalizedValue === 'null' ||
    normalizedValue === 'false'
  ) {
    return null;
  }

  if (normalizedValue.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalizedValue) as { secs?: unknown; nanos?: unknown };
      if (typeof parsed.secs === 'number') {
        const nanos = typeof parsed.nanos === 'number' ? parsed.nanos : 0;
        const minutes = parsed.secs / 60 + nanos / 60_000_000_000;
        return minutes > 0 ? minutes : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  const duration = normalizedValue.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/);
  if (duration) {
    const amount = Number(duration[1]);
    const unit = duration[2] as keyof typeof YARN_AGE_GATE_UNITS_IN_MINUTES;
    const minutes = amount * YARN_AGE_GATE_UNITS_IN_MINUTES[unit];
    return minutes > 0 ? minutes : null;
  }

  if (!/^\d+$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return parsedValue > 0 ? parsedValue : null;
};

export const readPackageVersions = (value: unknown): string[] | null => {
  if (Array.isArray(value)) {
    const versions = value.filter(
      (entry): entry is string => typeof entry === 'string' && !!valid(entry)
    );
    return versions.length > 0 ? versions : null;
  }

  if (value && typeof value === 'object') {
    const versions = Object.keys(value).filter((version) => !!valid(version));
    return versions.length > 0 ? versions.sort(compare) : null;
  }

  return null;
};

const readDependencyMap = (value: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(value && typeof value === 'object' ? value : {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );

export const parsePublishedManifest = (value: unknown): PublishedManifest | null => {
  const manifest = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (!manifest || typeof manifest !== 'object') {
    return null;
  }

  const { version, versions, time, dependencies, peerDependencies } = manifest as Record<
    string,
    unknown
  >;
  if (typeof version !== 'string' || !valid(version)) {
    return null;
  }

  return {
    version,
    versions: readPackageVersions(versions) ?? [],
    time: parsePackageTimeMap(time) ?? {},
    dependencies: readDependencyMap(dependencies),
    peerDependencies: readDependencyMap(peerDependencies),
  };
};

export const parseReleaseTime = (value: unknown): Date | null => {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const releaseTime = new Date(value);
  return Number.isNaN(releaseTime.getTime()) ? null : releaseTime;
};

export const parsePackageTimeMap = (value: unknown): Record<string, string> | null => {
  // pnpm < 11 forwards `view` to npm. With npm 12, the time map is wrapped in an array.
  // https://github.com/npm/cli/releases/tag/v12.0.0
  if (Array.isArray(value) && value.length === 1) {
    value = value[0];
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const timeMap: Record<string, string> = {};
  for (const [version, releaseTime] of Object.entries(value)) {
    if (typeof releaseTime === 'string' && releaseTime.length > 0) {
      timeMap[version] = releaseTime;
    }
  }

  return timeMap;
};

export const isOldEnough = (publishedAt: Date, minutes: number, now = new Date()) =>
  now.getTime() - publishedAt.getTime() >= minutes * 60_000;

export type ReleaseAgeVerdict = 'allowed' | 'held back' | 'unknown';

export const getReleaseAgeVerdict = (
  gate: ReleaseAgeGate | null,
  packageName: string,
  version: string,
  time: Record<string, string>,
  now = new Date()
): ReleaseAgeVerdict => {
  if (!gate) {
    return 'unknown';
  }

  const minutes = gate.getMinutes(packageName);
  if (minutes <= 0 || gate.isExcluded(packageName, version)) {
    return 'allowed';
  }

  const publishedAt = parseReleaseTime(time[version]);
  if (!publishedAt) {
    return 'unknown';
  }

  return isOldEnough(publishedAt, minutes, now) ? 'allowed' : 'held back';
};

export const selectInstallableVersion = ({
  packageName,
  range,
  latest,
  gate,
  prefersLatestTag = true,
  now = new Date(),
}: {
  packageName: string;
  range: string;
  latest: PublishedManifest;
  gate: ReleaseAgeGate | null;
  prefersLatestTag?: boolean;
  now?: Date;
}): string | null => {
  const matching = [...new Set([latest.version, ...latest.versions])].filter((version) =>
    satisfies(version, range)
  );
  const verdicts = matching.map((version) =>
    getReleaseAgeVerdict(gate, packageName, version, latest.time, now)
  );
  if (verdicts.includes('unknown')) {
    return null;
  }

  const allowed = matching.filter((_, index) => verdicts[index] === 'allowed');
  const installable = allowed.length > 0 ? allowed : matching;
  return prefersLatestTag && installable.includes(latest.version)
    ? latest.version
    : maxSatisfying(installable, range);
};

export const isPackageInLockfile = (lockfile: string, packageName: string) =>
  [`${packageName}@`, `${packageName}"`, `${packageName}'`].some((entry) =>
    lockfile.includes(entry)
  );

export const getLatestStableVersionAdheringToMinimumAgeGate = (
  timeMap: Record<string, string>,
  minimumAgeGateMinutes: number,
  now = new Date()
): string | null => {
  const cutoff = now.getTime() - minimumAgeGateMinutes * 60_000;
  let latestStableVersion: string | null = null;

  for (const [version, releaseTime] of Object.entries(timeMap)) {
    if (!valid(version) || prerelease(version)) {
      continue;
    }

    const publishedAt = parseReleaseTime(releaseTime);
    if (!publishedAt || publishedAt.getTime() > cutoff) {
      continue;
    }

    if (!latestStableVersion || gt(version, latestStableVersion)) {
      latestStableVersion = version;
    }
  }

  return latestStableVersion;
};

/**
 * Args for `runPackageCommand({ useRemotePkg: true })` when bootstrapping a Storybook CLI package
 * that isn't installed locally.
 *
 * npm and Yarn Classic both execute the remote package through `npx`, which prompts "Ok to
 * proceed?" before downloading and hangs in non-interactive/CI environments. `--yes` auto-confirms
 * that install. pnpm (`dlx`), Yarn Berry (`dlx`) and Bun (`bunx`) download without prompting, so
 * they must not receive the npx-only `--yes` flag.
 */
export function getRemotePackageRunnerArgs(
  packageManagerType: PackageManagerName,
  pkg: string,
  version: string,
  args: string[]
): string[] {
  const pkgWithVersion = `${pkg}@${version}`;
  const usesNpx =
    packageManagerType === PackageManagerName.NPM ||
    packageManagerType === PackageManagerName.YARN1;
  if (!usesNpx) {
    return [pkgWithVersion, ...args];
  }

  // npm 12 defaults allow-remote to none. pkg.pr.new specifiers are remote URLs.
  if (/^https?:\/\//.test(version)) {
    return ['--yes', '--allow-remote=all', pkgWithVersion, ...args];
  }

  return ['--yes', pkgWithVersion, ...args];
}

export function getVitestStorybookRunCommand(packageManager: JsPackageManager, file?: string) {
  const args = ['vitest', '--project', 'storybook', 'run'];
  if (file) {
    args.push(file);
  }
  return packageManager.getPackageCommand(args);
}

export function getMswInitCommand(packageManager: JsPackageManager) {
  return packageManager.getPackageCommand(['msw', 'init', './public', '--save']);
}

export const getStorybookRerunCommand = (
  installContext: StorybookInstallContext,
  compatibleVersion: string | null
) => {
  if (installContext === 'create') {
    return compatibleVersion
      ? `npx create-storybook@${compatibleVersion}`
      : 'npx create-storybook@<compatible-version>';
  }

  return compatibleVersion
    ? `npx storybook@${compatibleVersion} upgrade`
    : 'npx storybook@<compatible-version> upgrade';
};

export const getStorybookRerunInstruction = (installContext: StorybookInstallContext) => {
  return installContext === 'create'
    ? 'Please rerun Storybook creation with:'
    : 'Please rerun the Storybook upgrade with:';
};

export const getErrorLogs = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const structuredError = error as {
      stderr?: string;
      stdout?: string;
      shortMessage?: string;
      originalMessage?: string;
      message?: string;
    };

    const structuredLogs = [
      structuredError.shortMessage,
      structuredError.originalMessage,
      structuredError.stderr,
      structuredError.stdout,
      structuredError.message,
    ].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);

    if (structuredLogs.length > 0) {
      return structuredLogs.join('\n');
    }
  }

  return String(error);
};

/** Number of trailing output lines surfaced when a package install fails. */
export const INSTALL_ERROR_TAIL_LINES = 15;

/**
 * The tail of a failed package install's captured output (see `getErrorLogs`). Output longer than
 * `lines` lines is truncated to the last `lines` — package managers print their own error summary
 * (e.g. an npm ERESOLVE explanation) at the end. Returns '' only when there is no captured output
 * at all; short outputs are returned in full so they are still logged and folded into the error.
 */
export const getInstallErrorTail = (error: unknown, lines: number = INSTALL_ERROR_TAIL_LINES) => {
  const output = getErrorLogs(error).trimEnd();
  if (!output) {
    return '';
  }

  const allLines = output.split('\n');
  return allLines.slice(-lines).join('\n').trim();
};

/** The package manager error code (e.g. npm `ERESOLVE`, pnpm `ERR_PNPM_…`) in captured output. */
export function extractPackageManagerErrorCode(logs: string): string | undefined {
  const npmMatch = logs.match(/npm\s+(?:ERR!|error)\s+code\s+([A-Z0-9_]+)/i);
  if (npmMatch) {
    return npmMatch[1];
  }

  const pnpmMatch = logs.match(/(ERR_PNPM_[A-Z0-9_]+)/);
  if (pnpmMatch) {
    return pnpmMatch[1];
  }

  return undefined;
}

export const isNpmPeerResolutionError = (error: unknown): boolean =>
  extractPackageManagerErrorCode(getErrorLogs(error)) === 'ERESOLVE';
