import { describe, expect, it } from 'vitest';

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
  hasStorybookMinimumAgeExclusions,
  parsePackageData,
  parsePackageTimeMap,
  parsePositiveIntegerConfigValue,
  parseReleaseTime,
} from './util.ts';

describe('js package manager util', () => {
  it('parses package data', () => {
    expect(parsePackageData('@storybook/addon-essentials@npm:7.0.0')).toEqual({
      name: '@storybook/addon-essentials',
      value: { version: '7.0.0', location: '' },
    });
  });

  it('parses positive integer config values', () => {
    expect(parsePositiveIntegerConfigValue('1440\n')).toBe(1440);
    expect(parsePositiveIntegerConfigValue('0')).toBeNull();
    expect(parsePositiveIntegerConfigValue('false')).toBeNull();
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
    expect(
      hasStorybookMinimumAgeExclusions([
        'storybook',
        '@storybook/*',
        'eslint-plugin-storybook',
        '@chromatic-com/storybook',
      ])
    ).toBe(true);
    expect(hasStorybookMinimumAgeExclusions(['storybook', '@storybook/react-vite'])).toBe(false);
    expect(hasStorybookMinimumAgeExclusions(['*storybook*'])).toBe(true);
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
});
