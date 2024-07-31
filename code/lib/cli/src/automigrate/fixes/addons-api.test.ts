import { addonsAPI } from './addons-api';
import type { StorybookConfig } from '@storybook/core/types';
import type { JsPackageManager } from '@storybook/core/common';
import { expect, describe, it } from 'vitest';

const checkAddonsAPI = async ({
  packageManager,
  mainConfig = {},
  storybookVersion = '7.0.0',
}: {
  packageManager?: Partial<JsPackageManager>;
  mainConfig?: Partial<StorybookConfig>;
  storybookVersion?: string;
}) => {
  return addonsAPI.check({
    packageManager: packageManager as any,
    storybookVersion,
    mainConfig: mainConfig as any,
  });
};

describe('check function', () => {
  it('should return { usesAddonsAPI: true } if @storybook/addons is installed', async () => {
    await expect(
      checkAddonsAPI({
        packageManager: {
          getAllDependencies: async () => ({
            '@storybook/addons': '6.0.0',
          }),
        },
      })
    ).resolves.toEqual({ usesAddonsAPI: true });
  });

  it('should return null if @storybook/addons is not installed', async () => {
    await expect(
      checkAddonsAPI({
        packageManager: {
          getAllDependencies: async () => ({}),
        },
      })
    ).resolves.toBeNull();
  });
});
