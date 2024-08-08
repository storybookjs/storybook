import { describe, it, expect } from 'vitest';
import type { StorybookConfig } from 'storybook/internal/types';
import { reactDocgen } from './react-docgen';

const check = async ({
  packageManager,
  main: mainConfig,
  storybookVersion = '7.0.0',
}: {
  packageManager: any;
  main: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  return reactDocgen.check({
    packageManager,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
  });
};

describe('no-ops', () => {
  it('typescript.reactDocgen is already set', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          framework: '@storybook/react-vite',
          typescript: {
            // @ts-expect-error assume react
            reactDocgen: 'react-docgen-typescript',
          },
        },
      })
    ).resolves.toBeNull();

    await expect(
      check({
        packageManager: {},
        main: {
          framework: '@storybook/react-vite',
          typescript: {
            // @ts-expect-error assume react
            reactDocgen: false,
          },
        },
      })
    ).resolves.toBeNull();
  });

  it('typescript.reactDocgen and typescript.reactDocgenTypescriptOptions are both unset', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          framework: '@storybook/react-vite',
          typescript: {
            // @ts-expect-error assume react
            reactDocgen: 'react-docgen-typescript',
            reactDocgenTypescriptOptions: undefined,
          },
        },
      })
    ).resolves.toBeNull();
  });

  it('typescript.reactDocgen is undefined and it is not a react framework', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          framework: '@storybook/sveltekit',
        },
      })
    ).resolves.toBeNull();
  });
});

describe('continue', () => {
  it('should resolve if the framework is using a react renderer', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          framework: '@storybook/nextjs',
        },
      })
    ).resolves.toEqual({
      reactDocgenTypescriptOptions: undefined,
      reactDocgen: undefined,
    });
  });

  it('typescript.reactDocgenTypescriptOptions is set', async () => {
    await expect(
      check({
        packageManager: {},
        main: {
          framework: '@storybook/react-vite',
          typescript: {
            // @ts-expect-error assume react
            reactDocgenTypescriptOptions: {
              someOption: true,
            },
          },
        },
      })
    ).resolves.toEqual({
      reactDocgenTypescriptOptions: {
        someOption: true,
      },
      reactDocgen: undefined,
    });
  });
});
