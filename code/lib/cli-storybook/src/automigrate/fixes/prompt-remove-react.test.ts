import { describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';

import { removeReactDependency } from './prompt-remove-react';

const check = async ({
  packageManagerContent,
  main: mainConfig,
  storybookVersion = '8.0.0',
}: {
  packageManagerContent: Partial<Awaited<ReturnType<JsPackageManager['getAllDependencies']>>>;
  main: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
}) => {
  const packageManager = {
    getAllDependencies: async () => packageManagerContent,
  } as JsPackageManager;

  return removeReactDependency.check({
    packageManager,
    configDir: '',
    mainConfig: mainConfig as any,
    storybookVersion,
  });
};

vi.mock('glob', () => ({ glob: vi.fn(() => []) }));

describe('early exits', () => {
  it('cancel if no react deps', async () => {
    await expect(
      check({
        packageManagerContent: {},
        main: {
          stories: [],
          framework: '@storybook/vue-vite',
        },
      })
    ).resolves.toBeFalsy();
  });

  it('cancel if react renderer', async () => {
    await expect(
      check({
        packageManagerContent: { react: '16.0.0' },
        main: {
          stories: [],
          framework: '@storybook/react-vite',
        },
      })
    ).resolves.toBeFalsy();

    await expect(
      check({
        packageManagerContent: { react: '16.0.0' },
        main: {
          stories: [],
          framework: '@storybook/nextjs',
        },
      })
    ).resolves.toBeFalsy();

    await expect(
      check({
        packageManagerContent: { react: '16.0.0' },
        main: {
          stories: [],
          framework: { name: '@storybook/react-webpack5' },
        },
      })
    ).resolves.toBeFalsy();
  });
});

describe('prompts', () => {
  it('simple', async () => {
    await expect(
      check({
        packageManagerContent: { react: '16.0.0' },
        main: {
          stories: ['*.stories.ts'],
          addons: [],
          framework: '@storybook/vue-vite',
        },
      })
    ).resolves.toEqual(true);
  });
  it('detects addon docs', async () => {
    await expect(
      check({
        packageManagerContent: { react: '16.0.0' },
        main: {
          stories: ['*.stories.ts'],
          addons: ['@storybook/addon-docs'],
          framework: '@storybook/vue-vite',
        },
      })
    ).resolves.toEqual(true);
  });
  it('detects addon essentials', async () => {
    await expect(
      check({
        packageManagerContent: { react: '16.0.0' },
        main: {
          stories: ['*.stories.ts'],
          addons: ['@storybook/addon-docs', '@storybook/addon-essentials'],
          framework: '@storybook/vue-vite',
        },
      })
    ).resolves.toEqual(true);
  });
  it('detects MDX usage', async () => {
    // @ts-expect-error (jest mocked)
    glob.mockImplementationOnce(() => ['*.stories.mdx']);
    await expect(
      check({
        packageManagerContent: { react: '16.0.0' },
        main: {
          stories: ['*.stories.ts'],
          addons: ['@storybook/addon-docs', '@storybook/addon-essentials'],
          framework: '@storybook/vue-vite',
        },
      })
    ).resolves.toEqual(true);
  });
});
