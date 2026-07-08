import { gt, prerelease, valid } from 'semver';

import type { JsPackageManager } from './JsPackageManager.ts';
import { PackageManagerName } from './JsPackageManager.ts';

export type StorybookInstallContext = 'create' | 'upgrade';

export const STORYBOOK_PACKAGE_PATTERNS = [
  'storybook',
  '@storybook/*',
  'eslint-plugin-storybook',
  '@chromatic-com/storybook',
] as const;

const escapePatternForRegex = (pattern: string) => pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const packagePatternToRegex = (pattern: string) =>
  new RegExp(`^${escapePatternForRegex(pattern).replace(/\\\*/g, '.*')}$`);

export const hasStorybookMinimumAgeExclusions = (configuredPatterns: string[]) => {
  return STORYBOOK_PACKAGE_PATTERNS.every((storybookPattern) =>
    configuredPatterns.some((configuredPattern) =>
      packagePatternToRegex(configuredPattern).test(storybookPattern)
    )
  );
};

// input: @storybook/addon-essentials@npm:7.0.0
// output: { name: '@storybook/addon-essentials', value: { version : '7.0.0', location: '' } }
export const parsePackageData = (packageName = '') => {
  const [first, second, third] = packageName
    .replace(/[└─├]+/g, '')
    .trim()
    .split('@');
  const version = (third || second).replace('npm:', '');
  const name = third ? `@${second}` : first;

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

export const parseReleaseTime = (value: unknown): Date | null => {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const releaseTime = new Date(value);
  return Number.isNaN(releaseTime.getTime()) ? null : releaseTime;
};

export const parsePackageTimeMap = (value: unknown): Record<string, string> | null => {
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

export const getAgeInMinutes = (publishedAt: Date, now = new Date()) => {
  return Math.floor((now.getTime() - publishedAt.getTime()) / 60_000);
};

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

/** Args for `runPackageCommand({ useRemotePkg: true })` when bootstrapping a Storybook CLI package. */
export function getRemotePackageRunnerArgs(
  packageManagerType: PackageManagerName,
  pkg: string,
  version: string,
  args: string[]
): string[] {
  const pkgWithVersion = `${pkg}@${version}`;
  return packageManagerType === PackageManagerName.NPM
    ? ['--yes', pkgWithVersion, ...args]
    : [pkgWithVersion, ...args];
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
