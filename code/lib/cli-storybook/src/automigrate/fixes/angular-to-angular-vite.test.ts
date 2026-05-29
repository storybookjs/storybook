import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { prompt } from 'storybook/internal/node-logger';

import { add } from '../../add.ts';
import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { CheckOptions } from './index.ts';
import {
  ANGULAR_PACKAGE,
  ANGULAR_VITE_PACKAGE,
  angularToAngularVite,
} from './angular-to-angular-vite.ts';

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
    logBox: vi.fn(),
  },
  prompt: {
    confirm: vi.fn(),
  },
}));

vi.mock('storybook/internal/common', () => ({
  transformImportFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock('globby', () => ({
  globby: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../add.ts', () => ({
  add: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../helpers/mainConfigFile.ts', () => ({
  updateMainConfig: vi.fn(),
}));

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockPromptConfirm = vi.mocked(prompt.confirm);
const mockAdd = vi.mocked(add);
const mockUpdateMainConfig = vi.mocked(updateMainConfig);

describe('angular-to-angular-vite', () => {
  const mockPackageManager = {
    getAllDependencies: vi.fn(),
    packageJsonPaths: ['/project/package.json'],
    removeDependencies: vi.fn().mockResolvedValue(undefined),
    addDependencies: vi.fn().mockResolvedValue(undefined),
    getDependencyVersion: vi.fn(),
    type: 'npm',
  } as unknown as JsPackageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockPackageManager.removeDependencies).mockResolvedValue(undefined);
    vi.mocked(mockPackageManager.addDependencies).mockResolvedValue(undefined);
    vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue(null);
  });

  describe('check function', () => {
    it('returns null when @storybook/angular is not installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        '@storybook/react': '^9.0.0',
      });

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns null when @storybook/angular-vite is already installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
        [ANGULAR_VITE_PACKAGE]: '^9.0.0',
      });

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns null when framework is something else entirely', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        '@storybook/react-vite': '^9.0.0',
      });

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns null gracefully when package.json paths are empty', async () => {
      const pmWithNoPaths = {
        ...mockPackageManager,
        packageJsonPaths: [],
        getAllDependencies: vi.fn().mockReturnValue({}),
        getDependencyVersion: vi.fn().mockReturnValue(null),
      } as unknown as JsPackageManager;

      const result = await angularToAngularVite.check({
        packageManager: pmWithNoPaths,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('reports angularUnsupportedVersion: true when @angular/core is < 21', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue('^20.0.0');
      // main config read will throw (no file) — that's fine, hasWebpackFinal stays false
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).not.toBeNull();
      expect(result?.angularUnsupportedVersion).toBe(true);
      expect(result?.angularVersion).toBe('20.0.0');
    });

    it('reports angularUnsupportedVersion: false when @angular/core is 21.x', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue('^21.2.0');
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).not.toBeNull();
      expect(result?.angularUnsupportedVersion).toBe(false);
      expect(result?.angularVersion).toBe('21.2.0');
    });

    it('reports hasWebpackFinal: true when main config contains webpackFinal', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue('^21.0.0');

      // check() reads main config files first (via the webpackFinal probe loop),
      // then reads package.json files (for packageJsonFiles collection).
      mockReadFile.mockImplementation((filePath: any) => {
        if (String(filePath).endsWith('package.json')) {
          return Promise.resolve(
            JSON.stringify({ devDependencies: { [ANGULAR_PACKAGE]: '^9.0.0' } })
          ) as any;
        }
        // main config
        return Promise.resolve(
          `export default { framework: '${ANGULAR_PACKAGE}', webpackFinal: async (c) => c };`
        ) as any;
      });

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result?.hasWebpackFinal).toBe(true);
    });

    it('reports hasWebpackFinal: false when main config does not contain webpackFinal', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue('^21.0.0');

      mockReadFile.mockImplementation((filePath: any) => {
        if (String(filePath).endsWith('package.json')) {
          return Promise.resolve(
            JSON.stringify({ devDependencies: { [ANGULAR_PACKAGE]: '^9.0.0' } })
          ) as any;
        }
        return Promise.resolve(`export default { framework: '${ANGULAR_PACKAGE}' };`) as any;
      });

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result?.hasWebpackFinal).toBe(false);
    });
  });

  describe('prompt function', () => {
    it('returns migration marketing copy', () => {
      const msg = angularToAngularVite.prompt();

      expect(msg).toContain(ANGULAR_PACKAGE);
      expect(msg).toContain(ANGULAR_VITE_PACKAGE);
    });
  });

  describe('run function', () => {
    const baseResult = {
      angularUnsupportedVersion: false,
      angularVersion: '21.0.0',
      hasWebpackFinal: false,
      packageJsonFiles: ['/project/package.json'],
    };

    it('exits early when result is null', async () => {
      await expect(
        angularToAngularVite.run!({
          result: null,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any)
      ).resolves.toBeUndefined();

      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
    });

    it('exits early and logs message when Angular version is unsupported', async () => {
      await angularToAngularVite.run!({
        result: { ...baseResult, angularUnsupportedVersion: true, angularVersion: '20.0.0' },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
    });

    it('cancels when user declines to continue after webpackFinal warning', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      await angularToAngularVite.run!({
        result: { ...baseResult, hasWebpackFinal: true },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockPromptConfirm).toHaveBeenCalledOnce();
      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
    });

    it('continues when user accepts to proceed after webpackFinal warning', async () => {
      // First confirm: webpackFinal continue? → yes
      // Second confirm: add-vitest? → no
      // Third confirm: add-a11y? → no
      mockPromptConfirm
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      mockReadFile.mockResolvedValue(
        `export default { framework: '${ANGULAR_PACKAGE}', webpackFinal: async c => c };`
      );

      await angularToAngularVite.run!({
        result: { ...baseResult, hasWebpackFinal: true },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([ANGULAR_PACKAGE]);
    });

    it('updates dependencies correctly', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([ANGULAR_PACKAGE]);
      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        [`${ANGULAR_VITE_PACKAGE}@9.0.0`]
      );
    });

    it('patches the main config to replace @storybook/angular with @storybook/angular-vite', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/.storybook/main.ts',
        expect.stringContaining(ANGULAR_VITE_PACKAGE)
      );
    });

    it('does not corrupt a main config that already references @storybook/angular-vite', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockReadFile.mockResolvedValue(
        `import type { StorybookConfig } from '${ANGULAR_VITE_PACKAGE}';
export default { framework: { name: '${ANGULAR_VITE_PACKAGE}', options: {} } };`
      );

      await angularToAngularVite.run!({
        result: { ...baseResult, packageJsonFiles: [] },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      // writeFile should not have been called for the main config because
      // nothing changed (no @storybook/angular without -vite suffix present).
      expect(mockWriteFile).not.toHaveBeenCalledWith(
        '/project/.storybook/main.ts',
        expect.anything()
      );
    });

    it('rewrites angular.json builder entries', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      const angularJsonContent = JSON.stringify({
        projects: {
          myApp: {
            architect: {
              storybook: { builder: '@storybook/angular:start-storybook' },
              'build-storybook': { builder: '@storybook/angular:build-storybook' },
            },
          },
        },
      });

      mockReadFile.mockImplementation((filePath: any) => {
        const p = String(filePath);
        if (p.endsWith('angular.json')) {
          return Promise.resolve(angularJsonContent) as any;
        }
        if (p.endsWith('package.json')) {
          return Promise.resolve('{}') as any;
        }
        // main config files — return content without @storybook/angular so no write occurs
        return Promise.resolve(`export default { framework: '${ANGULAR_PACKAGE}' };`) as any;
      });

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/angular.json',
        expect.stringContaining(`${ANGULAR_VITE_PACKAGE}:start-storybook`)
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/angular.json',
        expect.stringContaining(`${ANGULAR_VITE_PACKAGE}:build-storybook`)
      );
    });

    it('rewrites Nx project.json executor entries', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      // Nx project.json files are scattered and discovered via globby, not
      // co-located with package.json like angular.json. The project.json glob
      // (step 3b) is the first globby call; the configDir glob falls back to
      // the default empty mock.
      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValueOnce(['/project/libs/soba/project.json']);

      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: {
          storybook: { executor: '@storybook/angular:start-storybook' },
          'build-storybook': { executor: '@storybook/angular:build-storybook' },
        },
      });

      mockReadFile.mockImplementation((filePath: any) => {
        const p = String(filePath);
        if (p.endsWith('project.json')) {
          return Promise.resolve(projectJsonContent) as any;
        }
        // angular.json / package.json / main config: no @storybook/angular
        // builder strings, so no write occurs for them.
        return Promise.resolve(`export default { framework: '${ANGULAR_PACKAGE}' };`) as any;
      });

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/libs/soba/project.json',
        expect.stringContaining(`${ANGULAR_VITE_PACKAGE}:start-storybook`)
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/libs/soba/project.json',
        expect.stringContaining(`${ANGULAR_VITE_PACKAGE}:build-storybook`)
      );
    });

    it('carries a builder compodoc:false into framework.options', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValueOnce(['/project/libs/soba/project.json']);

      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: {
          storybook: {
            executor: '@storybook/angular:start-storybook',
            options: { compodoc: false },
          },
        },
      });

      mockReadFile.mockImplementation((filePath: any) => {
        const p = String(filePath);
        if (p.endsWith('project.json')) {
          return Promise.resolve(projectJsonContent) as any;
        }
        return Promise.resolve(`export default { framework: '${ANGULAR_PACKAGE}' };`) as any;
      });

      // Drive the updateMainConfig callback so we can assert the field write.
      const setFieldValue = vi.fn();
      mockUpdateMainConfig.mockImplementation((async (_opts: any, cb: any) => {
        await cb({ setFieldValue });
      }) as any);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockUpdateMainConfig).toHaveBeenCalled();
      expect(setFieldValue).toHaveBeenCalledWith(['framework', 'options', 'compodoc'], false);
    });

    it('does not touch framework.options when compodoc is not disabled', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValueOnce(['/project/libs/soba/project.json']);

      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: {
          storybook: { executor: '@storybook/angular:start-storybook', options: {} },
        },
      });

      mockReadFile.mockImplementation((filePath: any) => {
        const p = String(filePath);
        if (p.endsWith('project.json')) {
          return Promise.resolve(projectJsonContent) as any;
        }
        return Promise.resolve(`export default { framework: '${ANGULAR_PACKAGE}' };`) as any;
      });

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockUpdateMainConfig).not.toHaveBeenCalled();
    });

    it('skips dependency and file updates in dry-run mode', async () => {
      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: true,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
      expect(mockPackageManager.addDependencies).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('invokes storybook add for accepted addons', async () => {
      // webpackFinal? not present, so first prompts are vitest and a11y
      mockPromptConfirm
        .mockResolvedValueOnce(true) // addon-vitest
        .mockResolvedValueOnce(true); // addon-a11y

      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockAdd).toHaveBeenCalledWith(
        '@storybook/addon-vitest',
        expect.objectContaining({ skipInstall: true, skipPostinstall: false })
      );
      expect(mockAdd).toHaveBeenCalledWith(
        '@storybook/addon-a11y',
        expect.objectContaining({ skipInstall: true, skipPostinstall: false })
      );
    });

    it('does not invoke storybook add when addons are declined', async () => {
      mockPromptConfirm
        .mockResolvedValueOnce(false) // addon-vitest
        .mockResolvedValueOnce(false); // addon-a11y

      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockAdd).not.toHaveBeenCalled();
    });
  });
});
