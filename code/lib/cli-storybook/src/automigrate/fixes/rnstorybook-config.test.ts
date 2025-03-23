import { existsSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorybookConfigRaw } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import { $ } from 'execa';
// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';

import { makePackageManager } from '../helpers/testing-helpers';
import { rnstorybookConfig } from './rnstorybook-config';

const { check } = rnstorybookConfig;

const mockMainConfig: StorybookConfigRaw = {
  stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
};

vi.mock('node:fs');
vi.mock('execa');
vi.mock('globby');

describe('react-native-config fix', () => {
  beforeEach(() => {
    vi.mocked($).mockClear();
    vi.mocked($).mockResolvedValue({ stdout: '' });
    vi.mocked(globby).mockResolvedValue(['storybook.requires.ts']);
  });

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

    it('when @storybook/react-native is installed and .storybook exists but no requires file', async () => {
      const packageManager = makePackageManager({
        devDependencies: {
          '@storybook/react-native': '^8.0.0',
        },
      });

      // Mock existsSync to return true for .storybook and false for .rnstorybook
      vi.mocked(existsSync).mockImplementation((path) => path.toString().includes('.storybook'));
      vi.mocked(globby).mockResolvedValue([]);
      const result = await check({
        packageManager,
        mainConfigPath: '.storybook/main.js',
        mainConfig: mockMainConfig,
        storybookVersion: '8.0.0',
      });

      expect(result).toBeNull();
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
        dotStorybookReferences: [],
      });
    });

    it('when there are references to .storybook in the project', async () => {
      vi.mocked($).mockResolvedValue({ stdout: 'a\nb\nc' });
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
        dotStorybookReferences: ['a', 'b', 'c'],
      });
    });
  });
});
