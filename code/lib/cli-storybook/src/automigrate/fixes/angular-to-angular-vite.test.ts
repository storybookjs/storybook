import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import semver from 'semver';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { logger, prompt } from 'storybook/internal/node-logger';

import { ANALOG_VITE_PLUGIN_ANGULAR_VERSION } from 'storybook/internal/cli';

import { add } from '../../add.ts';
import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { CheckOptions } from './index.ts';
import {
  ANALOG_PACKAGE,
  ANGULAR_PACKAGE,
  ANGULAR_VITE_PACKAGE,
  angularToAngularVite,
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

vi.mock('../helpers/mainConfigFile.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../helpers/mainConfigFile.ts')>()),
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
    writePackageJson: vi.fn(),
    getDependencyVersion: vi.fn(),
    getDeclaredVersionSpecifier: vi.fn(),
    type: 'npm',
  } as unknown as JsPackageManager;

  /**
   * Model both package-manager reads at once, the way the real ones relate: `getDependencyVersion`
   * hands back the raw package.json specifier, while `getDeclaredVersionSpecifier` resolves it
   * (installed version first, then a pnpm catalog lookup).
   */
  const mockAngularCore = ({
    declared,
    resolved,
  }: {
    declared: string | null;
    resolved: string | null;
  }) => {
    vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue(declared);
    vi.mocked(mockPackageManager.getDeclaredVersionSpecifier).mockResolvedValue(resolved);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockPackageManager.removeDependencies).mockResolvedValue(undefined);
    vi.mocked(mockPackageManager.addDependencies).mockResolvedValue(undefined);
    mockAngularCore({ declared: null, resolved: null });
    vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
    // Default: angular.json doesn't exist (AngularJSON gracefully skips it). Tests that need
    // angular.json content override this via `mockAngularJson(...)`.
    mockExistsSync.mockReturnValue(false);
  });

  /**
   * Drive the fix end to end the way the automigrate runner does: `check()`, then `run()` on
   * whatever it returned. A precondition that bails inside `run()` shows up here as "nothing was
   * migrated", which is exactly what the runner cannot see: it records the fix as succeeded.
   */
  const checkThenRun = async (
    mainConfig: StorybookConfigRaw = { framework: ANGULAR_PACKAGE, stories: [] }
  ) => {
    // Declines the optional addon prompts so the run stops at the dependency rewrite.
    mockPromptConfirm.mockResolvedValue(false);
    mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

    const result = await angularToAngularVite.check({
      packageManager: mockPackageManager,
      mainConfig,
    } as CheckOptions);

    if (result) {
      await angularToAngularVite.run!({
        result,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfig,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '10.0.0',
      });
    }

    return result;
  };

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
        getDeclaredVersionSpecifier: vi.fn().mockResolvedValue(null),
      } as unknown as JsPackageManager;

      const result = await angularToAngularVite.check({
        packageManager: pmWithNoPaths,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    // The Angular 21 prerequisite used to be read off the raw package.json specifier, which is not
    // a version in any monorepo: `semver.coerce` returns null for `catalog:` and `workspace:`, and
    // the specifier is missing entirely when `@angular/core` is declared in a workspace package the
    // CLI does not scan. Every one of these projects was told the migration had succeeded while it
    // had bailed out untouched, so these assert the migration actually happened.
    it.each([
      ['a pnpm catalog pin', 'catalog:angular', '21.2.19'],
      ['the workspace protocol', 'workspace:*', '21.0.4'],
      ['a declaration the CLI cannot see in any scanned package.json', null, '21.2.7'],
    ])(
      'migrates an Angular 21 project that declares @angular/core with %s',
      async (_label, declared, resolved) => {
        vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
          [ANGULAR_PACKAGE]: '^10.0.0',
          ...(declared ? { '@angular/core': declared } : {}),
        });
        mockAngularCore({ declared, resolved });

        const result = await checkThenRun();

        expect(result).not.toBeNull();
        expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([ANGULAR_PACKAGE]);
      }
    );

    // Pin rather than regression test: `^21.2.0` already cleared the old `coerce`-based gate. It
    // guards the replacement, where reading the range as a version (`satisfies('^21.2.0',
    // '>=21.0.0')` is false) would reject every project that declares one.
    it('migrates an Angular 21 project that declares a caret range', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^10.0.0',
        '@angular/core': '^21.2.0',
      });
      mockAngularCore({ declared: '^21.2.0', resolved: '^21.2.0' });

      const result = await checkThenRun();

      expect(result).not.toBeNull();
      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([ANGULAR_PACKAGE]);
    });

    // Bailing inside `run()` left the runner recording FixStatus.SUCCEEDED for a migration that
    // never ran. Returning null keeps the fix from being offered at all.
    it.each([
      ['an exact version', '20.3.1'],
      ['a caret range', '^20.0.0'],
      // The lower bound is what decides: this range still resolves to Angular 20.
      ['a range that also admits Angular 20', '^20.0.0 || ^21.0.0'],
    ])('does not offer the migration on Angular 20, declared as %s', async (_label, resolved) => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^10.0.0',
        '@angular/core': resolved,
      });
      mockAngularCore({ declared: resolved, resolved });

      const result = await checkThenRun();

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('needs Angular 21'));
      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
    });

    // Fail open: refusing a supported project is the failure being fixed here, and the migration's
    // other preconditions still apply.
    it('migrates with a warning when the @angular/core version cannot be determined', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^10.0.0',
        '@angular/core': 'workspace:*',
      });
      mockAngularCore({ declared: 'workspace:*', resolved: null });

      const result = await checkThenRun();

      expect(result).not.toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not determine'));
      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([ANGULAR_PACKAGE]);
    });

    // `*` and its spellings admit every version, so their floor is 0.0.0. Angular has never had a
    // 0.x, so that floor is an absence of information and belongs on the fail-open path rather than
    // being refused as "this project is on Angular 0".
    it.each(['*', 'x', '>=0.0.0', '21.2.7 || *'])(
      'treats %s as an unknown version and migrates with a warning',
      async (declared) => {
        vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
          [ANGULAR_PACKAGE]: '^10.0.0',
          '@angular/core': declared,
        });
        // The package manager really does hand `*` back: `semver.validRange('*')` is truthy, so
        // `getDeclaredVersionSpecifier` returns the declared range rather than null.
        mockAngularCore({ declared, resolved: declared });

        const result = await checkThenRun();

        expect(result).not.toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not determine'));
        expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Angular 0'));
        expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([ANGULAR_PACKAGE]);
      }
    );

    it('reports hasWebpackFinal: true when main config contains webpackFinal', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });

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
        mainConfig: { framework: ANGULAR_PACKAGE },
      } as CheckOptions);

      expect(result?.hasWebpackFinal).toBe(true);
    });

    it('reports hasWebpackFinal: false when main config does not contain webpackFinal', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });

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
        mainConfig: { framework: ANGULAR_PACKAGE },
      } as CheckOptions);

      expect(result?.hasWebpackFinal).toBe(false);
    });

    it('accepts an @analogjs/storybook-angular project and records it as the source framework', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
        [ANALOG_PACKAGE]: '^2.6.3',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
        mainConfig: { framework: ANALOG_PACKAGE },
      } as CheckOptions);

      expect(result?.framework).toBe(ANALOG_PACKAGE);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    // `main.ts` conventionally writes `getAbsolutePath('<pkg>')`, and Storybook only maps that path
    // back to a package name for frameworks it ships, so a third-party one arrives as a path.
    it.each([
      ['a resolved package directory', `/repo/node_modules/${ANALOG_PACKAGE}`],
      [
        'a pnpm virtual-store directory',
        `/repo/node_modules/.pnpm/@analogjs+storybook-angular@2.6.3_x/node_modules/${ANALOG_PACKAGE}`,
      ],
    ])('resolves an Analog framework named by %s', async (_label, frameworkPath) => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANALOG_PACKAGE]: '^2.6.3',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
        mainConfig: { framework: { name: frameworkPath } },
      } as CheckOptions);

      expect(result?.framework).toBe(ANALOG_PACKAGE);
    });

    it('does not mistake a resolved @storybook/angular-vite path for @storybook/angular', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
        mainConfig: { framework: { name: `/repo/node_modules/${ANGULAR_VITE_PACKAGE}` } },
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('records @storybook/angular as the source framework for a webpack project', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
        mainConfig: { framework: ANGULAR_PACKAGE },
      } as CheckOptions);

      expect(result?.framework).toBe(ANGULAR_PACKAGE);
    });

    // Another Angular framework can carry `@storybook/angular` as a peer, so the dependency alone
    // does not identify the framework the project renders with.
    it('returns null and says why for an Angular framework it cannot rewrite', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
        '@acme/storybook-angular': '^1.0.0',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
        mainConfig: { framework: '@acme/storybook-angular' },
      } as CheckOptions);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('@acme/storybook-angular'));
    });

    it('stays quiet about a non-Angular project that merely carries the dependency', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      mockAngularCore({ declared: null, resolved: null });

      const result = await angularToAngularVite.check({
        packageManager: mockPackageManager,
        mainConfig: { framework: '@storybook/react-vite' },
      } as CheckOptions);

      expect(result).toBeNull();
      expect(logger.warn).not.toHaveBeenCalled();
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
      framework: ANGULAR_PACKAGE,
      hasWebpackFinal: false,
      packageJsonFiles: ['/project/package.json'],
      angularVersion: '21.2.4',
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
      // These are required peers of @storybook/angular-vite, and are installed alongside the
      // framework because yarn/pnpm do not auto-install missing peers.
      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        [
          `${ANGULAR_VITE_PACKAGE}@9.0.0`,
          `@analogjs/vite-plugin-angular@${ANALOG_VITE_PLUGIN_ANGULAR_VERSION}`,
          '@angular/build@21.2.4',
          '@angular/animations@21.2.4',
          '@angular-devkit/architect@0.2102.4',
        ]
      );
    });

    it('does not re-add @analogjs/vite-plugin-angular when the project already declares it', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
        '@analogjs/vite-plugin-angular': '^2.5.0',
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

      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        [
          `${ANGULAR_VITE_PACKAGE}@9.0.0`,
          '@angular/build@21.2.4',
          '@angular/animations@21.2.4',
          '@angular-devkit/architect@0.2102.4',
        ]
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

    // Compodoc no longer runs once the framework switches, and the dedicated
    // `angular-vite-remove-compodoc` fix is checked against the pre-migration main config, so it
    // never sees an angular-vite project to clean up.
    it('removes the Compodoc setup the framework switch makes dead', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vi.mocked(mockPackageManager.getDependencyVersion).mockImplementation((pkg: string) =>
        pkg === '@compodoc/compodoc' ? '^1.1.0' : '^21.2.0'
      );

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfig: { framework: ANGULAR_PACKAGE },
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith(['@compodoc/compodoc']);
    });

    // The Compodoc cleanup is gated on the angular-vite builder, so the executor rewrite has to
    // land before the cleanup reads it.
    it("rewrites an Nx executor and drops that target's Compodoc options in the same run", async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockAngularCore({ declared: null, resolved: null });

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue(['/project/libs/soba/project.json']);

      let projectJsonContent = JSON.stringify(
        {
          name: 'soba',
          targets: {
            storybook: {
              executor: '@storybook/angular:start-storybook',
              options: { compodoc: true, compodocArgs: ['-e', 'json'], port: 6006 },
            },
          },
        },
        null,
        2
      );

      mockReadFile.mockImplementation(
        (filePath: any) =>
          Promise.resolve(
            String(filePath).endsWith('project.json')
              ? projectJsonContent
              : `export default { framework: '${ANGULAR_PACKAGE}' };`
          ) as any
      );
      mockReadFileSync.mockImplementation((filePath: any) => {
        if (String(filePath).endsWith('project.json')) {
          return projectJsonContent;
        }
        throw new Error(`ENOENT: ${filePath}`);
      });
      mockExistsSync.mockReturnValue(false);
      mockWriteFile.mockImplementation((filePath: any, content: any) => {
        if (String(filePath).endsWith('project.json')) {
          projectJsonContent = String(content);
        }
        return Promise.resolve() as any;
      });
      mockWriteFileSync.mockImplementation((filePath: any, content: any) => {
        if (String(filePath).endsWith('project.json')) {
          projectJsonContent = String(content);
        }
      });

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfig: { framework: ANGULAR_PACKAGE },
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      const written = JSON.parse(projectJsonContent);
      expect(written.targets.storybook.executor).toBe(`${ANGULAR_VITE_PACKAGE}:start-storybook`);
      expect(written.targets.storybook.options).toEqual({ port: 6006 });
    });

    // The workspace-wide rewrite has to cover the same tree as the package.json walk.
    it('discovers project.json files from the workspace root, not the working directory', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockReadFile.mockResolvedValue(`export default { framework: '${ANGULAR_PACKAGE}' };`);

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(globby).toHaveBeenCalledWith(
        ['**/project.json'],
        expect.objectContaining({
          cwd: '/project',
          absolute: true,
          ignore: expect.arrayContaining(['**/storybook-static/**']),
        })
      );
    });

    // A dry run reads the files the real run would have rewritten by then, still on the old builder.
    it('previews the Compodoc option edits it would make on a dry run', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockAngularCore({ declared: null, resolved: null });

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue(['/project/libs/soba/project.json']);

      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: {
          storybook: {
            executor: '@storybook/angular:start-storybook',
            options: { compodoc: true, compodocArgs: ['-e', 'json'], port: 6006 },
          },
        },
      });

      mockReadFile.mockImplementation(
        (filePath: any) =>
          Promise.resolve(
            String(filePath).endsWith('project.json')
              ? projectJsonContent
              : `export default { framework: '${ANGULAR_PACKAGE}' };`
          ) as any
      );
      mockReadFileSync.mockImplementation((filePath: any) => {
        if (String(filePath).endsWith('project.json')) {
          return projectJsonContent;
        }
        throw new Error(`ENOENT: ${filePath}`);
      });

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: true,
        packageManager: mockPackageManager,
        mainConfig: { framework: ANGULAR_PACKAGE },
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockWriteFileSync).not.toHaveBeenCalled();
      expect(logger.step).toHaveBeenCalledWith(
        expect.stringContaining(
          'Would remove the Compodoc builder options from /project/libs/soba/project.json'
        )
      );
    });

    it('skips a project.json that Storybook itself wrote into its build output', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      const discovered = [
        '/project/libs/soba/project.json',
        '/project/storybook-static/project.json',
      ];
      vi.mocked(globby).mockImplementation(async (_patterns: any, options: any) =>
        discovered.filter(
          (path) =>
            !options?.ignore?.some((pattern: string) =>
              path.includes(`/${pattern.replaceAll('**/', '').replaceAll('/**', '')}/`)
            )
        )
      );

      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: { storybook: { executor: '@storybook/angular:start-storybook' } },
      });

      mockReadFile.mockImplementation(
        (filePath: any) =>
          Promise.resolve(
            String(filePath).endsWith('project.json')
              ? projectJsonContent
              : `export default { framework: '${ANGULAR_PACKAGE}' };`
          ) as any
      );

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
      expect(mockWriteFile).not.toHaveBeenCalledWith(
        '/project/storybook-static/project.json',
        expect.anything()
      );
    });

    it('rewrites an @analogjs/storybook-angular executor and renames its zoneless option', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValueOnce(['/project/libs/soba/project.json']);

      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: {
          storybook: {
            executor: `${ANALOG_PACKAGE}:start-storybook`,
            options: { experimentalZoneless: true },
          },
        },
      });

      mockReadFile.mockImplementation(
        (filePath: any) =>
          Promise.resolve(
            String(filePath).endsWith('project.json')
              ? projectJsonContent
              : `export default { framework: '${ANALOG_PACKAGE}' };`
          ) as any
      );

      await angularToAngularVite.run!({
        result: { ...baseResult, framework: ANALOG_PACKAGE },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      const written = vi
        .mocked(mockWriteFile)
        .mock.calls.find(([file]) => String(file).endsWith('project.json'))?.[1];
      expect(written).toContain(`${ANGULAR_VITE_PACKAGE}:start-storybook`);
      expect(written).not.toContain(ANALOG_PACKAGE);
      // `experimentalZoneless` is Analog's spelling; angular-vite's schema only accepts `zoneless`,
      // and rejects unknown keys outright.
      expect(written).toContain('"zoneless": true');
      expect(written).not.toContain('experimentalZoneless');
    });

    it('drops both the Analog framework and the @storybook/angular peer it required', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockReadFile.mockResolvedValue(`export default { framework: '${ANALOG_PACKAGE}' };`);

      await angularToAngularVite.run!({
        result: { ...baseResult, framework: ANALOG_PACKAGE },
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([
        ANALOG_PACKAGE,
        ANGULAR_PACKAGE,
      ]);
    });

    it('leaves a storybook target owned by another framework package alone', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValueOnce(['/project/libs/soba/project.json']);

      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: {
          storybook: {
            executor: '@acme/storybook-angular:start-storybook',
            options: { experimentalZoneless: true },
          },
        },
      });

      mockReadFile.mockImplementation(
        (filePath: any) =>
          Promise.resolve(
            String(filePath).endsWith('project.json')
              ? projectJsonContent
              : `export default { framework: '${ANGULAR_PACKAGE}' };`
          ) as any
      );

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockWriteFile).not.toHaveBeenCalledWith(
        '/project/libs/soba/project.json',
        expect.anything()
      );
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

    // Removing @storybook/angular while the main config still references it leaves Storybook unable
    // to start.
    it('stops before any edit when the framework field is not in the main config file', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      mockReadFile.mockResolvedValue(
        "import base from '../../.storybook/main.base'; export default { ...base };"
      );

      await angularToAngularVite.run!({
        result: baseResult,
        dryRun: false,
        packageManager: mockPackageManager,
        mainConfigPath: '/project/.storybook/main.ts',
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '9.0.0',
      } as any);

      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
      expect(mockPackageManager.addDependencies).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockAdd).not.toHaveBeenCalled();
      expect(logger.step).not.toHaveBeenCalledWith(
        expect.stringContaining('Migration completed successfully')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('/project/.storybook/main.ts')
      );
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

      // `JsPackageManager` reads package.json from a process-wide cache that a raw `writeFile`
      // cannot invalidate, so a later `addDependencies` would write the pre-edit snapshot back.
      expect(mockPackageManager.writePackageJson).toHaveBeenCalledWith(
        expect.objectContaining({
          scripts: {
            storybook: `${ANGULAR_VITE_PACKAGE}:start-storybook`,
            'test-storybook': 'vitest run',
          },
        }),
        '/project'
      );
      expect(mockWriteFile).not.toHaveBeenCalledWith('/project/package.json', expect.anything());
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
      expect(mockPackageManager.writePackageJson).not.toHaveBeenCalled();
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
          expect.stringContaining('import "zone.js";')
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

      // A multi-project upgrade runs every project's `run()` against the tree the first project's
      // run already rewrote, so projects 2..N only ever see angular-vite refs.
      it('still injects zone.js when an earlier run already rewrote the targets', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        mockFilesFor(
          JSON.stringify({
            projects: {
              myApp: {
                architect: {
                  storybook: { builder: `${ANGULAR_VITE_PACKAGE}:start-storybook`, options: {} },
                },
              },
            },
          }),
          'export default {};'
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

        expect(mockWriteFile).toHaveBeenCalledWith(
          previewConfigPath,
          expect.stringContaining('import "zone.js";')
        );
      });

      it('reads the zoneless flag an earlier run renamed, so a zoneless preview stays untouched', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        mockFilesFor(
          JSON.stringify({
            projects: {
              myApp: {
                architect: {
                  storybook: {
                    builder: `${ANGULAR_VITE_PACKAGE}:start-storybook`,
                    options: { zoneless: true },
                  },
                },
              },
            },
          }),
          'export default {};'
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
          expect.stringContaining('import "zone.js";')
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
          expect.stringContaining('import "zone.js";')
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
          expect.stringContaining('import "zone.js";')
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
          expect.stringContaining('import "zone.js";')
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
          expect.stringContaining('import "zone.js";')
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

  describe('required Angular peers', () => {
    const migrate = async (deps: Record<string, string>, angularCore: string | null) => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^10.0.0',
        ...deps,
      });
      mockAngularCore({ declared: angularCore, resolved: angularCore });

      await checkThenRun();

      return vi.mocked(mockPackageManager.addDependencies).mock.calls.at(-1)?.[1] ?? [];
    };

    it('adds all three, pinned to the workspace Angular version', async () => {
      const added = await migrate({ '@angular/core': '21.2.4' }, '21.2.4');

      expect(added).toEqual([
        `${ANGULAR_VITE_PACKAGE}@10.0.0`,
        `@analogjs/vite-plugin-angular@${ANALOG_VITE_PLUGIN_ANGULAR_VERSION}`,
        '@angular/build@21.2.4',
        '@angular/animations@21.2.4',
        // `@angular-devkit/architect` numbers itself `0.<major * 100 + minor>.<patch>`.
        '@angular-devkit/architect@0.2102.4',
      ]);
    });

    it('carries a declared caret range onto all three', async () => {
      const added = await migrate({ '@angular/core': '^21.2.0' }, '^21.2.0');

      expect(added).toEqual(
        expect.arrayContaining([
          '@angular/build@^21.2.0',
          '@angular/animations@^21.2.0',
          '@angular-devkit/architect@^0.2102.0',
        ])
      );
    });

    // Pins, not regression tests: before this fix nothing was added at all, so they passed
    // vacuously. They hold the skip in place now that something is.
    it.each([
      ['@angular/build', '@angular/build@21.2.4'],
      ['@angular/animations', '@angular/animations@21.2.4'],
      ['@angular-devkit/architect', '@angular-devkit/architect@0.2102.4'],
    ])('leaves %s alone when the project already declares it', async (pkg, specifier) => {
      const added = await migrate(
        { '@angular/core': '21.2.4', [pkg]: 'whatever-the-project-picked' },
        '21.2.4'
      );

      expect(added).not.toContain(specifier);
      expect(added).not.toContainEqual(expect.stringContaining(`${pkg}@`));
    });

    // `addDependencies` writes `latest` into package.json for any entry without a version, and
    // `@angular/build`'s latest is already the next Angular major, so an unpinnable peer is left
    // out and named instead. `*` reaches here as a valid range with no floor.
    it.each([null, 'workspace:*', '*'])(
      'adds no peer it cannot pin, when @angular/core resolves to %s',
      async (angularCore) => {
        const added = await migrate({}, angularCore);

        expect(added).toEqual([
          `${ANGULAR_VITE_PACKAGE}@10.0.0`,
          `@analogjs/vite-plugin-angular@${ANALOG_VITE_PLUGIN_ANGULAR_VERSION}`,
        ]);
        added.forEach((specifier) => {
          const version = specifier.slice(specifier.lastIndexOf('@') + 1);
          expect(semver.validRange(version)).not.toBeNull();
        });
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('`@angular/build`, `@angular/animations`')
        );
      }
    );
  });
});
