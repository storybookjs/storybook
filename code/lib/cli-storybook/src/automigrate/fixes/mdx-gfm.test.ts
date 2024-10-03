import { describe, expect, it, vi } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';

import { mdxgfm } from './mdx-gfm';

vi.mock('tinyglobby', () => ({
  __esModule: true,
  globby: vi.fn().mockResolvedValue(['a/fake/file.mdx']),
}));

const check = async ({
  packageManager,
  main: mainConfig,
  storybookVersion = '7.0.0',
}: {
  packageManager: any;
  main: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return mdxgfm.check({
    packageManager,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
  });
};

describe('no-ops', () => {
  it('sb > 7.0', async () => {
    await expect(
      check({
        packageManager: {},
        main: {},
        storybookVersion: '6.2.0',
      })
    ).resolves.toBeFalsy();
  });
  it('legacyMdx1', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          features: {
            // @ts-expect-error (user might be upgrading from a version that had this option)
            legacyMdx1: true,
          },
        },
      })
    ).resolves.toBeFalsy();
  });
  it('with addon docs setup', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          addons: [
            {
              name: '@storybook/addon-essentials',
              options: {
                docs: false,
              },
            },
            {
              name: '@storybook/addon-docs',
              options: {
                mdxPluginOptions: {
                  mdxCompileOptions: {
                    remarkPlugins: [() => {}],
                  },
                },
              },
            },
          ],
        },
      })
    ).resolves.toBeFalsy();
  });
  it('with addon migration assistant addon added', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          addons: ['@storybook/addon-mdx-gfm'],
        },
      })
    ).resolves.toBeFalsy();
  });
});

describe('continue', () => {
  it('nothing configured at all', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          stories: ['**/*.stories.mdx'],
        },
      })
    ).resolves.toBeTruthy();
  });
  it('unconfigured addon-docs', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          stories: ['**/*.stories.mdx'],
          addons: [
            {
              name: '@storybook/addon-essentials',
              options: {
                docs: false,
              },
            },
            {
              name: '@storybook/addon-docs',
              options: {},
            },
          ],
        },
      })
    ).resolves.toBeTruthy();
  });
  it('unconfigured addon-essentials', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          stories: ['**/*.stories.mdx'],
          addons: ['@storybook/addon-essentials'],
        },
      })
    ).resolves.toBeTruthy();
  });
  it('stories object with directory + files', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          stories: [{ directory: 'src', titlePrefix: 'src', files: '' }],
          addons: ['@storybook/addon-essentials'],
        },
      })
    ).resolves.toBeTruthy();
  });
  it('stories object with directory and no files', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          stories: [{ directory: 'src', titlePrefix: 'src' }],
          addons: ['@storybook/addon-essentials'],
        },
      })
    ).resolves.toBeTruthy();
  });
});
