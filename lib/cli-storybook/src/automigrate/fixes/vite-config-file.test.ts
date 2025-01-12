import { describe, expect, it } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';

import { viteConfigFile } from './vite-config-file';

const check = async ({
  packageManager,
  main: mainConfig,
  storybookVersion = '8.0.0',
}: {
  packageManager: any;
  main: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return viteConfigFile.check({
    packageManager,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
  });
};

describe('no-ops', () => {
  it('skips when react-native-web-vite', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          framework: '@storybook/react-native-web-vite',
        },
      })
    ).resolves.toBeFalsy();
  });
});

describe('continue', () => {
  it('executes for vite framework', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          framework: '@storybook/react-vite',
        },
      })
    ).resolves.toBeTruthy();
  });
});
