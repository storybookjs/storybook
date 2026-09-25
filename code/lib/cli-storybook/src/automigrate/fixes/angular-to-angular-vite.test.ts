import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import semver from 'semver';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { logger, prompt } from 'storybook/internal/node-logger';

import { ANALOG_VITE_PLUGIN_ANGULAR_VERSION } from 'storybook/internal/cli';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import { fs, vol } from 'memfs';

import { resolveZoneless } from '../../../../../frameworks/angular-vite/src/preset.ts';
import { add } from '../../add.ts';
import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import {
  ANALOG_PACKAGE,
  ANGULAR_PACKAGE,
  ANGULAR_VITE_PACKAGE,
  angularToAngularVite,
} from './angular-to-angular-vite.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('globby', { spy: true });

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
  getProjectRoot: vi.fn().mockReturnValue('/project'),
  formatFileContent: vi.fn((_filePath: string, content: string) => Promise.resolve(content)),
}));

vi.mock('empathic/find', () => ({
  any: vi.fn().mockReturnValue(undefined),
}));

vi.mock('../../add.ts', () => ({
  add: vi.fn().mockResolvedValue(undefined),
}));

const mockPromptConfirm = vi.mocked(prompt.confirm);
const mockAdd = vi.mocked(add);

const MAIN = '/project/.storybook/main.ts';
const PACKAGE_JSON = '/project/package.json';
const ANGULAR_JSON = '/project/angular.json';
const PROJECT_JSON = '/project/libs/soba/project.json';

const read = (path: string) => vol.readFileSync(path, 'utf8') as string;

describe('angular-to-angular-vite', () => {
  const mockPackageManager = {
    getAllDependencies: vi.fn(),
    isDependencyInstalled: vi.fn(),
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
    // Derived exactly as `JsPackageManager` derives it, so a test only ever states the dependency
    // tree once.
    vi.mocked(mockPackageManager.isDependencyInstalled).mockImplementation((dependency) =>
      Object.keys(mockPackageManager.getAllDependencies()).includes(dependency)
    );
    vol.reset();
    vol.fromJSON({
      [MAIN]: `export default { framework: '${ANGULAR_PACKAGE}' };`,
      [PACKAGE_JSON]: '{}',
    });
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(existsSync).mockImplementation(fs.existsSync as typeof existsSync);
    // globby walks the real disk, which memfs has replaced, so workspace files are discovered out
    // of the virtual volume instead.
    vi.mocked(globby).mockImplementation(async (patterns, options) => {
      const basenames = [patterns].flat().map((pattern) => pattern.replaceAll('**/', ''));
      return Object.keys(vol.toJSON()).filter(
        (path) =>
          basenames.some((basename) => path.endsWith(`/${basename}`)) &&
          !options?.ignore?.some((pattern) =>
            path.includes(`/${pattern.replaceAll('**/', '').replaceAll('/**', '')}/`)
          )
      ) as never;
    });
  });

  const baseResult = {
    framework: ANGULAR_PACKAGE,
    hasWebpackFinal: false,
    packageJsonFiles: [PACKAGE_JSON],
    angularVersion: '21.2.4',
  } as const;

  const runMigration = (options: Partial<Omit<RunOptions<any>, 'files'>> = {}) =>
    runFix(angularToAngularVite, {
      result: baseResult,
      packageManager: mockPackageManager,
      mainConfig: { framework: ANGULAR_PACKAGE, stories: [] },
      mainConfigPath: MAIN,
      storiesPaths: [],
      configDir: '/project/.storybook',
      storybookVersion: '9.0.0',
      ...options,
    } as Omit<RunOptions<any>, 'files'>);

  /**
   * Drive the fix end to end the way the automigrate runner does: `check()`, then `run()` on
   * whatever it returned.
   */
  const checkThenRun = async (
    mainConfig: StorybookConfigRaw = { framework: ANGULAR_PACKAGE, stories: [] }
  ) => {
    // Declines the optional addon prompts.
    mockPromptConfirm.mockResolvedValue(false);

    const result = await checkFix(angularToAngularVite, {
      packageManager: mockPackageManager,
      mainConfig,
      mainConfigPath: MAIN,
    } as CheckOptions);

    if (result) {
      await runMigration({ result, mainConfig, storybookVersion: '10.0.0' });
    }

    return result;
  };

  describe('check function', () => {
    it('returns null when @storybook/angular is not installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        '@storybook/react': '^9.0.0',
      });

      const result = await checkFix(angularToAngularVite, {
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns null when @storybook/angular-vite is already installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
        [ANGULAR_VITE_PACKAGE]: '^9.0.0',
      });

      const result = await checkFix(angularToAngularVite, {
        packageManager: mockPackageManager,
      } as CheckOptions);

      expect(result).toBeNull();
    });

    it('returns null when framework is something else entirely', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        '@storybook/react-vite': '^9.0.0',
      });

      const result = await checkFix(angularToAngularVite, {
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

      const result = await checkFix(angularToAngularVite, {
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

      vol.fromJSON({
        [MAIN]: `export default { framework: '${ANGULAR_PACKAGE}', webpackFinal: async (c) => c };`,
      });

      const result = await checkFix(angularToAngularVite, {
        packageManager: mockPackageManager,
        mainConfig: { framework: ANGULAR_PACKAGE },
        mainConfigPath: MAIN,
      } as CheckOptions);

      expect(result?.hasWebpackFinal).toBe(true);
    });

    it('reports hasWebpackFinal: false when main config does not contain webpackFinal', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });

      const result = await checkFix(angularToAngularVite, {
        packageManager: mockPackageManager,
        mainConfig: { framework: ANGULAR_PACKAGE },
        mainConfigPath: MAIN,
      } as CheckOptions);

      expect(result?.hasWebpackFinal).toBe(false);
    });

    it('accepts an @analogjs/storybook-angular project and records it as the source framework', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
        [ANALOG_PACKAGE]: '^2.6.3',
      });
      mockAngularCore({ declared: '^21.0.0', resolved: '21.0.4' });

      const result = await checkFix(angularToAngularVite, {
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

      const result = await checkFix(angularToAngularVite, {
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

      const result = await checkFix(angularToAngularVite, {
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

      const result = await checkFix(angularToAngularVite, {
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

      const result = await checkFix(angularToAngularVite, {
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

      const result = await checkFix(angularToAngularVite, {
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
    it('cancels when user declines to continue after webpackFinal warning', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      await runMigration({ result: { ...baseResult, hasWebpackFinal: true } });

      expect(mockPromptConfirm).toHaveBeenCalledOnce();
      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
    });

    it('continues when user accepts to proceed after webpackFinal warning', async () => {
      // webpackFinal continue? yes, addon-vitest? no, addon-a11y? no
      mockPromptConfirm
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await runMigration({ result: { ...baseResult, hasWebpackFinal: true } });

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([ANGULAR_PACKAGE]);
    });

    it('updates dependencies correctly', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      await runMigration();

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
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        [ANGULAR_PACKAGE]: '^9.0.0',
        '@analogjs/vite-plugin-angular': '^2.5.0',
      });

      await runMigration();

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

      await runMigration();

      expect(read(MAIN)).toBe(`export default { framework: '${ANGULAR_VITE_PACKAGE}' };`);
    });

    it('does not corrupt a main config that already references @storybook/angular-vite', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      const mainConfig = `import type { StorybookConfig } from '${ANGULAR_VITE_PACKAGE}';
export default { framework: { name: '${ANGULAR_VITE_PACKAGE}', options: {} } };`;
      vol.fromJSON({ [MAIN]: mainConfig });

      await runMigration({ result: { ...baseResult, packageJsonFiles: [] } });

      expect(read(MAIN)).toBe(mainConfig);
    });

    // `add()` writes the main config itself, so a framework rewrite committed afterwards must
    // build on what it wrote rather than overwrite it.
    it('keeps the addons that storybook add wrote to the main config', async () => {
      mockPromptConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      mockAdd.mockImplementationOnce(async (addon) => {
        vol.fromJSON({
          [MAIN]: `export default { framework: '${ANGULAR_PACKAGE}', addons: ['${addon}'] };`,
        });
      });

      await runMigration();

      expect(read(MAIN)).toBe(
        `export default { framework: '${ANGULAR_VITE_PACKAGE}', addons: ['@storybook/addon-a11y'] };`
      );
    });

    it('rewrites angular.json builder entries', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vol.fromJSON({
        [ANGULAR_JSON]: JSON.stringify({
          projects: {
            myApp: {
              architect: {
                storybook: { builder: '@storybook/angular:start-storybook' },
                'build-storybook': { builder: '@storybook/angular:build-storybook' },
              },
            },
          },
        }),
      });

      await runMigration();

      const { architect } = JSON.parse(read(ANGULAR_JSON)).projects.myApp;
      expect(architect.storybook.builder).toBe(`${ANGULAR_VITE_PACKAGE}:start-storybook`);
      expect(architect['build-storybook'].builder).toBe(`${ANGULAR_VITE_PACKAGE}:build-storybook`);
    });

    it('rewrites Nx project.json executor entries', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vol.fromJSON({
        [PROJECT_JSON]: JSON.stringify({
          name: 'soba',
          targets: {
            storybook: { executor: '@storybook/angular:start-storybook' },
            'build-storybook': { executor: '@storybook/angular:build-storybook' },
          },
        }),
      });

      await runMigration();

      const { targets } = JSON.parse(read(PROJECT_JSON));
      expect(targets.storybook.executor).toBe(`${ANGULAR_VITE_PACKAGE}:start-storybook`);
      expect(targets['build-storybook'].executor).toBe(`${ANGULAR_VITE_PACKAGE}:build-storybook`);
    });

    it('fails without writing anything when a workspace file is not valid JSON', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vol.fromJSON({ [ANGULAR_JSON]: '{ "projects": ' });

      await expect(runMigration()).rejects.toThrow(ANGULAR_JSON);
      expect(read(MAIN)).toBe(`export default { framework: '${ANGULAR_PACKAGE}' };`);
    });

    // Compodoc no longer runs once the framework switches, and the dedicated
    // `angular-vite-remove-compodoc` fix is checked against the pre-migration main config, so it
    // never sees an angular-vite project to clean up.
    it('removes the Compodoc setup the framework switch makes dead', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vi.mocked(mockPackageManager.getDependencyVersion).mockImplementation((pkg: string) =>
        pkg === '@compodoc/compodoc' ? '^1.1.0' : '^21.2.0'
      );

      await runMigration();

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith(['@compodoc/compodoc']);
    });

    // The Compodoc cleanup is gated on the angular-vite builder, so the executor rewrite has to
    // land before the cleanup reads it.
    it("rewrites an Nx executor and drops that target's Compodoc options in the same run", async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vol.fromJSON({
        [PROJECT_JSON]: JSON.stringify(
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
        ),
      });

      await runMigration();

      const written = JSON.parse(read(PROJECT_JSON));
      expect(written.targets.storybook.executor).toBe(`${ANGULAR_VITE_PACKAGE}:start-storybook`);
      expect(written.targets.storybook.options).toEqual({ port: 6006 });
    });

    // The workspace-wide rewrite has to cover the same tree as the package.json walk.
    it('discovers project.json files from the workspace root, not the working directory', async () => {
      mockPromptConfirm.mockResolvedValue(false);

      await runMigration();

      expect(globby).toHaveBeenCalledWith(
        ['**/project.json'],
        expect.objectContaining({
          cwd: '/project',
          absolute: true,
          ignore: expect.arrayContaining(['**/storybook-static/**']),
        })
      );
    });

    it('skips a project.json that Storybook itself wrote into its build output', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: { storybook: { executor: '@storybook/angular:start-storybook' } },
      });
      vol.fromJSON({
        [PROJECT_JSON]: projectJsonContent,
        '/project/storybook-static/project.json': projectJsonContent,
      });

      await runMigration();

      expect(read(PROJECT_JSON)).toContain(`${ANGULAR_VITE_PACKAGE}:start-storybook`);
      expect(read('/project/storybook-static/project.json')).toBe(projectJsonContent);
    });

    it('rewrites an @analogjs/storybook-angular executor and renames its zoneless option', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vol.fromJSON({
        [MAIN]: `export default { framework: '${ANALOG_PACKAGE}' };`,
        [PROJECT_JSON]: JSON.stringify({
          name: 'soba',
          targets: {
            storybook: {
              executor: `${ANALOG_PACKAGE}:start-storybook`,
              options: { experimentalZoneless: true },
            },
          },
        }),
      });

      await runMigration({ result: { ...baseResult, framework: ANALOG_PACKAGE } });

      const written = read(PROJECT_JSON);
      expect(written).toContain(`${ANGULAR_VITE_PACKAGE}:start-storybook`);
      expect(written).not.toContain(ANALOG_PACKAGE);
      // `experimentalZoneless` is Analog's spelling; angular-vite's schema only accepts `zoneless`,
      // and rejects unknown keys outright.
      expect(written).toContain('"zoneless": true');
      expect(written).not.toContain('experimentalZoneless');
    });

    it('drops both the Analog framework and the @storybook/angular peer it required', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vol.fromJSON({ [MAIN]: `export default { framework: '${ANALOG_PACKAGE}' };` });

      await runMigration({ result: { ...baseResult, framework: ANALOG_PACKAGE } });

      expect(mockPackageManager.removeDependencies).toHaveBeenCalledWith([
        ANALOG_PACKAGE,
        ANGULAR_PACKAGE,
      ]);
    });

    it('leaves a storybook target owned by another framework package alone', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      const projectJsonContent = JSON.stringify({
        name: 'soba',
        targets: {
          storybook: {
            executor: '@acme/storybook-angular:start-storybook',
            options: { experimentalZoneless: true },
          },
        },
      });
      vol.fromJSON({ [PROJECT_JSON]: projectJsonContent });

      await runMigration();

      expect(read(PROJECT_JSON)).toBe(projectJsonContent);
    });

    // Removing @storybook/angular while the main config still references it leaves Storybook unable
    // to start.
    it('fails before any edit when the framework field is not in the main config file', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      const mainConfig =
        "import base from '../../.storybook/main.base'; export default { ...base };";
      vol.fromJSON({ [MAIN]: mainConfig });

      await expect(runMigration()).rejects.toThrow(MAIN);

      expect(mockPackageManager.removeDependencies).not.toHaveBeenCalled();
      expect(mockPackageManager.addDependencies).not.toHaveBeenCalled();
      expect(mockAdd).not.toHaveBeenCalled();
      expect(read(MAIN)).toBe(mainConfig);
    });

    it('invokes storybook add for accepted addons', async () => {
      mockPromptConfirm
        .mockResolvedValueOnce(true) // addon-vitest
        .mockResolvedValueOnce(true); // addon-a11y

      // The runner passes a collector that fixes push post-install addon names into.
      const addonsToPostinstall: string[] = [];

      await runMigration({ addonsToPostinstall });

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
      expect(addonsToPostinstall).toEqual(['@storybook/addon-vitest', '@storybook/addon-a11y']);
    });

    it('does not invoke storybook add when addons are declined', async () => {
      mockPromptConfirm
        .mockResolvedValueOnce(false) // addon-vitest
        .mockResolvedValueOnce(false); // addon-a11y

      await runMigration();

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
      vol.fromJSON({ [PACKAGE_JSON]: packageJsonContent });

      await runMigration();

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
      expect(read(PACKAGE_JSON)).toBe(packageJsonContent);
    });

    it('leaves package.json untouched when there is no test-storybook script or builder ref', async () => {
      mockPromptConfirm.mockResolvedValue(false);
      vol.fromJSON({ [PACKAGE_JSON]: JSON.stringify({ scripts: { build: 'ng build' } }) });

      await runMigration();

      expect(mockPackageManager.writePackageJson).not.toHaveBeenCalled();
    });

    it('creates a wired vitest.config.ts when no Vite/Vitest config exists', async () => {
      // accept addon-vitest, decline addon-a11y
      mockPromptConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await runMigration({ addonsToPostinstall: [] });

      const written = read('/project/vitest.config.ts');
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

      await runMigration({ addonsToPostinstall: [] });

      expect(vol.existsSync('/project/vitest.config.ts')).toBe(false);
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

      const seedFiles = (angularJsonContent: string, previewContent: string) =>
        vol.fromJSON({ [ANGULAR_JSON]: angularJsonContent, [previewConfigPath]: previewContent });

      /** Serve a single Nx `project.json` from the workspace glob, plus an empty preview. */
      const seedNxProjectJson = (zonelessOption: Record<string, unknown>) =>
        vol.fromJSON({
          [PROJECT_JSON]: JSON.stringify({
            name: 'soba',
            targets: {
              storybook: {
                executor: '@storybook/angular:start-storybook',
                options: zonelessOption,
              },
            },
          }),
          [previewConfigPath]: 'export default {};',
        });

      /** Put `zone.js` in the project's dependency tree; `isDependencyInstalled` follows it. */
      const declareZoneJs = () =>
        vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({ 'zone.js': '~0.15.0' });

      const zoneJsWarnings = () =>
        vi
          .mocked(logger.warn)
          .mock.calls.map(([message]) => String(message))
          .filter((message) => message.includes('does not depend on'));

      it("prepends `import 'zone.js';` and logs a step when the project declares zone.js", async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        seedFiles(angularJsonWithFlag(undefined), 'export default {};');

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toContain('import "zone.js";');
        expect(logger.step).toHaveBeenCalledWith(expect.stringContaining(previewConfigPath));
      });

      // The common case, and the one this migration writes itself: a target that declares no
      // `zoneless` option in a project with no `zone.js` to import. `@storybook/angular-vite`
      // reads the same absence as zoneless, so an import here would be unresolvable.
      it('leaves the preview alone when the target declares nothing and zone.js is not a dependency', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        seedFiles(angularJsonWithFlag(undefined), 'export default {};');

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toBe('export default {};');
        expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('does not depend on'));
      });

      // The declared dependency outranks the option: skipping the import costs a dead preview
      // (NG0908), writing a resolvable one costs a console warning (NG0914).
      it('writes the import when zone.js is declared, even for a target that sets zoneless: true', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        seedFiles(angularJsonWithFlag(true), 'export default {};');

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toContain('import "zone.js";');
      });

      // A multi-project upgrade runs every project's `run()` against the tree the first project's
      // run already rewrote, so projects 2..N only ever see angular-vite refs.
      it('still injects zone.js when an earlier run already rewrote the targets', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        seedFiles(
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

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toContain('import "zone.js";');
      });

      it('injects for an explicitly zone-based target, without warning, when zone.js is declared', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        seedFiles(angularJsonWithFlag(false), 'export default {};');

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toContain('import "zone.js";');
        expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('does not depend on'));
      });

      // Writing the import here guarantees an unresolvable specifier, so name the contradiction
      // instead. The `zoneless` spelling is what an earlier run leaves behind.
      it('warns instead of writing when a target sets zoneless: false but zone.js is missing', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        seedFiles(
          JSON.stringify({
            projects: {
              myApp: {
                architect: {
                  storybook: {
                    builder: `${ANGULAR_VITE_PACKAGE}:start-storybook`,
                    options: { zoneless: false },
                  },
                },
              },
            },
          }),
          'export default {};'
        );

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toBe('export default {};');
        expect(zoneJsWarnings()).toEqual([
          "A Storybook builder target sets `zoneless: false`, but this project does not depend on `zone.js`, so no `import 'zone.js';` was added to your preview - it could not resolve, and every story would fail to load. Install `zone.js`, or set `zoneless: true` on that target if your app uses zoneless change detection.",
        ]);
      });

      it('warns once when any of several storybook targets is zone-based and zone.js is missing', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        seedFiles(
          JSON.stringify({
            projects: {
              myApp: {
                architect: {
                  storybook: {
                    builder: '@storybook/angular:start-storybook',
                    options: { experimentalZoneless: false },
                  },
                  'build-storybook': {
                    builder: '@storybook/angular:build-storybook',
                    options: {},
                  },
                },
              },
            },
          }),
          'export default {};'
        );

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toBe('export default {};');
        expect(zoneJsWarnings()).toHaveLength(1);
      });

      it('writes nothing when the workspace has no storybook target, even with zone.js declared', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        seedFiles(
          JSON.stringify({
            projects: {
              myApp: {
                architect: {
                  build: { builder: '@angular/build:application', options: {} },
                },
              },
            },
          }),
          'export default {};'
        );

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toBe('export default {};');
      });

      it('is idempotent: leaves a preview that already imports zone.js (incl. deep imports) untouched', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        seedFiles(angularJsonWithFlag(undefined), "import 'zone.js/testing';\nexport default {};");

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toBe("import 'zone.js/testing';\nexport default {};");
      });

      it('works with a .tsx preview file', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        const tsxPreviewPath = '/project/.storybook/preview.tsx';
        vol.fromJSON({
          [ANGULAR_JSON]: angularJsonWithFlag(undefined),
          [tsxPreviewPath]: 'export default {};',
        });

        await runMigration({ previewConfigPath: tsxPreviewPath });

        expect(read(tsxPreviewPath)).toContain('import "zone.js";');
      });

      it('warns with manual-import guidance when no preview file was found, without throwing', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        vol.fromJSON({ [ANGULAR_JSON]: angularJsonWithFlag(undefined) });

        await expect(runMigration({ previewConfigPath: undefined })).resolves.toBeUndefined();

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('manually'));
      });

      it('renames a leftover experimentalZoneless key to zoneless with the same boolean value', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        seedFiles(angularJsonWithFlag(true), 'export default {};');

        await runMigration({ previewConfigPath });

        const written = JSON.parse(read(ANGULAR_JSON));
        expect(written.projects.myApp.architect.storybook.options).toEqual({ zoneless: true });
      });

      it('handles Nx project.json storybook targets identically to angular.json targets', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        seedNxProjectJson({});

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toContain('import "zone.js";');
      });

      it('warns for a zone-based Nx project.json target in a project without zone.js', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        seedNxProjectJson({ zoneless: false });

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toBe('export default {};');
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('does not depend on'));
      });

      it('only renames/detects the correct project when two projects name their storybook target identically', async () => {
        mockPromptConfirm.mockResolvedValue(false);
        declareZoneJs();
        seedFiles(
          JSON.stringify({
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
          }),
          'export default {};'
        );

        await runMigration({ previewConfigPath });

        expect(read(previewConfigPath)).toContain('import "zone.js";');
        const written = JSON.parse(read(ANGULAR_JSON));
        // Only appA's target (which explicitly carried the old key) is renamed.
        expect(written.projects.appA.architect.storybook.options).toEqual({ zoneless: true });
        expect(written.projects.appB.architect.storybook.options).toEqual({});
      });

      // This migration and `@storybook/angular-vite` both read the `zoneless` builder option, and
      // they used to default it in opposite directions: the framework read an absent option as
      // zoneless while this migration read it as zone-based and wrote an `import 'zone.js'` the
      // framework had already excluded from `optimizeDeps` - unresolvable in a project with no
      // zone.js. Walking every (option x dependency tree) pair through both sides in one test is
      // what keeps them from drifting apart again.
      it('agrees with the framework: an absent zoneless option never means zone-based', async () => {
        const observed: Record<
          string,
          { frameworkTreatsAsZoneless: boolean; migrationWritesImport: boolean }
        > = {};

        for (const zoneless of [undefined, true, false] as const) {
          for (const zoneJsDeclared of [false, true] as const) {
            vi.clearAllMocks();
            mockPromptConfirm.mockResolvedValue(false);
            vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue(
              zoneJsDeclared ? { 'zone.js': '~0.15.0' } : {}
            );
            vol.fromJSON({ [MAIN]: `export default { framework: '${ANGULAR_PACKAGE}' };` });
            seedFiles(
              JSON.stringify({
                projects: {
                  myApp: {
                    architect: {
                      storybook: {
                        builder: '@storybook/angular:start-storybook',
                        options: zoneless === undefined ? {} : { zoneless },
                      },
                    },
                  },
                },
              }),
              'export default {};'
            );

            await runMigration({ previewConfigPath });

            observed[`zoneless=${zoneless} zone.js=${zoneJsDeclared}`] = {
              // The framework's own reading of the same builder option, imported from its preset.
              frameworkTreatsAsZoneless: resolveZoneless(
                zoneless === undefined ? {} : { zoneless }
              ),
              migrationWritesImport: read(previewConfigPath).includes('zone.js'),
            };
          }
        }

        expect(observed).toEqual({
          'zoneless=false zone.js=false': {
            frameworkTreatsAsZoneless: false,
            migrationWritesImport: false,
          },
          'zoneless=false zone.js=true': {
            frameworkTreatsAsZoneless: false,
            migrationWritesImport: true,
          },
          'zoneless=true zone.js=false': {
            frameworkTreatsAsZoneless: true,
            migrationWritesImport: false,
          },
          'zoneless=true zone.js=true': {
            frameworkTreatsAsZoneless: true,
            migrationWritesImport: true,
          },
          'zoneless=undefined zone.js=false': {
            frameworkTreatsAsZoneless: true,
            migrationWritesImport: false,
          },
          'zoneless=undefined zone.js=true': {
            frameworkTreatsAsZoneless: true,
            migrationWritesImport: true,
          },
        });

        // Independent of the recorded table: an import is only ever written where `zone.js` is
        // declared, so it can always resolve.
        expect(
          Object.keys(observed).filter(
            (input) => observed[input].migrationWritesImport && input.endsWith('zone.js=false')
          )
        ).toEqual([]);
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
