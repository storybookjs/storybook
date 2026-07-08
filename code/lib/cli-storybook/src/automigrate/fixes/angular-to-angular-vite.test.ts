import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { loadConfig, printConfig } from 'storybook/internal/csf-tools';

import { logger, prompt } from 'storybook/internal/node-logger';

import { add } from '../../add.ts';
import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { CheckOptions } from './index.ts';
import {
  ANGULAR_PACKAGE,
  ANGULAR_VITE_PACKAGE,
  angularToAngularVite,
  setFrameworkCompodocFalse,
} from './angular-to-angular-vite.ts';

// Mock dependencies
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// AngularJSON (pulled in transitively via `storybook/internal/cli`) reads/writes angular.json
// synchronously, unlike the rest of this fix's async `node:fs/promises` I/O.
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
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

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  transformImportFiles: vi.fn().mockResolvedValue([]),
  getProjectRoot: vi.fn().mockReturnValue('/project'),
  formatFileContent: vi.fn((_filePath: string, content: string) => Promise.resolve(content)),
}));

vi.mock('empathic/find', () => ({
  any: vi.fn().mockReturnValue(undefined),
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
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
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
    // Default: angular.json doesn't exist (AngularJSON gracefully skips it). Tests that need
    // angular.json content override this via `mockAngularJson(...)`.
    mockExistsSync.mockReturnValue(false);
  });

  /** Wire the sync `node:fs` mocks so `AngularJSON` reads `/project/angular.json` as `content`. */
  const mockAngularJson = (content: string) => {
    mockExistsSync.mockImplementation((p: any) => String(p).endsWith('angular.json'));
    mockReadFileSync.mockImplementation((p: any) => {
      if (String(p).endsWith('angular.json')) {
        return content;
      }
      throw new Error(`ENOENT: ${p}`);
    });
  };

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
      mockAngularJson(angularJsonContent);

      mockReadFile.mockImplementation((filePath: any) => {
        const p = String(filePath);
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

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/project/angular.json',
        expect.stringContaining(`${ANGULAR_VITE_PACKAGE}:start-storybook`)
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
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

    it('carries a builder compodoc:false into framework.options without dropping the name', async () => {
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

      // Drive the callback with a real ConfigFile (matching what updateMainConfig provides) so the
      // assertion reflects the actual AST transform, not a mocked field-setter.
      let printed: string | undefined;
      mockUpdateMainConfig.mockImplementation((async (_opts: any, cb: any) => {
        const main = loadConfig(
          `export default { framework: getAbsolutePath('${ANGULAR_VITE_PACKAGE}') };`
        ).parse();
        await cb(main);
        printed = printConfig(main).code;
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
      expect(printed).toContain('compodoc: false');
      expect(printed).toContain(`getAbsolutePath('${ANGULAR_VITE_PACKAGE}')`);
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

      // The runner passes a collector that fixes push post-install addon names into.
      const addonsToPostinstall: string[] = [];

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
        addonsToPostinstall,
      } as any);

      // Postinstall is deferred (skipPostinstall: true): the addon isn't installed yet, so the
      // runner configures it after the batched install completes.
      expect(mockAdd).toHaveBeenCalledWith(
        '@storybook/addon-vitest',
        expect.objectContaining({ skipInstall: true, skipPostinstall: true })
      );
      expect(mockAdd).toHaveBeenCalledWith(
        '@storybook/addon-a11y',
        expect.objectContaining({ skipInstall: true, skipPostinstall: true })
      );
      // Both accepted addons are queued for post-install configuration.
      expect(addonsToPostinstall).toEqual(['@storybook/addon-vitest', '@storybook/addon-a11y']);
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

    it('rewrites an existing test-storybook script to "vitest run"', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      const packageJsonContent = JSON.stringify(
        {
          scripts: {
            storybook: '@storybook/angular:start-storybook',
            'test-storybook': 'test-storybook --url http://localhost:6006',
          },
        },
        null,
        2
      );

      mockReadFile.mockImplementation((filePath: any) => {
        const p = String(filePath);
        if (p.endsWith('package.json')) {
          return Promise.resolve(packageJsonContent) as any;
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

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/package.json',
        expect.stringContaining('"test-storybook": "vitest run"')
      );
      // Builder refs in the same file are still rewritten alongside the script change.
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/project/package.json',
        expect.stringContaining(`${ANGULAR_VITE_PACKAGE}:start-storybook`)
      );
    });

    it('leaves package.json untouched when there is no test-storybook script or builder ref', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      mockReadFile.mockImplementation((filePath: any) => {
        const p = String(filePath);
        if (p.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ scripts: { build: 'ng build' } })) as any;
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

      expect(mockWriteFile).not.toHaveBeenCalledWith('/project/package.json', expect.anything());
    });

    it('creates a wired vitest.config.ts when no Vite/Vitest config exists', async () => {
      // accept addon-vitest, decline addon-a11y
      mockPromptConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '/project/.storybook',
        storybookVersion: '9.0.0',
        addonsToPostinstall: [],
      } as any);

      const configWrite = mockWriteFile.mock.calls.find(([p]) => p === '/project/vitest.config.ts');
      expect(configWrite).toBeDefined();
      const written = String(configWrite![1]);
      // storybookAngularVitest must come before storybookTest in the same plugins array.
      expect(written).toContain(
        "import { storybookAngularVitest } from '@storybook/angular-vite/vitest'"
      );
      expect(written.indexOf('storybookAngularVitest({})')).toBeGreaterThan(-1);
      expect(written.indexOf('storybookAngularVitest({})')).toBeLessThan(
        written.indexOf('storybookTest(')
      );
      expect(written).toContain("path.join(dirname, '.storybook')");
    });

    it('does not create a vitest.config.ts when one already exists', async () => {
      const find = await import('empathic/find');
      vi.mocked(find.any).mockReturnValueOnce('/project/vitest.config.ts');

      mockPromptConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '/project/.storybook',
        storybookVersion: '9.0.0',
        addonsToPostinstall: [],
      } as any);

      expect(mockWriteFile).not.toHaveBeenCalledWith(
        '/project/vitest.config.ts',
        expect.anything()
      );
    });

    it('does not create a vitest.config.ts in dry-run mode', async () => {
      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: true,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '/project/.storybook',
        storybookVersion: '9.0.0',
        addonsToPostinstall: [],
      } as any);

      expect(mockWriteFile).not.toHaveBeenCalledWith(
        '/project/vitest.config.ts',
        expect.anything()
      );
    });

    describe('zone.js detection and preview injection', () => {
      const previewConfigPath = '/project/.storybook/preview.ts';

      const angularJsonWithFlag = (flag: boolean | undefined) =>
        JSON.stringify({
          projects: {
            myApp: {
              architect: {
                storybook: {
                  builder: '@storybook/angular:start-storybook',
                  options: flag === undefined ? {} : { experimentalZoneless: flag },
                },
              },
            },
          },
        });

      const mockFilesFor = (angularJsonContent: string, previewContent: string) => {
        mockAngularJson(angularJsonContent);
        mockReadFile.mockImplementation((filePath: any) => {
          const p = String(filePath);
          if (p === previewConfigPath) {
            return Promise.resolve(previewContent) as any;
          }
          if (p.endsWith('package.json')) {
            return Promise.resolve('{}') as any;
          }
          return Promise.resolve(`export default { framework: '${ANGULAR_PACKAGE}' };`) as any;
        });
      };

      it("prepends `import 'zone.js';` and logs a step when the flag is unset", async () => {
        mockPromptConfirm.mockResolvedValue(false);
        mockFilesFor(angularJsonWithFlag(undefined), 'export default {};');

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).toHaveBeenCalledWith(
          previewConfigPath,
          "import 'zone.js';\nexport default {};"
        );
        expect(logger.step).toHaveBeenCalledWith(expect.stringContaining(previewConfigPath));
      });

      it('does not modify the preview when every storybook target sets experimentalZoneless: true', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        mockFilesFor(angularJsonWithFlag(true), 'export default {};');

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).not.toHaveBeenCalledWith(previewConfigPath, expect.anything());
      });

      it('behaves like unset when experimentalZoneless is explicitly false: injection happens', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        mockFilesFor(angularJsonWithFlag(false), 'export default {};');

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).toHaveBeenCalledWith(
          previewConfigPath,
          expect.stringContaining("import 'zone.js';")
        );
      });

      it('is idempotent: leaves a preview that already imports zone.js (incl. deep imports) untouched', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        mockFilesFor(
          angularJsonWithFlag(undefined),
          "import 'zone.js/testing';\nexport default {};"
        );

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).not.toHaveBeenCalledWith(previewConfigPath, expect.anything());
      });

      it('performs no file writes in --dry-run while still reporting the planned change', async () => {
        mockFilesFor(angularJsonWithFlag(undefined), 'export default {};');

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: true,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).not.toHaveBeenCalled();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
      });

      it('works with a .tsx preview file', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        const tsxPreviewPath = '/project/.storybook/preview.tsx';
        mockAngularJson(angularJsonWithFlag(undefined));
        mockReadFile.mockImplementation((filePath: any) => {
          const p = String(filePath);
          if (p === tsxPreviewPath) {
            return Promise.resolve('export default {};') as any;
          }
          if (p.endsWith('package.json')) {
            return Promise.resolve('{}') as any;
          }
          return Promise.resolve(`export default { framework: '${ANGULAR_PACKAGE}' };`) as any;
        });

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath: tsxPreviewPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).toHaveBeenCalledWith(
          tsxPreviewPath,
          expect.stringContaining("import 'zone.js';")
        );
      });

      it('warns with manual-import guidance when no preview file was found, without throwing', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        mockFilesFor(angularJsonWithFlag(undefined), 'export default {};');

        await expect(
          angularToAngularVite.run!({
            result: baseResult,
            dryRun: false,
            packageManager: mockPackageManager,
            mainConfigPath: '/project/.storybook/main.ts',
            previewConfigPath: undefined,
            storiesPaths: [],
            configDir: '.storybook',
            storybookVersion: '9.0.0',
          } as any)
        ).resolves.toBeUndefined();

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('manually'));
        expect(mockWriteFile).not.toHaveBeenCalledWith(previewConfigPath, expect.anything());
      });

      it('renames a leftover experimentalZoneless key to zoneless with the same boolean value', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        mockFilesFor(angularJsonWithFlag(true), 'export default {};');

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        const angularJsonWrite = mockWriteFileSync.mock.calls.find(
          ([p]) => p === '/project/angular.json'
        );
        expect(angularJsonWrite).toBeDefined();
        const written = JSON.parse(String(angularJsonWrite![1]));
        expect(written.projects.myApp.architect.storybook.options).toEqual({ zoneless: true });
      });

      it('handles Nx project.json storybook targets identically to angular.json targets', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        // eslint-disable-next-line depend/ban-dependencies
        const { globby } = await import('globby');
        vi.mocked(globby).mockResolvedValueOnce(['/project/libs/soba/project.json']);

        const projectJsonContent = JSON.stringify({
          name: 'soba',
          targets: {
            storybook: {
              executor: '@storybook/angular:start-storybook',
              options: {},
            },
          },
        });

        mockReadFile.mockImplementation((filePath: any) => {
          const p = String(filePath);
          if (p.endsWith('project.json')) {
            return Promise.resolve(projectJsonContent) as any;
          }
          if (p === previewConfigPath) {
            return Promise.resolve('export default {};') as any;
          }
          return Promise.resolve(`export default { framework: '${ANGULAR_PACKAGE}' };`) as any;
        });

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).toHaveBeenCalledWith(
          previewConfigPath,
          expect.stringContaining("import 'zone.js';")
        );
      });

      it('injects when one of multiple storybook targets leaves the flag unset (multi-target rule)', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        const angularJsonContent = JSON.stringify({
          projects: {
            myApp: {
              architect: {
                storybook: {
                  builder: '@storybook/angular:start-storybook',
                  options: { experimentalZoneless: true },
                },
                'build-storybook': {
                  builder: '@storybook/angular:build-storybook',
                  options: {},
                },
              },
            },
          },
        });
        mockFilesFor(angularJsonContent, 'export default {};');

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).toHaveBeenCalledWith(
          previewConfigPath,
          expect.stringContaining("import 'zone.js';")
        );
      });

      it('skips injection when every one of multiple storybook targets sets the flag true', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        const angularJsonContent = JSON.stringify({
          projects: {
            myApp: {
              architect: {
                storybook: {
                  builder: '@storybook/angular:start-storybook',
                  options: { experimentalZoneless: true },
                },
                'build-storybook': {
                  builder: '@storybook/angular:build-storybook',
                  options: { experimentalZoneless: true },
                },
              },
            },
          },
        });
        mockFilesFor(angularJsonContent, 'export default {};');

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        expect(mockWriteFile).not.toHaveBeenCalledWith(previewConfigPath, expect.anything());
      });

      it('only renames/detects the correct project when two projects name their storybook target identically', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        const angularJsonContent = JSON.stringify({
          projects: {
            appA: {
              architect: {
                storybook: {
                  builder: '@storybook/angular:start-storybook',
                  options: { experimentalZoneless: true },
                },
              },
            },
            appB: {
              architect: {
                storybook: {
                  builder: '@storybook/angular:start-storybook',
                  options: {},
                },
              },
            },
          },
        });
        mockFilesFor(angularJsonContent, 'export default {};');

        await angularToAngularVite.run!({
          result: baseResult,
          dryRun: false,
          packageManager: mockPackageManager,
          mainConfigPath: '/project/.storybook/main.ts',
          previewConfigPath,
          storiesPaths: [],
          configDir: '.storybook',
          storybookVersion: '9.0.0',
        } as any);

        // Injection fires because appB's target is unset (multi-target rule).
        expect(mockWriteFile).toHaveBeenCalledWith(
          previewConfigPath,
          expect.stringContaining("import 'zone.js';")
        );

        const angularJsonWrite = mockWriteFileSync.mock.calls.find(
          ([p]) => p === '/project/angular.json'
        );
        expect(angularJsonWrite).toBeDefined();
        const written = JSON.parse(String(angularJsonWrite![1]));
        // Only appA's target (which explicitly carried the old key) is renamed.
        expect(written.projects.appA.architect.storybook.options).toEqual({ zoneless: true });
        expect(written.projects.appB.architect.storybook.options).toEqual({});
      });
    });
  });
});

describe('setFrameworkCompodocFalse', () => {
  const apply = (code: string) => {
    const main = loadConfig(code).parse();
    setFrameworkCompodocFalse(main);
    return printConfig(main).code;
  };

  it('wraps a bare string framework into object form, preserving the name', () => {
    const result = apply(`export default { framework: '${ANGULAR_VITE_PACKAGE}' };`);

    expect(result).toContain(`name: '${ANGULAR_VITE_PACKAGE}'`);
    expect(result).toContain('compodoc: false');
  });

  it('preserves a getAbsolutePath()-wrapped framework name', () => {
    const result = apply(
      `export default { framework: getAbsolutePath('${ANGULAR_VITE_PACKAGE}') };`
    );

    // Regression: the call expression must survive as `name`, not be replaced by
    // `{ options: { compodoc: false } }`.
    expect(result).toContain(`name: getAbsolutePath('${ANGULAR_VITE_PACKAGE}')`);
    expect(result).toContain('compodoc: false');
  });

  it('keeps existing name and options on an object-form framework', () => {
    const result = apply(
      `export default { framework: { name: getAbsolutePath('${ANGULAR_VITE_PACKAGE}'), options: { foo: true } } };`
    );

    expect(result).toContain(`name: getAbsolutePath('${ANGULAR_VITE_PACKAGE}')`);
    expect(result).toContain('foo: true');
    expect(result).toContain('compodoc: false');
  });
});
