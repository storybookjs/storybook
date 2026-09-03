import { describe, expect, test, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { PackageJson } from 'storybook/internal/types';

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

const createPackageManager = (versions: Record<string, string>): JsPackageManager =>
  ({
    getModulePackageJSON: async (packageName: string): Promise<PackageJson | null> =>
      versions[packageName] ? { version: versions[packageName] } : null,
  }) as JsPackageManager;

const createCheckOptions = (packageManager: JsPackageManager) => ({
  packageManager,
  mainConfig: { stories: [] },
  mainConfigPath: '.storybook/main.ts',
  configDir: '.storybook',
});

describe('dependenciesVersions blocker', () => {
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

    expect(logged.title).toBe('Angular 21 support removed');
    expect(logged.message).toContain('Support for Angular < 21 has been removed.');
    expect(logged.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#angular-require-v21-and-up'
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
});

