import { existsSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJsonWithDepsAndDevDeps } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { makePackageManager } from '../helpers/testing-helpers';
import { reactNativeConfig } from './react-native-config';

const { check } = reactNativeConfig;

const mockMainConfig: StorybookConfigRaw = {
  stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
};

vi.mock('node:fs');

describe('react-native-config fix', () => {
  describe('no-ops', () => {
    it('when @storybook/react-native is not installed', async () => {
      const packageManager = makePackageManager({
        devDependencies: {},
      });

      await expect(
        check({
          packageManager,
          mainConfigPath: '.storybook/main.js',
          mainConfig: mockMainConfig,
          storybookVersion: '8.0.0',
        })
      ).resolves.toBeNull();
    });

    it('when .storybook directory does not exist', async () => {
      const packageManager = makePackageManager({
        devDependencies: {
          '@storybook/react-native': '^8.0.0',
        },
      });

      vi.mocked(existsSync).mockReturnValue(false);

      await expect(
        check({
          packageManager,
          mainConfigPath: '.storybook/main.js',
          mainConfig: mockMainConfig,
          storybookVersion: '8.0.0',
        })
      ).resolves.toBeNull();
    });

    it('when .rnstorybook directory already exists', async () => {
      const packageManager = makePackageManager({
        devDependencies: {
          '@storybook/react-native': '^8.0.0',
        },
      });
      vi.mocked(existsSync).mockReturnValue(true);

      await expect(
        check({
          packageManager,
          mainConfigPath: '.storybook/main.js',
          mainConfig: mockMainConfig,
          storybookVersion: '8.0.0',
        })
      ).resolves.toBeNull();
    });
  });

  describe('continue', () => {
    it('when @storybook/react-native is installed and .storybook exists', async () => {
      const packageManager = makePackageManager({
        devDependencies: {
          '@storybook/react-native': '^8.0.0',
        },
      });

      // Mock existsSync to return true for .storybook and false for .rnstorybook
      vi.mocked(existsSync).mockImplementation((path) => path.toString().includes('.storybook'));

      const result = await check({
        packageManager,
        mainConfigPath: '.storybook/main.js',
        mainConfig: mockMainConfig,
        storybookVersion: '8.0.0',
      });

      expect(result).toEqual({
        storybookDir: expect.stringContaining('.storybook'),
        rnStorybookDir: expect.stringContaining('.rnstorybook'),
      });
    });
  });
});
