import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { PackageJson } from 'storybook/internal/types';

import { getVitePlusVersions } from 'storybook/internal/common';

import { blocker } from './block-dependencies-versions.ts';

vi.mock('storybook/internal/common', () => ({
  getVitePlusVersions: vi.fn(async () => null),
}));

vi.mock('storybook/internal/node-logger', () => ({
  CLI_COLORS: {
    info: (message: string) => message,
    warning: (message: string) => message,
  },
}));

vi.mock('../util.ts', () => ({
  shortenPath: (path: string) => path,
}));

type AddonVersion = string | null | (() => Promise<string | null>);

const createPackageManager = (
  versions: Record<string, string>,
  addonVersion: AddonVersion = null
): JsPackageManager =>
  ({
    getModulePackageJSON: async (packageName: string): Promise<PackageJson | null> =>
      versions[packageName] ? { version: versions[packageName] } : null,
    getInstalledVersion: async (packageName: string) => {
      if (packageName !== '@storybook/addon-vitest') {
        return null;
      }

      return typeof addonVersion === 'function' ? addonVersion() : addonVersion;
    },
  }) as JsPackageManager;

const createCheckOptions = (packageManager: JsPackageManager) => ({
  packageManager,
  mainConfig: { stories: [] },
  mainConfigPath: '.storybook/main.ts',
  configDir: '.storybook',
});

describe('dependenciesVersions blocker', () => {
  beforeEach(() => {
    vi.mocked(getVitePlusVersions).mockImplementation(async () => null);
  });

  test('blocks on Next.js 14 with a message linking the migration guide', async () => {
    const packageManager = createPackageManager({ next: '14.1.0' });

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toEqual({
      packageName: 'next',
      installedVersion: '14.1.0',
      minimumVersion: '15.0.0',
    });

    if (!result) {
      throw new Error('Expected the blocker to block on Next.js 14');
    }

    const logged = blocker.log(result);

    expect(logged.title).toBe('Next.js 15 support removed');
    expect(logged.message).toContain('Support for Next.js < 15 has been removed.');
    expect(logged.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nextjs-require-v15-and-up'
    );
  });

  test.each(['15.0.0', '16.0.0'])('passes on Next.js %s', async (version) => {
    const packageManager = createPackageManager({ next: version });

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toBe(false);
  });

  test('@angular/core 20 is blocked with message and migration anchor', async () => {
    const packageManager = createPackageManager({ '@angular/core': '20.0.0' });

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toEqual({
      packageName: '@angular/core',
      installedVersion: '20.0.0',
      minimumVersion: '21.0.0',
    });

    if (!result) {
      throw new Error('Expected @angular/core 20.0.0 to be blocked');
    }

    const logged = blocker.log(result);

    expect(logged.title).toBe('Require Angular v21 and up');
    expect(logged.message).toContain('Support for Angular < 21 has been removed.');
    expect(logged.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#angular-requires-angular-21-or-higher'
    );
  });

  test.each(['21.0.0', '22.1.0'])('@angular/core %s is not blocked', async (version) => {
    const packageManager = createPackageManager({ '@angular/core': version });

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toBe(false);
  });

  test('missing @angular/core does not block', async () => {
    const packageManager = createPackageManager({});

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toBe(false);
  });

  test('does not consult the addon when a shared dependency already blocks', async () => {
    const manager = createPackageManager({ next: '14.9.9' });
    const addonSpy = vi.spyOn(manager, 'getInstalledVersion');

    const result = await blocker.check(createCheckOptions(manager));

    expect(result).toEqual({
      packageName: 'next',
      installedVersion: '14.9.9',
      minimumVersion: '15.0.0',
    });
    expect(addonSpy).not.toHaveBeenCalled();
  });

  test('blocks on Vitest 3 when @storybook/addon-vitest is installed', async () => {
    const packageManager = createPackageManager({ vitest: '3.2.4' }, '11.0.0');

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toEqual({
      packageName: 'vitest',
      installedVersion: '3.2.4',
      minimumVersion: '4.0.0',
    });
  });

  test('does not block on Vitest 3 without the addon', async () => {
    const manager = createPackageManager({ vitest: '3.2.4' });
    const addonSpy = vi.spyOn(manager, 'getInstalledVersion');

    const result = await blocker.check(createCheckOptions(manager));

    expect(result).toBe(false);
    expect(addonSpy).toHaveBeenCalledWith('@storybook/addon-vitest');
  });

  test('passes at the Vitest 4.0.0 boundary with the addon installed', async () => {
    const packageManager = createPackageManager({ vitest: '4.0.0' }, '11.0.0');

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toBe(false);
  });

  test('does not block when the addon is installed but Vitest is absent', async () => {
    const manager = createPackageManager({}, '11.0.0');
    const moduleSpy = vi.spyOn(manager, 'getModulePackageJSON');

    const result = await blocker.check(createCheckOptions(manager));

    expect(result).toBe(false);
    expect(moduleSpy).toHaveBeenCalledWith('vitest');
  });

  test('uses the vite-plus vendored Vitest version when available', async () => {
    vi.mocked(getVitePlusVersions).mockImplementation(async () => ({
      vite: '7.1.2',
      vitest: '3.2.4',
    }));
    const packageManager = createPackageManager({}, '11.0.0');

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toEqual({
      packageName: 'vitest',
      installedVersion: '3.2.4',
      minimumVersion: '4.0.0',
    });
  });

  test('does not block when the addon lookup throws', async () => {
    const packageManager = createPackageManager({}, () =>
      Promise.reject(new Error('version detection failed'))
    );

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toBe(false);
  });

  test('logs the Vitest 4 requirement for addon-vitest projects', () => {
    const logged = blocker.log({
      installedVersion: '3.2.4',
      packageName: 'vitest',
      minimumVersion: '4.0.0',
    });

    expect(logged.title).toBe('Vitest 4 required by @storybook/addon-vitest');
    expect(logged.message).toMatchInlineSnapshot(`
      "The addon requires Vitest 4.0.0 or higher. You are currently using Vitest 3.2.4.

      Please upgrade Vitest to 4.0.0 or higher before upgrading Storybook:
      1. Update vitest (and any @vitest/* packages) in your project to version 4
      2. Run your test suite to verify the migration"
    `);
    expect(logged.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-requires-vitest-40-or-higher'
    );
  });

  test('logs shared dependencies through the default case', () => {
    const logged = blocker.log({
      installedVersion: '4.0.0',
      packageName: 'react-scripts',
      minimumVersion: '5.0.0',
    });

    expect(logged.title).toBe('react-scripts version < 5.0.0 support removed');
  });
});
