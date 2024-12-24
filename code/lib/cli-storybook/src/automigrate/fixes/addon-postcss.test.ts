import { describe, expect, it } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import { addonPostCSS } from './addon-postcss';

const checkAddonPostCSS = async ({
  packageManager,
  mainConfig = {},
  storybookVersion = '7.0.0',
}: {
  packageManager?: Partial<JsPackageManager>;
  mainConfig?: Partial<StorybookConfig>;
  storybookVersion?: string;
}) => {
  return addonPostCSS.check({
    packageManager: packageManager as any,
    storybookVersion,
    mainConfig: mainConfig as any,
  });
};

describe('check function', () => {
  it('should return { hasAddonPostcss: true } if @storybook/addon-postcss is found', async () => {
    await expect(
      checkAddonPostCSS({
        mainConfig: {
          addons: ['@storybook/addon-postcss'],
        },
      })
    ).resolves.toEqual({ hasAddonPostcss: true });
  });

  it('should return null if @storybook/addon-postcss is not found', async () => {
    await expect(
      checkAddonPostCSS({
        mainConfig: {
          addons: [],
        },
      })
    ).resolves.toBeNull();
  });
});
