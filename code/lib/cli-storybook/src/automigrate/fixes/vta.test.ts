import { describe, expect, it } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';

import { vta } from './vta';

const check = async ({
  packageManager,
  main: mainConfig,
  storybookVersion = '7.0.0',
}: {
  packageManager: any;
  main: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return vta.check({
    packageManager,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
  });
};

describe('no-ops', () => {
  it('with addon setup', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          addons: ['@chromatic-com/storybook'],
        },
      })
    ).resolves.toBeFalsy();
  });
  it('with addon setup with options', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          addons: [
            {
              name: '@chromatic-com/storybook',
              options: {},
            },
          ],
        },
      })
    ).resolves.toBeFalsy();
  });
});

describe('continue', () => {
  it('no addons', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          stories: ['**/*.stories.mdx'],
        },
      })
    ).resolves.toBeTruthy();
  });
});
