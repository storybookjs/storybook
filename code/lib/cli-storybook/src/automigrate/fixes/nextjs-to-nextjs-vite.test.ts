import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import type { CheckOptions } from '.';
import { nextjsToNextjsVite } from './nextjs-to-nextjs-vite';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    step: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('storybook/internal/common', () => ({
  transformImportFiles: vi.fn().mockResolvedValue([]),
}));

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);

describe('nextjs-to-nextjs-vite', () => {
  const mockPackageManager = {
    getAllDependencies: vi.fn(),
    packageJsonPaths: ['/project/package.json'],
  } as unknown as JsPackageManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check function', () => {
    it('should return null if @storybook/nextjs is not installed', async () => {
      mockPackageManager.getAllDependencies = vi.fn().mockReturnValue({
        '@storybook/react': '^9.0.0',
      });

      const result = await nextjsToNextjsVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);
      expect(result).toBeNull();
    });

    it('should return migration options if @storybook/nextjs is installed', async () => {
      mockPackageManager.getAllDependencies = vi.fn().mockReturnValue({
        '@storybook/nextjs': '^9.0.0',
        '@storybook/react': '^9.0.0',
      });

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            '@storybook/nextjs': '^9.0.0',
          },
        })
      );

      const result = await nextjsToNextjsVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toEqual({
        hasNextjsPackage: true,
        packageJsonFiles: ['/project/package.json'],
      });
    });

    it('should handle invalid package.json files gracefully', async () => {
      mockPackageManager.getAllDependencies = vi.fn().mockReturnValue({
        '@storybook/nextjs': '^9.0.0',
      });

      mockReadFile.mockRejectedValue(new Error('Invalid JSON'));

      const result = await nextjsToNextjsVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toEqual({
        hasNextjsPackage: true,
        packageJsonFiles: [],
      });
    });
  });

  describe('prompt function', () => {
    it('should return a descriptive prompt message', () => {
      const prompt = nextjsToNextjsVite.prompt();

      expect(prompt).toContain('@storybook/nextjs');
      expect(prompt).toContain('@storybook/nextjs-vite');
      expect(prompt).toContain('Vite instead of Webpack');
    });
  });

  describe('run function', () => {
    it('should handle null result gracefully', async () => {
      await expect(
        nextjsToNextjsVite.run!({
          result: null,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.js',
          storiesPaths: ['**/*.stories.*'],
          configDir: '.storybook',
        } as any)
      ).resolves.toBeUndefined();
    });

    it('should transform package.json files', async () => {
      const result = {
        hasNextjsPackage: true,
        packageJsonFiles: ['/project/package.json'],
      };

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            '@storybook/nextjs': '^9.0.0',
            '@storybook/react': '^9.0.0',
          },
        })
      );

      await nextjsToNextjsVite.run!({
        result,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.js',
        storiesPaths: ['**/*.stories.*'],
        configDir: '.storybook',
      } as any);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/package.json',
        expect.stringContaining('@storybook/nextjs-vite')
      );
    });

    it('should transform main config file', async () => {
      const result = {
        hasNextjsPackage: true,
        packageJsonFiles: [],
      };

      mockReadFile.mockResolvedValue(`
        export default {
          framework: '@storybook/nextjs',
          addons: ['@storybook/addon-essentials'],
        };
      `);

      await nextjsToNextjsVite.run!({
        result,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.js',
        storiesPaths: ['**/*.stories.*'],
        configDir: '.storybook',
      } as any);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/.storybook/main.js',
        expect.stringContaining('@storybook/nextjs-vite')
      );
    });

    it('should handle dry run mode', async () => {
      const result = {
        hasNextjsPackage: true,
        packageJsonFiles: ['/project/package.json'],
      };

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            '@storybook/nextjs': '^9.0.0',
          },
        })
      );

      await nextjsToNextjsVite.run!({
        result,
        dryRun: true,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.js',
        storiesPaths: ['**/*.stories.*'],
        configDir: '.storybook',
      } as any);

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
