import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { VITE_DEFAULT_VERSION, nextjsToNextjsVite } from './nextjs-to-nextjs-vite.ts';

vi.mock('node:fs/promises', { spy: true });

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    step: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('globby', () => ({
  globby: vi.fn().mockResolvedValue(['/project/.storybook/preview.ts']),
}));

describe('nextjs-to-nextjs-vite', () => {
  const mockPackageManager = {
    getAllDependencies: vi.fn(),
    packageJsonPaths: ['/project/package.json'],
    removeDependencies: vi.fn().mockResolvedValue(undefined),
    addDependencies: vi.fn().mockResolvedValue(undefined),
    getDependencyVersion: vi.fn(),
  } as unknown as JsPackageManager;

  const runOptions = {
    result: { hasNextjsPackage: true, packageJsonFiles: [] },
    packageManager: mockPackageManager,
    mainConfigPath: '/project/.storybook/main.ts',
    storiesPaths: ['/project/src/Button.stories.tsx'],
    configDir: '/project/.storybook',
    storybookVersion: '9.0.0',
  } as unknown as Omit<RunOptions<any>, 'files'>;

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue(null);
  });

  describe('check function', () => {
    it('should return null if @storybook/nextjs is not installed', async () => {
      mockPackageManager.getAllDependencies = vi.fn().mockReturnValue({
        '@storybook/react': '^9.0.0',
      });

      const result = await checkFix(nextjsToNextjsVite, {
        packageManager: mockPackageManager,
      } as CheckOptions);
      expect(result).toBeNull();
    });

    it('should return migration options if @storybook/nextjs is installed', async () => {
      mockPackageManager.getAllDependencies = vi.fn().mockReturnValue({
        '@storybook/nextjs': '^9.0.0',
        '@storybook/react': '^9.0.0',
      });
      vol.fromJSON({
        '/project/package.json': JSON.stringify({
          dependencies: { '@storybook/nextjs': '^9.0.0' },
        }),
      });

      const result = await checkFix(nextjsToNextjsVite, {
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
      vol.fromJSON({ '/project/package.json': '{ invalid' });

      const result = await checkFix(nextjsToNextjsVite, {
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
    });
  });

  describe('run function', () => {
    beforeEach(() => {
      vol.fromJSON({
        '/project/.storybook/main.ts': `export default { framework: '@storybook/nextjs' };`,
        '/project/.storybook/preview.ts': `import type { Preview } from '@storybook/nextjs';`,
        '/project/src/Button.stories.tsx': `import type { Meta } from '@storybook/nextjs';`,
      });
    });

    it('should swap the framework package and add vite if not installed', async () => {
      await runFix(nextjsToNextjsVite, runOptions);

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith(['@storybook/nextjs']);
      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        [`@storybook/nextjs-vite@9.0.0`, `vite@${VITE_DEFAULT_VERSION}`]
      );
    });

    it('should not add vite if already installed', async () => {
      vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue('6.0.0');

      await runFix(nextjsToNextjsVite, runOptions);

      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        ['@storybook/nextjs-vite@9.0.0']
      );
    });

    it('should rewrite the main config, config files, and stories', async () => {
      await runFix(nextjsToNextjsVite, runOptions);

      expect(vol.toJSON()).toEqual({
        '/project/.storybook/main.ts': `export default { framework: '@storybook/nextjs-vite' };`,
        '/project/.storybook/preview.ts': `import type { Preview } from '@storybook/nextjs-vite';`,
        '/project/src/Button.stories.tsx': `import type { Meta } from '@storybook/nextjs-vite';`,
      });
    });

    it('should not corrupt main config that already references @storybook/nextjs-vite', async () => {
      const mainConfig = `
        import type { StorybookConfig } from '@storybook/nextjs-vite';
        export default {
          framework: { name: '@storybook/nextjs-vite', options: {} },
        };
      `;
      vol.fromJSON({ '/project/.storybook/main.ts': mainConfig });

      await runFix(nextjsToNextjsVite, runOptions);

      expect(vol.toJSON()['/project/.storybook/main.ts']).toBe(mainConfig);
    });

    it('should fail without touching dependencies when the main config cannot be read', async () => {
      vol.unlinkSync('/project/.storybook/main.ts');

      await expect(runFix(nextjsToNextjsVite, runOptions)).rejects.toThrow(
        '/project/.storybook/main.ts'
      );
      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
    });
  });
});
