import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StorybookConfigRaw } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';

import { makePackageManager } from '../helpers/testing-helpers';
import { rnstorybookConfig } from './rnstorybook-config';

const mockMainConfig: StorybookConfigRaw = {
  stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
};

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('globby', { spy: true });

describe('react-native-config fix', () => {
  beforeEach(() => {
    vi.mocked(globby).mockResolvedValue(['storybook.requires.ts']);
    vi.mocked(readFile).mockResolvedValue('');
    vi.mocked(writeFile).mockResolvedValue();
    vi.mocked(rename).mockResolvedValue();
  });

  describe('no-ops', () => {
    it('when @storybook/react-native is not installed', async () => {
      const packageManager = makePackageManager({
        devDependencies: {},
      });

      await expect(
        rnstorybookConfig.check({
          packageManager,
          mainConfigPath: '.storybook/main.js',
          mainConfig: mockMainConfig,
          storybookVersion: '8.0.0',
          storiesPaths: [],
          hasCsfFactoryPreview: false,
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
        rnstorybookConfig.check({
          packageManager,
          mainConfigPath: '.storybook/main.js',
          mainConfig: mockMainConfig,
          storybookVersion: '8.0.0',
          storiesPaths: [],
          hasCsfFactoryPreview: false,
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
        rnstorybookConfig.check({
          packageManager,
          mainConfigPath: '.storybook/main.js',
          mainConfig: mockMainConfig,
          storybookVersion: '8.0.0',
          storiesPaths: [],
          hasCsfFactoryPreview: false,
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
      const result = await rnstorybookConfig.check({
        packageManager,
        mainConfigPath: '.storybook/main.js',
        mainConfig: mockMainConfig,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
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

      const result = await rnstorybookConfig.check({
        packageManager,
        mainConfigPath: '.storybook/main.js',
        mainConfig: mockMainConfig,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({
        storybookDir: expect.stringContaining('.storybook'),
        rnStorybookDir: expect.stringContaining('.rnstorybook'),
      });
    });
  });

  describe('run', () => {
    const createMockPackageManagerWithInstanceDir = (instanceDir: string) => {
      const packageManager = makePackageManager({
        devDependencies: {
          '@storybook/react-native': '^8.0.0',
        },
      });
      // Mock the instanceDir as a readonly property
      Object.defineProperty(packageManager, 'instanceDir', {
        value: instanceDir,
        writable: false,
        configurable: true,
      });
      return packageManager;
    };

    it('should rename files and update references when not in dry run mode', async () => {
      const packageManager = createMockPackageManagerWithInstanceDir('/test/project');

      // Mock globby to return files with .storybook references
      vi.mocked(globby).mockResolvedValue(['/test/project/src/component.tsx']);
      vi.mocked(readFile).mockImplementation((path) => {
        if (path === '/test/project/src/component.tsx') {
          return Promise.resolve('import ".storybook/config"');
        }
        return Promise.resolve('no references here');
      });

      // Type assertion since we know rnstorybookConfig has a run method
      await (rnstorybookConfig as any).run({
        result: {
          storybookDir: '/test/project/.storybook',
          rnStorybookDir: '/test/project/.rnstorybook',
        },
        dryRun: false,
        packageManager,
        mainConfigPath: '/test/project/.storybook/main.js',
        mainConfig: mockMainConfig,
        configDir: '/test/project/.storybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
        skipInstall: false,
      });

      // Verify the file content was updated
      expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
        '/test/project/src/component.tsx',
        'import ".rnstorybook/config"',
        'utf8'
      );

      // Verify the directory was renamed
      expect(vi.mocked(rename)).toHaveBeenCalledWith(
        '/test/project/.storybook',
        '/test/project/.rnstorybook'
      );
    });

    it('should handle errors gracefully when searching for references', async () => {
      const packageManager = createMockPackageManagerWithInstanceDir('/test/project');

      // Mock globby to throw an error
      vi.mocked(globby).mockRejectedValue(new Error('File system error'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Type assertion since we know rnstorybookConfig has a run method
      await (rnstorybookConfig as any).run({
        result: {
          storybookDir: '/test/project/.storybook',
          rnStorybookDir: '/test/project/.rnstorybook',
        },
        dryRun: false,
        packageManager,
        mainConfigPath: '/test/project/.storybook/main.js',
        mainConfig: mockMainConfig,
        configDir: '/test/project/.storybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
        skipInstall: false,
      });

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unable to search for .storybook references:',
        expect.any(Error)
      );

      // Directory should still be renamed even if reference search fails
      expect(vi.mocked(rename)).toHaveBeenCalledWith(
        '/test/project/.storybook',
        '/test/project/.rnstorybook'
      );

      consoleSpy.mockRestore();
    });
  });
});
