import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import { logger } from '../../node-logger/index.ts';
import { isCI } from '../utils/envs.ts';
import versions from '../versions.ts';
import { PackageManagerName } from './JsPackageManager.ts';
import { NPMProxy } from './NPMProxy.ts';
import { PNPMProxy } from './PNPMProxy.ts';
import {
  getAgeInMinutes,
  getErrorLogs,
  getLatestStableVersionAdheringToMinimumAgeGate,
  getMswInitCommand,
  getRemotePackageRunnerArgs,
  getStorybookRerunCommand,
  getStorybookRerunInstruction,
  getVitestStorybookRunCommand,
  hasStorybookMinimumAgeExclusionNames,
  hasStorybookMinimumAgeExclusions,
  isNpmPeerResolutionError,
  parsePackageData,
  parsePackageTimeMap,
  parsePositiveIntegerConfigValue,
  parsePublishedManifest,
  parseReleaseTime,
  parseYarnMinimalAgeGateMinutes,
  readPackageVersions,
  runStorybookInstallPrecheck,
  STORYBOOK_PACKAGE_NAMES,
  STORYBOOK_PACKAGE_PATTERNS,
} from './util.ts';

vi.mock('../../node-logger/index.ts', { spy: true });
vi.mock('../utils/envs.ts', { spy: true });

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

  it('computes package age in minutes', () => {
    expect(
      getAgeInMinutes(new Date('2026-05-11T11:00:00.000Z'), new Date('2026-05-11T12:30:00.000Z'))
    ).toBe(90);
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

  it('detects when Storybook minimum-age exclusions are already configured', () => {
    expect(hasStorybookMinimumAgeExclusions(STORYBOOK_PACKAGE_PATTERNS)).toBe(true);
    expect(hasStorybookMinimumAgeExclusions(['storybook', '@storybook/react-vite'])).toBe(false);
    expect(hasStorybookMinimumAgeExclusions(['*storybook*', 'sb', 'chromatic'])).toBe(true);
    expect(hasStorybookMinimumAgeExclusions(['*storybook*', 'sb'])).toBe(false);
  });

  it('detects exclusions for a package manager that matches exact names', () => {
    expect(hasStorybookMinimumAgeExclusionNames(STORYBOOK_PACKAGE_NAMES)).toBe(true);
    expect(hasStorybookMinimumAgeExclusionNames(STORYBOOK_PACKAGE_PATTERNS)).toBe(false);
    expect(hasStorybookMinimumAgeExclusionNames(STORYBOOK_PACKAGE_NAMES.slice(1))).toBe(false);
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
