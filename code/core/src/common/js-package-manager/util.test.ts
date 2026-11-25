import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import { logger } from '../../node-logger/index.ts';
import { isCI } from '../utils/envs.ts';
import versions from '../versions.ts';
import { PackageManagerName } from './JsPackageManager.ts';
import { NPMProxy } from './NPMProxy.ts';
import { PNPMProxy } from './PNPMProxy.ts';
import type { PublishedManifest, ReleaseAgeGate } from './types.ts';
import {
  NO_RELEASE_AGE_GATE,
  getErrorLogs,
  getLatestStableVersionAdheringToMinimumAgeGate,
  getMswInitCommand,
  getRemotePackageRunnerArgs,
  getStorybookRerunCommand,
  getStorybookRerunInstruction,
  getStorybookReleaseAgeGateMinutes,
  getReleaseAgeVerdict,
  getVitestStorybookRunCommand,
  isNpmPeerResolutionError,
  isOldEnough,
  isPackageInLockfile,
  parseExactVersionsPattern,
  parsePackageData,
  parsePackageTimeMap,
  parsePositiveIntegerConfigValue,
  parsePublishedManifest,
  parseReleaseTime,
  parseYarnMinimalAgeGateMinutes,
  readPackageVersions,
  runStorybookInstallPrecheck,
  selectInstallableVersion,
  STORYBOOK_PACKAGE_NAMES,
  STORYBOOK_PACKAGE_PATTERNS,
} from './util.ts';

vi.mock('../../node-logger/index.ts', { spy: true });
vi.mock('../utils/envs.ts', { spy: true });

const now = new Date('2026-11-24T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60_000).toISOString();
const gateOf = (
  minutes: number,
  isExcluded: ReleaseAgeGate['isExcluded'] = () => false
): ReleaseAgeGate => ({ strict: true, getMinutes: () => minutes, isExcluded });
const react: PublishedManifest = {
  version: '10.6.8',
  versions: ['10.6.7', '10.6.8', '11.0.0-beta.3', '11.0.0-beta.4', '11.0.0-rc.0'],
  time: {
    '10.6.7': hoursAgo(300),
    '10.6.8': hoursAgo(100),
    '11.0.0-beta.3': hoursAgo(250),
    '11.0.0-beta.4': hoursAgo(30),
    '11.0.0-rc.0': hoursAgo(5),
  },
  dependencies: {},
  peerDependencies: {},
};

describe('js package manager util', () => {
  it('parses package data', () => {
    expect(parsePackageData('@storybook/addon-essentials@npm:7.0.0')).toEqual({
      name: '@storybook/addon-essentials',
      value: { version: '7.0.0', location: '' },
    });
    expect(parsePackageData('└─ react@npm:18.3.1')).toEqual({
      name: 'react',
      value: { version: '18.3.1', location: '' },
    });
  });

  it('parses the version of a package that Yarn Berry patches', () => {
    expect(
      parsePackageData(
        '└─ typescript@patch:typescript@npm%3A7.0.2#optional!builtin<compat/typescript>::version=7.0.2&hash=3bafbf'
      )
    ).toEqual({ name: 'typescript', value: { version: '7.0.2', location: '' } });
    expect(
      parsePackageData(
        '@types/node@patch:@types/node@npm%3A22.0.0#./patches/node.patch::version=22.0.0&hash=abc123'
      )
    ).toEqual({ name: '@types/node', value: { version: '22.0.0', location: '' } });
  });

  it('parses positive integer config values', () => {
    expect(parsePositiveIntegerConfigValue('1440\n')).toBe(1440);
    expect(parsePositiveIntegerConfigValue('0')).toBeNull();
    expect(parsePositiveIntegerConfigValue('false')).toBeNull();
  });

  it('parses Yarn age-gate durations as minutes', () => {
    expect(parseYarnMinimalAgeGateMinutes('1440\n')).toBe(1440);
    expect(parseYarnMinimalAgeGateMinutes('86400s')).toBe(1440);
    expect(parseYarnMinimalAgeGateMinutes('604800s\n')).toBe(10080);
    expect(parseYarnMinimalAgeGateMinutes('7d')).toBe(7 * 24 * 60);
    expect(parseYarnMinimalAgeGateMinutes('1w')).toBe(7 * 24 * 60);
    expect(parseYarnMinimalAgeGateMinutes('2h')).toBe(120);
    expect(parseYarnMinimalAgeGateMinutes('30m')).toBe(30);
    expect(parseYarnMinimalAgeGateMinutes('90s')).toBe(1.5);
    expect(parseYarnMinimalAgeGateMinutes('{"secs":604800,"nanos":0}')).toBe(10080);
    expect(parseYarnMinimalAgeGateMinutes('0')).toBeNull();
    expect(parseYarnMinimalAgeGateMinutes('false')).toBeNull();
    expect(parseYarnMinimalAgeGateMinutes('not-a-duration')).toBeNull();
  });

  it('reads version lists from Yarn info and from a registry packument', () => {
    expect(readPackageVersions(['1.0.0', '2.0.0'])).toEqual(['1.0.0', '2.0.0']);
    expect(readPackageVersions({ '2.0.0': {}, '1.0.0': {}, created: 'nope' })).toEqual([
      '1.0.0',
      '2.0.0',
    ]);
    expect(readPackageVersions(null)).toBeNull();
  });

  it('parses published manifests', () => {
    expect(
      parsePublishedManifest({
        name: '@storybook/react',
        version: '11.0.0-rc.0',
        versions: ['11.0.0-beta.3', '11.0.0-rc.0'],
        time: { '11.0.0-rc.0': '2026-11-24T13:46:30.813Z' },
        dependencies: { '@storybook/global': '^5.0.0', broken: null },
        peerDependencies: { storybook: '^11.0.0-rc.0' },
      })
    ).toEqual({
      version: '11.0.0-rc.0',
      versions: ['11.0.0-beta.3', '11.0.0-rc.0'],
      time: { '11.0.0-rc.0': '2026-11-24T13:46:30.813Z' },
      dependencies: { '@storybook/global': '^5.0.0' },
      peerDependencies: { storybook: '^11.0.0-rc.0' },
    });
  });

  it('parses a published manifest without versions or dependencies', () => {
    expect(parsePublishedManifest({ name: '@storybook/global', version: '5.0.0' })).toEqual({
      version: '5.0.0',
      versions: [],
      time: {},
      dependencies: {},
      peerDependencies: {},
    });
  });

  it('parses a published manifest wrapped in an array', () => {
    expect(
      parsePublishedManifest([
        { version: '11.0.0-next.2', peerDependencies: { storybook: '^11.0.0-beta.1' } },
      ])
    ).toEqual({
      version: '11.0.0-next.2',
      versions: [],
      time: {},
      dependencies: {},
      peerDependencies: { storybook: '^11.0.0-beta.1' },
    });
  });

  it.each([
    { pattern: 'storybook', expected: { packageName: 'storybook', versions: [] } },
    { pattern: '@storybook/*', expected: { packageName: '@storybook/*', versions: [] } },
    {
      pattern: '@storybook/react@11.0.0-rc.0',
      expected: { packageName: '@storybook/react', versions: ['11.0.0-rc.0'] },
    },
    {
      pattern: 'axios@0.18.1 || 0.21.1',
      expected: { packageName: 'axios', versions: ['0.18.1', '0.21.1'] },
    },
    { pattern: '@storybook/react@^11.0.0', expected: null },
  ])('parses the exclusion pattern $pattern', ({ pattern, expected }) => {
    expect(parseExactVersionsPattern(pattern)).toEqual(expected);
  });

  it.each([
    { name: 'an unreadable gate', gate: null, version: '11.0.0-rc.0', expected: 'unknown' },
    { name: 'no gate', gate: NO_RELEASE_AGE_GATE, version: '11.0.0-rc.1', expected: 'allowed' },
    {
      name: 'an excluded release',
      gate: gateOf(1440, (_, version) => version === '11.0.0-rc.0'),
      version: '11.0.0-rc.0',
      expected: 'allowed',
    },
    { name: 'an old release', gate: gateOf(1440), version: '11.0.0-beta.4', expected: 'allowed' },
    { name: 'a new release', gate: gateOf(1440), version: '11.0.0-rc.0', expected: 'held back' },
    {
      name: 'a release without a publish time',
      gate: gateOf(1440),
      version: '11.0.0-rc.1',
      expected: 'unknown',
    },
  ])('judges the age of $name', ({ gate, version, expected }) => {
    expect(getReleaseAgeVerdict(gate, '@storybook/react', version, react.time, now)).toBe(expected);
  });

  it.each([
    {
      name: 'latest when it satisfies the range',
      range: '^10.6.0',
      gate: NO_RELEASE_AGE_GATE,
      expected: '10.6.8',
    },
    {
      name: 'the highest match otherwise',
      range: '^11.0.0-beta.3',
      gate: NO_RELEASE_AGE_GATE,
      expected: '11.0.0-rc.0',
    },
    {
      name: 'the highest release the gate allows',
      range: '^11.0.0-beta.3',
      gate: gateOf(1440),
      expected: '11.0.0-beta.4',
    },
    {
      name: 'an older release when the gate holds latest back',
      range: '^10.6.0',
      gate: gateOf(200 * 60),
      expected: '10.6.7',
    },
    {
      name: 'an excluded release despite the gate',
      range: '^11.0.0-beta.3',
      gate: gateOf(1440, (_, version) => version === '11.0.0-rc.0'),
      expected: '11.0.0-rc.0',
    },
    {
      name: 'the highest match when the gate allows none',
      range: '^11.0.0-rc.0',
      gate: gateOf(1440),
      expected: '11.0.0-rc.0',
    },
    {
      name: 'nothing when no release matches',
      range: '^12.0.0',
      gate: NO_RELEASE_AGE_GATE,
      expected: null,
    },
    {
      name: 'nothing when the gate is unreadable',
      range: '^11.0.0-beta.3',
      gate: null,
      expected: null,
    },
  ])('selects $name', ({ range, gate, expected }) => {
    expect(
      selectInstallableVersion({ packageName: '@storybook/react', range, latest: react, gate, now })
    ).toBe(expected);
  });

  it('selects the highest match over latest for a package manager that ignores the tag', () => {
    const withNewerPatch = {
      ...react,
      versions: [...react.versions, '10.6.9'],
      time: { ...react.time, '10.6.9': hoursAgo(48) },
    };
    const select = (prefersLatestTag: boolean) =>
      selectInstallableVersion({
        packageName: '@storybook/react',
        range: '^10.6.0',
        latest: withNewerPatch,
        gate: NO_RELEASE_AGE_GATE,
        prefersLatestTag,
        now,
      });

    expect(select(true)).toBe('10.6.8');
    expect(select(false)).toBe('10.6.9');
  });

  it.each([
    {
      manager: 'npm',
      lockfile: '    "node_modules/@storybook/react": {\n      "version": "10.6.7",',
    },
    { manager: 'Yarn 1', lockfile: '"@storybook/react@^10.6.7":\n  version "10.6.7"' },
    { manager: 'Yarn Berry', lockfile: '"@storybook/react@npm:^10.6.7":\n  version: 10.6.7' },
    { manager: 'pnpm', lockfile: "  '@storybook/react@10.6.7':\n    resolution: {}" },
    { manager: 'bun', lockfile: '    "@storybook/react": ["@storybook/react@10.6.7", "", {}],' },
  ])('finds a package in a $manager lockfile', ({ lockfile }) => {
    expect(isPackageInLockfile(lockfile, '@storybook/react')).toBe(true);
  });

  it('does not mistake a package for one whose name starts with it', () => {
    const lockfile = [
      '"node_modules/@storybook/react-native": {',
      '"@storybook/react-dom-shim@npm:10.6.7":',
    ].join('\n');

    expect(isPackageInLockfile(lockfile, '@storybook/react')).toBe(false);
  });

  it('selects nothing when a matching release has no publish time under a gate', () => {
    const withoutTimes = { ...react, time: { '11.0.0-rc.0': hoursAgo(5) } };
    expect(
      selectInstallableVersion({
        packageName: '@storybook/react',
        range: '^11.0.0-beta.3',
        latest: withoutTimes,
        gate: gateOf(1440),
        now,
      })
    ).toBeNull();
    expect(
      selectInstallableVersion({
        packageName: '@storybook/react',
        range: '^11.0.0-beta.3',
        latest: withoutTimes,
        gate: NO_RELEASE_AGE_GATE,
        now,
      })
    ).toBe('11.0.0-rc.0');
  });

  it.each([
    { input: null, description: 'null' },
    { input: '', description: 'empty output' },
    { input: { name: '@storybook/react' }, description: 'a manifest without a version' },
    { input: { version: 'next' }, description: 'a manifest whose version is a dist-tag' },
    { input: [{ version: '1.0.0' }, { version: '2.0.0' }], description: 'several manifests' },
  ])('rejects $description as a published manifest', ({ input }) => {
    expect(parsePublishedManifest(input)).toBeNull();
  });

  it('parses release times', () => {
    expect(parseReleaseTime('2026-05-11T11:59:00.000Z')).toEqual(
      new Date('2026-05-11T11:59:00.000Z')
    );
    expect(parseReleaseTime('invalid')).toBeNull();
  });

  it('parses package time maps', () => {
    expect(
      parsePackageTimeMap({
        created: '2025-01-01T00:00:00.000Z',
        '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
      })
    ).toEqual({
      created: '2025-01-01T00:00:00.000Z',
      '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
    });
    expect(parsePackageTimeMap('bad')).toBeNull();
  });

  it('parses package time maps wrapped in an array', () => {
    expect(
      parsePackageTimeMap([
        {
          created: '2025-01-01T00:00:00.000Z',
          '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
          invalid: null,
        },
      ])
    ).toEqual({
      created: '2025-01-01T00:00:00.000Z',
      '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
    });
  });

  it.each([
    { input: [], description: 'an empty array' },
    { input: [{}, {}], description: 'multiple time maps' },
    { input: [[{}]], description: 'a nested array' },
    { input: [null], description: 'an array containing null' },
    { input: ['2026-05-11T11:59:00.000Z'], description: 'an array containing a timestamp' },
  ])('rejects $description as a package time map', ({ input }) => {
    expect(parsePackageTimeMap(input)).toBeNull();
  });

  it.each([
    { age: 'exactly at the gate', publishedAt: '2026-05-11T10:30:00.000Z', minutes: 90, old: true },
    {
      age: 'just short of the gate',
      publishedAt: '2026-05-11T10:30:00.001Z',
      minutes: 90,
      old: false,
    },
    {
      age: 'past a gate of 90 seconds',
      publishedAt: '2026-05-11T11:58:20.000Z',
      minutes: 1.5,
      old: true,
    },
  ])('compares a release $age against the age gate', ({ publishedAt, minutes, old }) => {
    expect(isOldEnough(new Date(publishedAt), minutes, new Date('2026-05-11T12:00:00.000Z'))).toBe(
      old
    );
  });

  it('finds the latest mature stable version', () => {
    expect(
      getLatestStableVersionAdheringToMinimumAgeGate(
        {
          '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
          '10.3.2': '2026-05-01T00:00:00.000Z',
          '10.3.1': '2026-04-01T00:00:00.000Z',
        },
        1440,
        new Date('2026-05-11T12:00:00.000Z')
      )
    ).toBe('10.3.2');
  });

  // Storybook writes these lists into the config of users' package managers, and asks again when an
  // entry is missing there. A change to this list is a change for every project behind an age gate.
  it('preapproves every package Storybook publishes, and the Chromatic packages', () => {
    expect(STORYBOOK_PACKAGE_PATTERNS).toEqual([
      '@storybook/*',
      'storybook-addon-pseudo-states',
      'storybook',
      'sb',
      'create-storybook',
      'eslint-plugin-storybook',
      'vite-plugin-storybook-nextjs',
      '@chromatic-com/storybook',
      'chromatic',
    ]);
    expect(STORYBOOK_PACKAGE_NAMES).toEqual([
      ...Object.keys(versions),
      '@chromatic-com/storybook',
      'chromatic',
    ]);
  });

  describe('runStorybookInstallPrecheck', () => {
    const originalIsTTY = process.stdout.isTTY;
    const setIsTTY = (value: boolean) =>
      Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true, writable: true });
    const packageManager = { precheckStorybookPackageInstall: vi.fn<() => Promise<void>>() };
    const options = { storybookVersion: '11.0.0', installContext: 'upgrade' } as const;

    beforeEach(() => {
      packageManager.precheckStorybookPackageInstall.mockResolvedValue(undefined);
      vi.mocked(isCI).mockReturnValue(false);
      setIsTTY(true);
    });

    afterEach(() => {
      setIsTTY(originalIsTTY);
    });

    it('asks the user in a terminal', async () => {
      await runStorybookInstallPrecheck(packageManager, { ...options, yes: false });

      expect(packageManager.precheckStorybookPackageInstall).toHaveBeenCalledWith({
        ...options,
        nonInteractive: false,
      });
    });

    it.each([
      { name: 'the user passed --yes', yes: true, isTTY: true, ci: false },
      { name: 'there is no terminal to ask in', yes: false, isTTY: false, ci: false },
      { name: 'it runs in CI', yes: false, isTTY: true, ci: true },
    ])('does not ask when $name', async ({ yes, isTTY, ci }) => {
      setIsTTY(isTTY);
      vi.mocked(isCI).mockReturnValue(ci);

      await runStorybookInstallPrecheck(packageManager, { ...options, yes });

      expect(packageManager.precheckStorybookPackageInstall).toHaveBeenCalledWith({
        ...options,
        nonInteractive: true,
      });
    });

    it('stops the command when the age gate blocks this Storybook version', async () => {
      const blocked = new MinimumReleaseAgeHandledError({ message: 'blocked by the age gate' });
      packageManager.precheckStorybookPackageInstall.mockRejectedValue(blocked);

      await expect(
        runStorybookInstallPrecheck(packageManager, { ...options, yes: false })
      ).rejects.toBe(blocked);
    });

    it('lets the command go on when the precheck itself fails', async () => {
      packageManager.precheckStorybookPackageInstall.mockRejectedValue(new Error('yarn not found'));

      await runStorybookInstallPrecheck(packageManager, { ...options, yes: false });

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('yarn not found'));
    });
  });

  it('reads how long a strict gate holds a Storybook install back', () => {
    const excluding = (patterns: readonly string[]) =>
      gateOf(1440, (packageName, version) =>
        patterns.some(
          (pattern) => pattern === packageName || pattern === `${packageName}@${version}`
        )
      );

    expect(
      getStorybookReleaseAgeGateMinutes(excluding(['storybook', '@storybook/react-vite']), '10.4.0')
    ).toBe(1440);
    expect(getStorybookReleaseAgeGateMinutes(excluding(STORYBOOK_PACKAGE_NAMES), '10.4.0')).toBe(0);
    expect(
      getStorybookReleaseAgeGateMinutes(
        excluding(STORYBOOK_PACKAGE_NAMES.filter((name) => name !== 'create-storybook')),
        '10.4.0'
      )
    ).toBe(1440);
    expect(
      getStorybookReleaseAgeGateMinutes(
        excluding(STORYBOOK_PACKAGE_NAMES.map((name) => `${name}@10.4.0`)),
        '10.4.1'
      )
    ).toBe(1440);
    expect(getStorybookReleaseAgeGateMinutes({ ...gateOf(1440), strict: false }, '10.4.0')).toBe(0);
    expect(getStorybookReleaseAgeGateMinutes(null, '10.4.0')).toBe(0);
  });

  it('builds rerun guidance', () => {
    expect(getStorybookRerunInstruction('create')).toBe('Please rerun Storybook creation with:');
    expect(getStorybookRerunInstruction('upgrade')).toBe(
      'Please rerun the Storybook upgrade with:'
    );
    expect(getStorybookRerunCommand('create', '10.3.2')).toBe('npx create-storybook@10.3.2');
    expect(getStorybookRerunCommand('upgrade', '10.3.2')).toBe('npx storybook@10.3.2 upgrade');
  });

  it('builds remote package runner args for the active package manager', () => {
    // npm and Yarn Classic run through npx, which needs --yes to skip the install prompt
    expect(
      getRemotePackageRunnerArgs(PackageManagerName.NPM, '@storybook/cli', '10.3.2', ['upgrade'])
    ).toEqual(['--yes', '@storybook/cli@10.3.2', 'upgrade']);
    expect(
      getRemotePackageRunnerArgs(PackageManagerName.YARN1, '@storybook/cli', '10.3.2', ['upgrade'])
    ).toEqual(['--yes', '@storybook/cli@10.3.2', 'upgrade']);
    // dlx/bunx-based managers download without prompting, so no --yes
    expect(
      getRemotePackageRunnerArgs(PackageManagerName.PNPM, '@storybook/cli', '10.3.2', ['upgrade'])
    ).toEqual(['@storybook/cli@10.3.2', 'upgrade']);
    expect(
      getRemotePackageRunnerArgs(PackageManagerName.YARN2, '@storybook/cli', '10.3.2', ['upgrade'])
    ).toEqual(['@storybook/cli@10.3.2', 'upgrade']);
    expect(
      getRemotePackageRunnerArgs(PackageManagerName.BUN, '@storybook/cli', '10.3.2', ['upgrade'])
    ).toEqual(['@storybook/cli@10.3.2', 'upgrade']);
    expect(
      getRemotePackageRunnerArgs(
        PackageManagerName.NPM,
        '@storybook/cli',
        'https://pkg.pr.new/storybookjs/storybook/@storybook/cli@deadbeef',
        ['upgrade']
      )
    ).toEqual([
      '--yes',
      '--allow-remote=all',
      '@storybook/cli@https://pkg.pr.new/storybookjs/storybook/@storybook/cli@deadbeef',
      'upgrade',
    ]);
  });

  it('builds package-manager-aware setup commands', () => {
    const npm = new NPMProxy({ cwd: process.cwd(), configDir: '.storybook' });
    const pnpm = new PNPMProxy({ cwd: process.cwd(), configDir: '.storybook' });

    expect(getVitestStorybookRunCommand(npm)).toBe('npx vitest --project storybook run');
    expect(getVitestStorybookRunCommand(pnpm)).toBe('pnpm exec vitest --project storybook run');
    expect(getMswInitCommand(pnpm)).toBe('pnpm exec msw init ./public --save');
  });

  it('extracts structured error logs', () => {
    expect(
      getErrorLogs({
        shortMessage: 'short',
        stderr: 'stderr',
        message: 'message',
      })
    ).toBe('short\nstderr\nmessage');
  });

  it('detects npm peer resolution errors from error logs', () => {
    expect(isNpmPeerResolutionError(new Error('npm error code ERESOLVE'))).toBe(true);
    expect(isNpmPeerResolutionError(new Error('npm ERR! code ERESOLVE'))).toBe(true);
    expect(isNpmPeerResolutionError(new Error('npm error code EACCES'))).toBe(false);
    expect(isNpmPeerResolutionError(new Error('something went wrong'))).toBe(false);
  });
});
