import { describe, afterEach, it, expect, vi } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';
import { storyshotsMigration } from './storyshots-migration';
import type { JsPackageManager } from 'storybook/internal/common';

const check = async ({
  packageManager,
  main: mainConfig = {},
  storybookVersion = '8.0.0',
}: {
  packageManager: Partial<JsPackageManager>;
  main?: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return storyshotsMigration.check({
    packageManager: packageManager as any,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
  });
};

describe('storyshots-migration fix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect storyshots registered in main.js', async () => {
    await expect(
      check({
        packageManager: {
          getAllDependencies: async () => ({}),
        },
        main: { addons: ['@storybook/addon-storyshots'] },
      })
    ).resolves.toBeTruthy();
  });

  it('should detect storyshots in package.json', async () => {
    await expect(
      check({
        packageManager: {
          getAllDependencies: async () => ({ '@storybook/addon-storyshots': '7.0.0' }),
        },
      })
    ).resolves.toBeTruthy();
  });

  it('no-op when storyshots is not present', async () => {
    await expect(
      check({
        packageManager: {
          getAllDependencies: async () => ({}),
        },
        main: { addons: ['@storybook/essentials'] },
      })
    ).resolves.toBeNull();
  });
});
