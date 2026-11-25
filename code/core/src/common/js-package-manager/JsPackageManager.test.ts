import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, normalize, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, prompt } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';

import { invalidateProjectRootCache } from '../utils/paths.ts';
import { JsPackageManager } from './JsPackageManager.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('empathic/find', { spy: true });

const mockVersions = vi.hoisted(() => ({
  '@storybook/react': '8.3.0',
}));

vi.mock('../versions', () => ({
  default: mockVersions,
}));

describe('JsPackageManager', () => {
  let jsPackageManager: JsPackageManager;
  let mockLatestVersion: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // @ts-expect-error Ignore abstract class error
    jsPackageManager = new JsPackageManager();
    jsPackageManager.getCommandName = () => 'npm';
    mockLatestVersion = vi.spyOn(jsPackageManager, 'latestVersion');

    vi.clearAllMocks();
  });

  describe('getOverrideSources', () => {
    afterEach(() => {
      vi.mocked(JsPackageManager.getPackageJson).mockRestore();
      vi.mocked(find.any).mockRestore();
    });

    it.each<{
      name: string;
      input: {
        lockfile: string | undefined;
        manifests: Record<
          string,
          {
            overrides?: Record<string, string | Record<string, string>>;
            resolutions?: Record<string, string>;
            pnpm?: { overrides: Record<string, string> };
          }
        >;
      };
      expected: { path: string; field: string; overrides: unknown }[];
    }>([
      {
        name: 'no override fields',
        input: { lockfile: '/p/package-lock.json', manifests: { '/p/package.json': {} } },
        expected: [],
      },
      {
        name: 'each override field, nested scopes included',
        input: {
          lockfile: '/p/package-lock.json',
          manifests: {
            '/p/package.json': {
              overrides: { a: { storybook: '10.5.3' } },
              resolutions: { '**/storybook': '10.5.3' },
              pnpm: { overrides: { 'a>storybook': '10.5.3' } },
            },
          },
        },
        expected: [
          {
            path: '/p/package.json',
            field: 'overrides',
            overrides: { a: { storybook: '10.5.3' } },
          },
          {
            path: '/p/package.json',
            field: 'resolutions',
            overrides: { '**/storybook': '10.5.3' },
          },
          {
            path: '/p/package.json',
            field: 'pnpm.overrides',
            overrides: { 'a>storybook': '10.5.3' },
          },
        ],
      },
      {
        name: 'the manifest beside the lockfile, not the nested package',
        input: {
          lockfile: '/p/yarn.lock',
          manifests: {
            '/p/package.json': { resolutions: { storybook: '10.5.3' } },
            '/p/app/package.json': { resolutions: { storybook: '9.0.0' } },
          },
        },
        expected: [
          { path: '/p/package.json', field: 'resolutions', overrides: { storybook: '10.5.3' } },
        ],
      },
      {
        name: 'the primary manifest without a lockfile',
        input: {
          lockfile: undefined,
          manifests: {
            '/p/package.json': { resolutions: { storybook: '10.5.3' } },
            '/p/app/package.json': { resolutions: { storybook: '9.0.0' } },
          },
        },
        expected: [
          { path: '/p/app/package.json', field: 'resolutions', overrides: { storybook: '9.0.0' } },
        ],
      },
    ])('$name', ({ input, expected }) => {
      vi.spyOn(find, 'any').mockReturnValue(input.lockfile);
      vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation((path) => ({
        dependencies: {},
        devDependencies: {},
        ...input.manifests[path.replaceAll('\\', '/')],
      }));
      Object.defineProperty(jsPackageManager, 'primaryPackageJson', {
        value: {
          packageJsonPath: normalize('/p/app/package.json'),
          operationDir: normalize('/p/app'),
        },
      });

      expect(jsPackageManager.getOverrideSources()).toEqual(
        expected.map((source) => ({ ...source, path: normalize(source.path) }))
      );
    });

    it('reads the workspace root without a lockfile', async () => {
      const root = await mkdtemp(join(process.cwd(), '.overrides-workspace-'));
      const app = join(root, 'packages', 'app');
      try {
        await mkdir(app, { recursive: true });
        await writeFile(
          join(root, 'package.json'),
          JSON.stringify({ workspaces: ['packages/*'], overrides: { storybook: '10.5.3' } })
        );
        await writeFile(
          join(app, 'package.json'),
          JSON.stringify({ devDependencies: { storybook: '10.5.3' } })
        );
        vi.spyOn(find, 'any').mockReturnValue(undefined);
        vi.spyOn(JsPackageManager, 'getPackageJson');

        // @ts-expect-error Ignore abstract class error
        const manager: JsPackageManager = new JsPackageManager({
          configDir: join(app, '.storybook'),
        });

        expect(manager.getOverrideSources()).toEqual([
          {
            path: join(root, 'package.json'),
            field: 'overrides',
            overrides: { storybook: '10.5.3' },
          },
        ]);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('getInstalledVersion', () => {
    let first: JsPackageManager;
    let second: JsPackageManager;

    beforeEach(() => {
      JsPackageManager.installedVersionCache.clear();
      // @ts-expect-error Ignore abstract class error
      first = new JsPackageManager({ configDir: '/project-a/.storybook' });
      // @ts-expect-error Ignore abstract class error
      second = new JsPackageManager({ configDir: '/project-b/.storybook' });
      const installationsOf = (version: string) => ({
        dependencies: { typescript: [{ version, location: '' }] },
        duplicatedDependencies: {},
        infoCommand: '',
        dedupeCommand: '',
      });
      first.findInstallations = vi.fn().mockResolvedValue(installationsOf('6.0.3'));
      second.findInstallations = vi.fn().mockResolvedValue(installationsOf('7.0.2'));
      first.getModulePackageJSON = vi
        .fn()
        .mockResolvedValue({ name: 'typescript', version: '6.0.3' });
      second.getModulePackageJSON = vi
        .fn()
        .mockResolvedValue({ name: 'typescript', version: '7.0.2' });
    });

    it('keeps the installed version of each project apart', async () => {
      await expect(first.getInstalledVersion('typescript')).resolves.toBe('6.0.3');
      await expect(second.getInstalledVersion('typescript')).resolves.toBe('7.0.2');
    });

    it('reports the version that a package installed under another name bundles', async () => {
      // @ts-expect-error Ignore abstract class error
      const packageManager = new JsPackageManager({ configDir: '/project-c/.storybook' });
      packageManager.findInstallations = vi.fn().mockResolvedValue({
        dependencies: { vitest: [{ version: '0.1.16', location: '' }] },
        duplicatedDependencies: {},
        infoCommand: '',
        dedupeCommand: '',
      });
      packageManager.getModulePackageJSON = vi.fn().mockResolvedValue({
        name: '@voidzero-dev/vite-plus-test',
        version: '0.1.16',
        bundledVersions: { vitest: '4.1.2' },
      });

      await expect(packageManager.getInstalledVersion('vitest')).resolves.toBe('4.1.2');
    });

    describe('when the installations cannot be listed', () => {
      beforeEach(() => {
        first.findInstallations = vi.fn().mockResolvedValue(undefined);
        first.getModulePackageJSON = vi.fn().mockResolvedValue({ version: '6.0.3' });
        second.findInstallations = vi.fn().mockResolvedValue(undefined);
        second.getModulePackageJSON = vi.fn().mockResolvedValue(null);
      });

      it('returns the version of the package that resolves from the project', async () => {
        await expect(first.getInstalledVersion('typescript')).resolves.toBe('6.0.3');
      });

      it('returns null when the package does not resolve either', async () => {
        await expect(second.getInstalledVersion('typescript')).resolves.toBeNull();
      });
    });

    describe('when the listing succeeds without the package', () => {
      beforeEach(() => {
        first.findInstallations = vi.fn().mockResolvedValue({
          dependencies: {},
          duplicatedDependencies: {},
          infoCommand: '',
          dedupeCommand: '',
        });
        first.getModulePackageJSON = vi.fn().mockResolvedValue({ version: '6.0.3' });
      });

      it('returns null, whatever copy resolves from the project', async () => {
        await expect(first.getInstalledVersion('typescript')).resolves.toBeNull();
      });
    });
  });

  describe('getVersionedPackages method', () => {
    it('should return the latest stable release version when current version is the latest stable release', async () => {
      mockLatestVersion.mockResolvedValue('8.3.0');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/react']);

      expect(result).toEqual(['@storybook/react@^8.3.0']);
    });

    it('should return the current version when it is not the latest stable release', async () => {
      mockLatestVersion.mockResolvedValue('8.3.1');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/react']);

      expect(result).toEqual(['@storybook/react@8.3.0']);
    });

    it('should get the requested version when the package is not in the monorepo', async () => {
      mockLatestVersion.mockResolvedValue('2.0.0');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/new-addon@^next']);

      expect(result).toEqual(['@storybook/new-addon@^next']);
    });

    it('should map pkg.pr.new create-storybook specifiers to Storybook packages', async () => {
      const result = await jsPackageManager.getVersionedPackages(['@storybook/react'], {
        storybookVersionSpecifier: 'https://pkg.pr.new/create-storybook@abc123',
      });

      expect(result).toEqual(['@storybook/react@https://pkg.pr.new/@storybook/react@abc123']);
      expect(mockLatestVersion).not.toHaveBeenCalled();
    });

    it('should map repo-scoped pkg.pr.new specifiers to Storybook packages', async () => {
      const result = await jsPackageManager.getVersionedPackages(['@storybook/react'], {
        storybookVersionSpecifier: 'https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef',
      });

      expect(result).toEqual([
        '@storybook/react@https://pkg.pr.new/storybookjs/storybook/@storybook/react@deadbeef',
      ]);
      expect(mockLatestVersion).not.toHaveBeenCalled();
    });

    it('should keep npm tags and prereleases on the CLI version path', async () => {
      mockLatestVersion.mockResolvedValue('8.3.1');

      await expect(
        jsPackageManager.getVersionedPackages(['@storybook/react'], {
          storybookVersionSpecifier: 'next',
        })
      ).resolves.toEqual(['@storybook/react@8.3.0']);
      await expect(
        jsPackageManager.getVersionedPackages(['@storybook/react'], {
          storybookVersionSpecifier: '10.6.0-alpha.7',
        })
      ).resolves.toEqual(['@storybook/react@8.3.0']);
    });

    it('should return the package name as is if it is not a Storybook package', async () => {
      const result = await jsPackageManager.getVersionedPackages(['some-other-package']);

      expect(result).toEqual(['some-other-package']);
    });
  });

  describe('installDependencies method', () => {
    it('propagates a truncated npm stderr tail into the thrown error', async () => {
      const stderr = [
        'npm error code ERESOLVE',
        ...Array.from({ length: 30 }, (_, i) => `npm error while resolving line ${i}`),
        'npm error Could not resolve dependency: vitest@5.0.0',
      ].join('\n');
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue(
        Object.assign(new Error('Command failed: npm install'), { stderr })
      );

      const error = await jsPackageManager.installDependencies().then(
        () => null,
        (e) => e
      );

      // The tail (last 15 lines) is folded into the error message...
      expect(error.message).toContain('Could not resolve dependency: vitest@5.0.0');
      // ...truncated: the head of a long stderr does not leak into the message...
      expect(error.message).not.toContain('npm error code ERESOLVE');
      // ...and is printed so failures behind the spinner name themselves.
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(expect.stringContaining('vitest@5.0.0'));
    });

    it('logs and folds a short stderr tail into the thrown error', async () => {
      const stderr = [
        'npm error code ERESOLVE',
        'npm error Could not resolve dependency: vitest@5.0.0',
      ].join('\n');
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue(
        Object.assign(new Error('Command failed: npm install'), { stderr })
      );

      const error = await jsPackageManager.installDependencies().then(
        () => null,
        (e) => e
      );

      // Short outputs are surfaced too — not silently dropped because they fit the tail window.
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(expect.stringContaining('ERESOLVE'));
      expect(error.message).toContain('Could not resolve dependency: vitest@5.0.0');
    });

    it('does not duplicate the tail when the error message already contains it', async () => {
      // A plain Error with no structured stderr: getErrorLogs falls back to the message itself,
      // so the tail equals the message and appending would duplicate it.
      const message =
        'Command failed: npm install\nnpm error code ERESOLVE\nnpm error Could not resolve dependency: vitest@5.0.0';
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue(new Error(message));

      const error = await jsPackageManager.installDependencies().then(
        () => null,
        (e) => e
      );

      // The tail is still printed, but not appended a second time.
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(expect.stringContaining('ERESOLVE'));
      expect(error.message).toBe(message);
    });

    it('resolves and clears the installed version cache on success', async () => {
      const clearSpy = vi.spyOn(jsPackageManager, 'clearInstalledVersionCache');
      vi.mocked(prompt.executeTaskWithSpinner).mockResolvedValue(undefined);

      await expect(jsPackageManager.installDependencies()).resolves.toBeUndefined();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('instance directory', () => {
    const fixtureRoot = resolve(__dirname, 'fixtures', 'monorepo-subpackage');
    const subpackageDir = resolve(fixtureRoot, 'storybook');

    beforeEach(() => {
      // Clear the cached repository root so the fixture override takes effect.
      invalidateProjectRootCache();
      vi.stubEnv('STORYBOOK_PROJECT_ROOT', fixtureRoot);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it.each([
      { configDir: '.', instanceDir: subpackageDir },
      { configDir: './', instanceDir: subpackageDir },
      { configDir: '.storybook', instanceDir: subpackageDir },
      { configDir: 'config/.storybook', instanceDir: resolve(subpackageDir, 'config') },
    ])('resolves the instance directory for "$configDir"', ({ configDir, instanceDir }) => {
      // @ts-expect-error Ignore abstract class error
      const packageManager = new JsPackageManager({ cwd: subpackageDir, configDir });

      expect(packageManager.instanceDir).toBe(instanceDir);
    });

    it('uses the parent directory for absolute config dirs', () => {
      // @ts-expect-error Ignore abstract class error
      const packageManager = new JsPackageManager({
        cwd: subpackageDir,
        configDir: resolve(fixtureRoot, '.storybook'),
      });

      expect(packageManager.instanceDir).toBe(fixtureRoot);
    });

    it('uses the subpackage package.json when configDir is "."', () => {
      // @ts-expect-error Ignore abstract class error
      const packageManager = new JsPackageManager({ cwd: subpackageDir, configDir: '.' });

      expect(packageManager.primaryPackageJson.packageJson.name).toBe(
        'monorepo-subpackage-storybook'
      );
    });
  });
});
