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

  test('blocks on react 17 with a message linking the migration guide', async () => {
    const packageManager = createPackageManager({ react: '17.0.0', 'react-dom': '17.0.0' });

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toEqual({
      packageName: 'react',
      installedVersion: '17.0.0',
      minimumVersion: '18.0.0',
    });

    if (!result) {
      throw new Error('Expected the blocker to block on react 17');
    }

    const logged = blocker.log(result);

    expect(logged.title).toBe('React 18 support removed');
    expect(logged.message).toContain('Support for React < 18 has been removed');
    expect(logged.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-require-v18-and-up'
    );
  });

  test('blocks on react-dom 17 when react itself is current', async () => {
    const packageManager = createPackageManager({ react: '18.2.0', 'react-dom': '17.0.2' });

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toEqual({
      packageName: 'react-dom',
      installedVersion: '17.0.2',
      minimumVersion: '18.0.0',
    });
  });

  test('passes on react 18', async () => {
    const packageManager = createPackageManager({ react: '18.2.0', 'react-dom': '18.2.0' });

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toBe(false);
  });

  test('passes on react 19', async () => {
    const packageManager = createPackageManager({ react: '19.0.0', 'react-dom': '19.0.0' });

    const result = await blocker.check(createCheckOptions(packageManager));

    expect(result).toBe(false);
  });
});
