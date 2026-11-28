import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'pathe';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, prompt } from 'storybook/internal/node-logger';
import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import * as find from 'empathic/find';
import { fs as memfs, vol } from 'memfs';

import { executeCommand, executeCommandSync } from '../utils/command.ts';
import { getProjectRoot } from '../utils/paths.ts';
import { JsPackageManager } from './JsPackageManager.ts';
import { PNPMProxy } from './PNPMProxy.ts';
import { STORYBOOK_PACKAGE_PATTERNS } from './util.ts';

vi.mock('storybook/internal/node-logger', () => ({
  prompt: {
    executeTask: vi.fn(),
    executeTaskWithSpinner: vi.fn(),
    getPreferredStdio: vi.fn(() => 'inherit'),
    select: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock(import('../utils/command.ts'), { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('empathic/find', { spy: true });
vi.mock('../utils/paths.ts', { spy: true });
const mockedExecuteCommand = vi.mocked(executeCommand);
const mockedExecuteCommandSync = vi.mocked(executeCommandSync);

const mockPnpmVersion = (version: string) => {
  mockedExecuteCommandSync.mockImplementation((options) => {
    if (options.command === 'pnpm' && options.args?.[0] === '--version') {
      return version;
    }
    return '';
  });
};
const expectedMinimumReleaseAgeExcludePackages = [
  'react',
  'webpack',
  ...STORYBOOK_PACKAGE_PATTERNS,
];

describe('PNPM Proxy', () => {
  let pnpmProxy: PNPMProxy;

  const PROJECT_DIR = '/project';
  const WORKSPACE_YAML = `${PROJECT_DIR}/pnpm-workspace.yaml`;
  const workspaceYaml = () => vol.toJSON()[WORKSPACE_YAML];

  const useMemfsProject = (
    proxy: PNPMProxy,
    packageJson: Record<string, unknown> = {},
    projectRoot = PROJECT_DIR
  ) => {
    vi.mocked(getProjectRoot).mockReturnValue(projectRoot);
    vi.mocked(find.up).mockImplementation((name, options) => {
      for (let dir = options?.cwd ?? projectRoot; ; dir = dirname(dir)) {
        const file = join(dir, name);
        if (vol.existsSync(file)) {
          return file;
        }
        if (dir === options?.last || dir === dirname(dir)) {
          return undefined;
        }
      }
    });
    vi.spyOn(proxy, 'primaryPackageJson', 'get').mockReturnValue({
      operationDir: projectRoot,
      packageJson: { dependencies: {}, devDependencies: {}, peerDependencies: {}, ...packageJson },
    } as any);
  };

  beforeEach(() => {
    vi.mocked(readFileSync).mockReset();
    vi.mocked(writeFileSync).mockReset();
    mockPnpmVersion('11.18.0');
    pnpmProxy = new PNPMProxy();
    vol.reset();
    vol.mkdirSync(PROJECT_DIR, { recursive: true });
    vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
    vi.mocked(writeFileSync).mockImplementation(memfs.writeFileSync as typeof writeFileSync);
    useMemfsProject(pnpmProxy);
    JsPackageManager.clearLatestVersionCache();
    vi.spyOn(pnpmProxy, 'writePackageJson').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('type should be pnpm', () => {
    expect(pnpmProxy.type).toEqual('pnpm');
  });

  describe('installed packages in a workspace whose root declares storybook', () => {
    const CHILD_DIR = `${PROJECT_DIR}/packages/child`;

    beforeEach(() => {
      JsPackageManager.installedVersionCache.clear();
      vol.fromJSON({
        [`${PROJECT_DIR}/node_modules/vitest/package.json`]: JSON.stringify({
          name: '@voidzero-dev/vite-plus-test',
          version: '0.1.16',
          bundledVersions: { vitest: '4.1.2' },
        }),
        [`${CHILD_DIR}/node_modules/vitest/package.json`]: JSON.stringify({
          name: 'vitest',
          version: '5.0.5',
        }),
      });
      // `empathic/find` reads the real file system, so this walks the memfs tree the same way.
      vi.mocked(find.up).mockImplementation((name, { cwd = PROJECT_DIR, last } = {}) => {
        for (let dir = cwd; ; dir = dirname(dir)) {
          const candidate = join(dir, name);
          if (vol.existsSync(candidate)) {
            return candidate;
          }
          if (dir === last || dir === dirname(dir)) {
            return undefined;
          }
        }
      });
    });

    it('reads a package from the given directory before its parents', async () => {
      await expect(pnpmProxy.getModulePackageJSON('vitest', CHILD_DIR)).resolves.toMatchObject({
        name: 'vitest',
        version: '5.0.5',
      });
    });

    it('reads a package from the directory that declares storybook by default', async () => {
      await expect(pnpmProxy.getModulePackageJSON('vitest')).resolves.toMatchObject({
        name: '@voidzero-dev/vite-plus-test',
        version: '0.1.16',
      });
    });

    it('reports the version installed in the Storybook project over a root alias', async () => {
      const childProxy = new PNPMProxy({ configDir: `${CHILD_DIR}/.storybook` });
      vi.spyOn(childProxy, 'primaryPackageJson', 'get').mockReturnValue({
        operationDir: PROJECT_DIR,
        packageJson: { dependencies: {}, devDependencies: { storybook: '11.0.0' } },
      } as any);
      childProxy.findInstallations = vi.fn().mockResolvedValue({
        dependencies: { vitest: [{ version: '5.0.5', location: '' }] },
        duplicatedDependencies: {},
        infoCommand: '',
        dedupeCommand: '',
      });

      await expect(childProxy.getInstalledVersion('vitest')).resolves.toBe('5.0.5');
    });
  });

  describe('getRegistryURL', () => {
    it('should return the configured registry URL', async () => {
      const cwd = resolve('fixtures', 'pnpm-project');
      pnpmProxy = new PNPMProxy({ cwd });
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValueOnce({
        stdout: 'https://registry.npmjs.org/\n',
      } as Awaited<ReturnType<typeof executeCommand>>);

      await expect(pnpmProxy.getRegistryURL()).resolves.toBe('https://registry.npmjs.org/');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          cwd,
          args: ['config', 'get', 'registry', '--location=project'],
        })
      );
    });

    it('should return undefined when pnpm reports no registry', async () => {
      mockedExecuteCommand.mockResolvedValueOnce({
        stdout: 'undefined\n',
      } as Awaited<ReturnType<typeof executeCommand>>);

      await expect(pnpmProxy.getRegistryURL()).resolves.toBeUndefined();
    });
  });

  describe('installDependencies', () => {
    it('gives pnpm control of the terminal when a purge confirmation can be shown', async () => {
      vi.stubGlobal('process', {
        ...process,
        stdin: { ...process.stdin, isTTY: true },
      });
      vi.mocked(prompt.executeTask).mockImplementationOnce(async (fn) => {
        if (Array.isArray(fn)) {
          await Promise.all(fn.map((factory) => factory()));
        } else {
          await fn();
        }
      });
      mockedExecuteCommand.mockResolvedValueOnce({
        stdout: '',
      } as Awaited<ReturnType<typeof executeCommand>>);

      await pnpmProxy.installDependencies();

      expect(prompt.executeTask).toHaveBeenCalledOnce();
      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['install', '--no-frozen-lockfile'],
          stdio: 'inherit',
        })
      );
    });

    it.each([
      ['set', 'true'],
      ['unset', undefined],
    ])(
      'runs `pnpm install --no-frozen-lockfile` when CI is %s, so the lockfile can change',
      async (_, ci) => {
        vi.stubEnv('CI', ci);
        // sort of un-mock part of the function so executeCommand (also mocked) is called
        vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
          await Promise.resolve(fn());
        });
        const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
          stdout: '7.1.0',
        } as any);

        await pnpmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'pnpm', args: ['install', '--no-frozen-lockfile'] })
        );
      }
    );

    it('installs every workspace project from the workspace root', async () => {
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      vi.spyOn(pnpmProxy, 'detectWorkspaceRoot').mockReturnValue(true);
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '12.4.2' } as any);

      await pnpmProxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['install', '--no-frozen-lockfile'] })
      );
    });

    it('should rethrow minimum-release-age install errors as handled errors', async () => {
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      const originalError = new Error(
        'ERR_PNPM_NO_MATURE_MATCHING_VERSION Version 10.4.0-alpha.17 (released 1 minute ago) of storybook does not meet the minimumReleaseAge constraint'
      );
      mockedExecuteCommand.mockRejectedValueOnce(originalError);

      const error = await pnpmProxy.installDependencies().then(
        () => null,
        (caughtError) => caughtError
      );

      expect(error).toBeInstanceOf(MinimumReleaseAgeHandledError);
      expect(error).toMatchObject({ cause: originalError });
      expect(error?.message).toContain('minimumReleaseAge');
      expect(error?.message).toContain('minimumReleaseAgeExclude');
    });
  });

  describe('allowBuilds for Storybook build scripts', () => {
    const unmockSpinner = () => {
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
    };
    const install = async () => {
      unmockSpinner();
      mockedExecuteCommand.mockResolvedValue({ stdout: '' } as any);
      await pnpmProxy.installDependencies();
    };

    it('creates pnpm-workspace.yaml next to package.json, allowing esbuild, before `pnpm install`', async () => {
      await install();

      expect(workspaceYaml()).toBe('allowBuilds:\n  esbuild: true\n');
      expect(logger.info).toHaveBeenCalledWith(
        'Approved build scripts for esbuild in /project/pnpm-workspace.yaml'
      );
      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['install', '--no-frozen-lockfile'] })
      );
    });

    it('also allows esbuild before `pnpm add`', async () => {
      mockedExecuteCommand.mockResolvedValue({ stdout: '' } as any);

      await pnpmProxy.addDependencies({ type: 'devDependencies' }, ['storybook']);

      expect(workspaceYaml()).toBe('allowBuilds:\n  esbuild: true\n');
    });

    it('adds esbuild to an existing pnpm-workspace.yaml without disturbing its content', async () => {
      vol.fromJSON({
        [WORKSPACE_YAML]:
          '# my workspace\npackages:\n  - "packages/*"\n\ncatalog:\n  react: ^19 # pinned\n',
      });

      await install();

      expect(workspaceYaml()).toBe(
        '# my workspace\npackages:\n  - "packages/*"\n\ncatalog:\n  react: ^19 # pinned\nallowBuilds:\n  esbuild: true\n'
      );
    });

    it('allows esbuild at the workspace root when the Storybook project root is a workspace package', async () => {
      const packageJsonPath = `${PROJECT_DIR}/packages/app/package.json`;
      vol.fromJSON({
        [WORKSPACE_YAML]: 'packages:\n  - "packages/*"\n',
        [packageJsonPath]: '{}',
      });
      useMemfsProject(pnpmProxy, {}, dirname(packageJsonPath));

      await install();

      expect(vol.toJSON()).toEqual({
        [WORKSPACE_YAML]: 'packages:\n  - "packages/*"\nallowBuilds:\n  esbuild: true\n',
        [packageJsonPath]: '{}',
      });
    });

    it('leaves a decision the user already recorded alone', async () => {
      vol.fromJSON({ [WORKSPACE_YAML]: 'allowBuilds:\n  esbuild: false\n' });

      await install();

      expect(workspaceYaml()).toBe('allowBuilds:\n  esbuild: false\n');
      expect(writeFileSync).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('resolves the placeholder pnpm 12 writes for unreviewed packages', async () => {
      vol.fromJSON({ [WORKSPACE_YAML]: 'allowBuilds:\n  esbuild: set this to true or false\n' });

      await install();

      expect(workspaceYaml()).toBe('allowBuilds:\n  esbuild: true\n');
    });

    it.each([
      ['a version-pinned allowBuilds matcher', 'allowBuilds:\n  esbuild@0.25.0 || 0.25.1: false\n'],
      [
        'a git-pinned allowBuilds matcher',
        "allowBuilds:\n  'esbuild@git+ssh://git@example.com/esbuild.git': true\n",
      ],
      ['dangerouslyAllowAllBuilds', 'dangerouslyAllowAllBuilds: true\n'],
    ])('does not add a bare esbuild key when %s already covers it', async (_, yaml) => {
      vol.fromJSON({ [WORKSPACE_YAML]: yaml });

      await install();

      expect(workspaceYaml()).toBe(yaml);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('still adds esbuild when the existing allowBuilds decisions concern other packages', async () => {
      vol.fromJSON({
        [WORKSPACE_YAML]: 'allowBuilds:\n  sharp: true\n  esbuild-wasm@1.0.0: true\n',
      });

      await install();

      expect(workspaceYaml()).toBe(
        'allowBuilds:\n  sharp: true\n  esbuild-wasm@1.0.0: true\n  esbuild: true\n'
      );
    });

    it.each([
      ['onlyBuiltDependencies names esbuild', 'onlyBuiltDependencies:\n  - esbuild\n'],
      ['ignoredBuiltDependencies names esbuild', 'ignoredBuiltDependencies:\n  - esbuild\n'],
      ['neverBuiltDependencies names esbuild', 'neverBuiltDependencies:\n  - esbuild\n'],
      ['neverBuiltDependencies lists other packages', 'neverBuiltDependencies:\n  - fsevents\n'],
    ])('still allows esbuild on pnpm 11 when a leftover pnpm 10 %s', async (_, yaml) => {
      vol.fromJSON({ [WORKSPACE_YAML]: yaml });

      await install();

      expect(workspaceYaml()).toBe(`${yaml}allowBuilds:\n  esbuild: true\n`);
    });

    it('still allows esbuild on pnpm 11 when a leftover onlyBuiltDependenciesFile names it', async () => {
      vol.fromJSON({
        [WORKSPACE_YAML]: 'onlyBuiltDependenciesFile: trusted/allow.json\n',
        [`${PROJECT_DIR}/trusted/allow.json`]: '["esbuild"]',
      });

      await install();

      expect(workspaceYaml()).toBe(
        'onlyBuiltDependenciesFile: trusted/allow.json\nallowBuilds:\n  esbuild: true\n'
      );
    });

    it('still allows esbuild on pnpm 11 when only the ignored `pnpm` field of package.json names it', async () => {
      useMemfsProject(pnpmProxy, { pnpm: { allowBuilds: { esbuild: false } } });

      await install();

      expect(workspaceYaml()).toBe('allowBuilds:\n  esbuild: true\n');
    });

    describe('on pnpm 10', () => {
      beforeEach(() => {
        mockPnpmVersion('10.28.0');
        pnpmProxy = new PNPMProxy();
        useMemfsProject(pnpmProxy);
      });

      it.each([
        ['onlyBuiltDependencies', 'onlyBuiltDependencies:\n  - esbuild\n'],
        [
          'a version-pinned onlyBuiltDependencies entry',
          'onlyBuiltDependencies:\n  - esbuild@0.28.2\n',
        ],
        ['ignoredBuiltDependencies', 'ignoredBuiltDependencies:\n  - esbuild\n'],
        ['neverBuiltDependencies', 'neverBuiltDependencies:\n  - esbuild\n'],
      ])('does not add a bare esbuild key when %s already covers it', async (_, yaml) => {
        vol.fromJSON({ [WORKSPACE_YAML]: yaml });

        await install();

        expect(workspaceYaml()).toBe(yaml);
        expect(writeFileSync).not.toHaveBeenCalled();
      });

      it('honors a decision recorded in the `pnpm` field of package.json', async () => {
        useMemfsProject(pnpmProxy, { pnpm: { ignoredBuiltDependencies: ['esbuild'] } });

        await install();

        expect(workspaceYaml()).toBeUndefined();
        expect(writeFileSync).not.toHaveBeenCalled();
      });

      it('honors a trusted-dependencies file named by onlyBuiltDependenciesFile', async () => {
        vol.fromJSON({
          [WORKSPACE_YAML]: 'onlyBuiltDependenciesFile: trusted/allow.json\n',
          [`${PROJECT_DIR}/trusted/allow.json`]: '["@swc/core", "esbuild"]',
        });

        await install();

        expect(workspaceYaml()).toBe('onlyBuiltDependenciesFile: trusted/allow.json\n');
        expect(writeFileSync).not.toHaveBeenCalled();
      });

      it.each([
        ['neverBuiltDependencies lists another package', 'neverBuiltDependencies:\n  - fsevents\n'],
        ['neverBuiltDependencies is an empty list', 'neverBuiltDependencies: []\n'],
      ])('does not write allowBuilds when %s', async (_, yaml) => {
        vol.fromJSON({ [WORKSPACE_YAML]: yaml });

        await install();

        expect(workspaceYaml()).toBe(yaml);
        expect(writeFileSync).not.toHaveBeenCalled();
      });

      it('does not write allowBuilds when package.json neverBuiltDependencies lists other packages', async () => {
        useMemfsProject(pnpmProxy, { pnpm: { neverBuiltDependencies: ['fsevents'] } });

        await install();

        expect(workspaceYaml()).toBeUndefined();
        expect(writeFileSync).not.toHaveBeenCalled();
      });

      it('preserves an explicit esbuild denial', async () => {
        vol.fromJSON({ [WORKSPACE_YAML]: 'allowBuilds:\n  esbuild: false\n' });

        await install();

        expect(workspaceYaml()).toBe('allowBuilds:\n  esbuild: false\n');
        expect(writeFileSync).not.toHaveBeenCalled();
      });

      it('preserves a version-pinned esbuild approval', async () => {
        vol.fromJSON({ [WORKSPACE_YAML]: 'allowBuilds:\n  esbuild@0.25.0: true\n' });

        await install();

        expect(workspaceYaml()).toBe('allowBuilds:\n  esbuild@0.25.0: true\n');
        expect(writeFileSync).not.toHaveBeenCalled();
      });

      it('still allows esbuild when onlyBuiltDependencies lists other packages', async () => {
        vol.fromJSON({ [WORKSPACE_YAML]: 'onlyBuiltDependencies:\n  - fsevents\n' });

        await install();

        expect(workspaceYaml()).toBe(
          'onlyBuiltDependencies:\n  - fsevents\nallowBuilds:\n  esbuild: true\n'
        );
      });
    });

    it('still runs the install, with a warning, when pnpm-workspace.yaml is malformed', async () => {
      vol.fromJSON({ [WORKSPACE_YAML]: 'packages: [\n' });

      await install();

      expect(workspaceYaml()).toBe('packages: [\n');
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('Could not allow build scripts of esbuild')
      );
      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['install', '--no-frozen-lockfile'] })
      );
    });

    it.each([
      ['pnpm 9, which runs build scripts without approval', '9.15.9'],
      ['pnpm < 10.26, which has no allowBuilds setting', '10.25.0'],
    ])('neither reads nor writes the workspace file on %s', async (_, version) => {
      mockPnpmVersion(version);
      pnpmProxy = new PNPMProxy();
      useMemfsProject(pnpmProxy);
      vol.fromJSON({ [WORKSPACE_YAML]: 'packages:\n  - "packages/*"\n' });

      await install();

      expect(readFileSync).not.toHaveBeenCalledWith(WORKSPACE_YAML, expect.anything());
      expect(writeFileSync).not.toHaveBeenCalled();
      expect(workspaceYaml()).toBe('packages:\n  - "packages/*"\n');
    });
  });

  describe('runScript', () => {
    it('should execute script `pnpm exec compodoc -- -e json -d .`', () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '7.1.0' } as any);

      pnpmProxy.runPackageCommand({ args: ['compodoc', '-e', 'json', '-d', '.'] });

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['exec', 'compodoc', '-e', 'json', '-d', '.'],
        })
      );
    });

    describe('useRemotePkg (dlx)', () => {
      describe('on pnpm >= 10.2', () => {
        beforeEach(() => {
          mockPnpmVersion('10.2.0');
          pnpmProxy = new PNPMProxy();
        });

        it('should pass --allow-build=esbuild before dlx', () => {
          const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '' } as any);

          pnpmProxy.runPackageCommand({
            args: ['create-storybook@10.5.5', '-y'],
            useRemotePkg: true,
          });

          expect(executeCommandSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              command: 'pnpm',
              args: ['--allow-build=esbuild', 'dlx', 'create-storybook@10.5.5', '-y'],
            })
          );
        });

        it('should print --allow-build=esbuild before dlx', () => {
          expect(pnpmProxy.getRemoteRunCommand(['create-storybook@10.5.5', '-y'])).toBe(
            'pnpm --allow-build=esbuild dlx create-storybook@10.5.5 -y'
          );
        });
      });

      describe('on pnpm < 10.2', () => {
        beforeEach(() => {
          mockPnpmVersion('9.15.9');
          pnpmProxy = new PNPMProxy();
        });

        it('should not pass --allow-build on dlx', () => {
          const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '' } as any);

          pnpmProxy.runPackageCommand({
            args: ['create-storybook@10.5.5', '-y'],
            useRemotePkg: true,
          });

          expect(executeCommandSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              command: 'pnpm',
              args: ['dlx', 'create-storybook@10.5.5', '-y'],
            })
          );
        });

        it('should not print --allow-build on dlx', () => {
          expect(pnpmProxy.getRemoteRunCommand(['create-storybook@10.5.5', '-y'])).toBe(
            'pnpm dlx create-storybook@10.5.5 -y'
          );
        });
      });
    });
  });

  describe('addDependencies', () => {
    it('with devDep it should run `pnpm add -D storybook`', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '6.0.0' } as any);

      await pnpmProxy.addDependencies({ type: 'devDependencies' }, ['storybook']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['add', '-D', 'storybook'],
        })
      );
    });

    it('adds to the root project from the workspace root', async () => {
      vi.spyOn(pnpmProxy, 'detectWorkspaceRoot').mockReturnValue(true);
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '9.15.9' } as any);

      await pnpmProxy.addDependencies({ type: 'devDependencies' }, ['storybook']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['add', '-D', 'storybook', '-w'],
        })
      );
    });
  });

  describe('removeDependencies', () => {
    it('should only change package.json without running install', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '7.0.0' } as any);
      const writePackageSpy = vi.spyOn(pnpmProxy, 'writePackageJson').mockImplementation(vi.fn());

      vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation((args) => {
        return {
          dependencies: {},
          devDependencies: {
            '@storybook/manager-webpack5': 'x.x.x',
            '@storybook/react': 'x.x.x',
          },
        };
      });

      await pnpmProxy.removeDependencies(['@storybook/manager-webpack5']);

      expect(writePackageSpy).toHaveBeenCalledWith(
        {
          dependencies: {},
          devDependencies: {
            '@storybook/react': 'x.x.x',
          },
        },
        expect.any(String)
      );
      expect(executeCommandSpy).not.toHaveBeenCalled();
    });
  });

  describe('getReleaseAgeGate', () => {
    let config: Record<string, string>;

    beforeEach(() => {
      config = {
        minimumReleaseAge: 'undefined',
        minimumReleaseAgeExclude: 'undefined',
        minimumReleaseAgeStrict: 'undefined',
      };
      mockedExecuteCommand.mockImplementation(
        ({ args }) => Promise.resolve({ stdout: `${config[String(args?.[2])]}\n` }) as any
      );
    });

    describe('when minimumReleaseAge is set', () => {
      beforeEach(() => {
        config.minimumReleaseAge = '60';
        config.minimumReleaseAgeExclude = JSON.stringify([
          '@storybook/addon-*',
          '@storybook/react@11.0.0-beta.4 || 11.0.0-rc.0',
        ]);
      });

      it('returns a strict gate in minutes', async () => {
        const gate = await pnpmProxy.getReleaseAgeGate();

        expect(gate?.strict).toBe(true);
        expect(gate?.getMinutes('@storybook/react')).toBe(60);
      });

      it('excludes names, globs and exact versions like pnpm', async () => {
        const gate = await pnpmProxy.getReleaseAgeGate();

        expect(gate?.isExcluded('@storybook/addon-ondevice-actions', '11.0.0-next.2')).toBe(true);
        expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(true);
        expect(gate?.isExcluded('@storybook/react', '11.0.0-beta.5')).toBe(false);
        expect(gate?.isExcluded('@storybook/react-native', '11.0.0-next.2')).toBe(false);
      });
    });

    describe('when minimumReleaseAgeStrict is false', () => {
      beforeEach(() => {
        config.minimumReleaseAge = '60';
        config.minimumReleaseAgeStrict = 'false';
      });

      it('returns a gate that falls back instead of blocking', async () => {
        await expect(pnpmProxy.getReleaseAgeGate()).resolves.toMatchObject({ strict: false });
      });

      describe('on pnpm 10', () => {
        beforeEach(() => {
          mockPnpmVersion('10.34.9');
          pnpmProxy = new PNPMProxy();
        });

        it('returns a strict gate, since pnpm 10 ignores the setting', async () => {
          await expect(pnpmProxy.getReleaseAgeGate()).resolves.toMatchObject({ strict: true });
        });
      });
    });

    describe('when several exclusions name the same package', () => {
      beforeEach(() => {
        config.minimumReleaseAge = '60';
        config.minimumReleaseAgeExclude = JSON.stringify([
          '@storybook/react@11.0.0-beta.3',
          '@storybook/react',
        ]);
      });

      it('combines them like pnpm 11', async () => {
        const gate = await pnpmProxy.getReleaseAgeGate();

        expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(true);
      });

      describe('on pnpm 10', () => {
        beforeEach(() => {
          mockPnpmVersion('10.34.9');
          pnpmProxy = new PNPMProxy();
        });

        it('uses only the first one like pnpm 10', async () => {
          const gate = await pnpmProxy.getReleaseAgeGate();

          expect(gate?.isExcluded('@storybook/react', '11.0.0-beta.3')).toBe(true);
          expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(false);
        });
      });
    });

    describe('when an exclusion contains a question mark', () => {
      beforeEach(() => {
        config.minimumReleaseAge = '60';
        config.minimumReleaseAgeExclude = JSON.stringify(['@storybook/reac?']);
      });

      it('reads it as a wildcard like pnpm 11', async () => {
        const gate = await pnpmProxy.getReleaseAgeGate();

        expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(true);
      });

      describe('on pnpm 10', () => {
        beforeEach(() => {
          mockPnpmVersion('10.34.9');
          pnpmProxy = new PNPMProxy();
        });

        it('reads it literally like pnpm 10', async () => {
          const gate = await pnpmProxy.getReleaseAgeGate();

          expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(false);
          expect(gate?.isExcluded('@storybook/reac?', '11.0.0-rc.0')).toBe(true);
        });
      });
    });

    describe.each([
      { entry: '!@storybook/react-native', kind: 'a negated scoped name' },
      { entry: '@storybook/react@^11.0.0', kind: 'a range' },
    ])('when an exclusion is $kind, which pnpm rejects', ({ entry }) => {
      beforeEach(() => {
        config.minimumReleaseAge = '60';
        config.minimumReleaseAgeExclude = JSON.stringify(['storybook', entry]);
      });

      it('returns null, since the install fails on its own', async () => {
        await expect(pnpmProxy.getReleaseAgeGate()).resolves.toBeNull();
      });
    });

    describe('when an exclusion is negated', () => {
      beforeEach(() => {
        config.minimumReleaseAge = '60';
        config.minimumReleaseAgeExclude = JSON.stringify(['!storybook']);
      });

      it('excludes every other package like pnpm', async () => {
        const gate = await pnpmProxy.getReleaseAgeGate();

        expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(true);
        expect(gate?.isExcluded('storybook', '11.0.0-rc.0')).toBe(false);
      });
    });

    describe('when minimumReleaseAge is set to 0', () => {
      beforeEach(() => {
        config.minimumReleaseAge = '0';
      });

      it('returns no gate', async () => {
        const gate = await pnpmProxy.getReleaseAgeGate();

        expect(gate?.getMinutes('@storybook/react')).toBe(0);
      });
    });

    describe('when minimumReleaseAge is not set', () => {
      it('uses the non strict one day default of pnpm 11', async () => {
        const gate = await pnpmProxy.getReleaseAgeGate();

        expect(gate?.getMinutes('@storybook/react')).toBe(24 * 60);
        expect(gate?.strict).toBe(false);
      });

      describe('on pnpm 10', () => {
        beforeEach(() => {
          mockPnpmVersion('10.34.9');
          pnpmProxy = new PNPMProxy();
        });

        it('returns no gate', async () => {
          const gate = await pnpmProxy.getReleaseAgeGate();

          expect(gate?.getMinutes('@storybook/react')).toBe(0);
        });
      });
    });

    describe('when pnpm prints an unreadable exclusion list', () => {
      beforeEach(() => {
        config.minimumReleaseAge = '60';
        config.minimumReleaseAgeExclude = '{not json';
      });

      it('returns null', async () => {
        await expect(pnpmProxy.getReleaseAgeGate()).resolves.toBeNull();
      });
    });
  });

  describe('getPublishedManifest', () => {
    const published = {
      version: '11.0.0-next.2',
      versions: ['11.0.0-next.1', '11.0.0-next.2'],
      time: { '11.0.0-next.2': '2026-11-15T10:00:00.000Z' },
      dependencies: { '@storybook/react': '^11.0.0-beta.3' },
      peerDependencies: { storybook: '^11.0.0-beta.1' },
    };
    const readManifest = () =>
      pnpmProxy.getPublishedManifest('@storybook/react-native', '11.0.0-next.2');

    describe('when the package manager prints the manifest', () => {
      beforeEach(() => {
        mockedExecuteCommand.mockResolvedValue({
          stdout: JSON.stringify({ name: '@storybook/react-native', ...published }),
        } as any);
      });

      it('reads it through the package manager', async () => {
        await expect(readManifest()).resolves.toEqual(published);
        expect(mockedExecuteCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'pnpm',
            args: ['info', '@storybook/react-native@11.0.0-next.2', '--json'],
          })
        );
      });

      it('reads the latest version when no version is given', async () => {
        await expect(pnpmProxy.getPublishedManifest('@storybook/react-native')).resolves.toEqual(
          published
        );
        expect(mockedExecuteCommand).toHaveBeenCalledWith(
          expect.objectContaining({ args: ['info', '@storybook/react-native', '--json'] })
        );
      });
    });

    describe('when pnpm 10 forwards the lookup to npm 12, which wraps it in an array', () => {
      beforeEach(() => {
        mockedExecuteCommand.mockResolvedValue({
          stdout: JSON.stringify([{ name: '@storybook/react-native', ...published }]),
        } as any);
      });

      it('unwraps the manifest', async () => {
        await expect(readManifest()).resolves.toEqual(published);
      });
    });

    describe.each([
      { shape: 'a bare version', stdout: JSON.stringify('11.0.0-next.2') },
      { shape: 'several manifests', stdout: JSON.stringify([published, published]) },
      { shape: 'empty output', stdout: '' },
    ])('when pnpm prints $shape', ({ stdout }) => {
      beforeEach(() => {
        mockedExecuteCommand.mockResolvedValue({ stdout } as any);
      });

      it('returns null', async () => {
        await expect(readManifest()).resolves.toBeNull();
      });
    });

    describe('when the lookup fails', () => {
      beforeEach(() => {
        mockedExecuteCommand.mockRejectedValue(new Error('401 Unauthorized'));
      });

      it('returns null', async () => {
        await expect(readManifest()).resolves.toBeNull();
      });
    });
  });

  describe('latestVersion', () => {
    it('without constraint it returns the latest version', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '5.3.19' } as any);

      const version = await pnpmProxy.latestVersion('storybook');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['info', 'storybook', 'version'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: '["4.25.3","5.3.19","6.0.0-beta.23"]',
      } as any);

      const version = await pnpmProxy.latestVersion('storybook', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['info', 'storybook', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it throws an error if command output is not a valid JSON', async () => {
      mockedExecuteCommand.mockResolvedValue({ stdout: 'NOT A JSON' } as any);

      await expect(pnpmProxy.latestVersion('storybook', '5.X')).resolves.toBe(null);
    });
  });

  describe('getVersion', () => {
    it('with a Storybook package listed in versions.json it returns the version', async () => {
      const storybookAngularVersion = (await import('../versions.ts')).default[
        '@storybook/angular'
      ];
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '5.3.19' } as any);

      const version = await pnpmProxy.getVersion('@storybook/angular');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['info', '@storybook/angular', 'version'],
        })
      );
      expect(version).toEqual(`^${storybookAngularVersion}`);
    });

    it('with a Storybook package not listed in versions.json it returns the latest version', async () => {
      const packageVersion = '5.3.19';
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: `${packageVersion}`,
      } as any);

      const version = await pnpmProxy.getVersion('@storybook/react-native');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['info', '@storybook/react-native', 'version'],
        })
      );
      expect(version).toEqual(`^${packageVersion}`);
    });
  });

  describe('addPackageResolutions', () => {
    it('adds resolutions to package.json and account for existing resolutions', async () => {
      const basePackageAttributes = {
        dependencies: {},
        devDependencies: {},
      };

      const writePackageSpy = vi.spyOn(pnpmProxy, 'writePackageJson').mockImplementation(vi.fn());

      vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation(() => ({
        dependencies: {},
        devDependencies: {},
        overrides: {
          bar: 'x.x.x',
        },
      }));

      const versions = {
        foo: 'x.x.x',
      };
      pnpmProxy.addPackageResolutions(versions);

      expect(writePackageSpy).toHaveBeenCalledWith(
        {
          ...basePackageAttributes,
          overrides: {
            ...versions,
            bar: 'x.x.x',
          },
        },
        expect.any(String)
      );
    });
  });

  describe('mapDependencies', () => {
    it('should display duplicated dependencies based on pnpm output', async () => {
      // pnpm list "@storybook/*" "storybook" --depth 10 --json
      mockedExecuteCommand.mockResolvedValue({
        stdout: `
        [
          {
            "peerDependencies": {
              "unrelated-and-should-be-filtered": {
                "version": "1.0.0",
                "from": "",
                "resolved": ""
              }
            },
            "dependencies": {
              "@storybook/addon-example": {
                "from": "@storybook/addon-example",
                "version": "7.0.0-beta.13",
                "resolved": "https://registry.npmjs.org/@storybook/addon-example/-/addon-example-7.0.0-beta.13.tgz",
                "dependencies": {
                  "@storybook/package": {
                    "from": "@storybook/package",
                    "version": "7.0.0-beta.13",
                    "resolved": "https://registry.npmjs.org/@storybook/package/-/package-7.0.0-beta.13.tgz"
                  }
                }
              }
            },
            "devDependencies": {
              "@storybook/jest": {
                "from": "@storybook/jest",
                "version": "0.0.11-next.0",
                "resolved": "https://registry.npmjs.org/@storybook/jest/-/jest-0.0.11-next.0.tgz",
                "dependencies": {
                  "@storybook/package": {
                    "from": "@storybook/package",
                    "version": "7.0.0-rc.7",
                    "resolved": "https://registry.npmjs.org/@storybook/package/-/package-7.0.0-rc.7.tgz"
                  }
                }
              },
              "@storybook/testing-library": {
                "from": "@storybook/testing-library",
                "version": "0.0.14-next.1",
                "resolved": "https://registry.npmjs.org/@storybook/testing-library/-/testing-library-0.0.14-next.1.tgz",
                "dependencies": {
                  "@storybook/package": {
                    "from": "@storybook/package",
                    "version": "7.0.0-rc.7",
                    "resolved": "https://registry.npmjs.org/@storybook/package/-/package-7.0.0-rc.7.tgz"
                  }
                }
              },
              "@storybook/nextjs": {
                "from": "@storybook/nextjs",
                "version": "7.0.0-beta.13",
                "resolved": "https://registry.npmjs.org/@storybook/nextjs/-/nextjs-7.0.0-beta.13.tgz",
                "dependencies": {
                  "@storybook/builder-webpack5": {
                    "from": "@storybook/builder-webpack5",
                    "version": "7.0.0-beta.13",
                    "resolved": "https://registry.npmjs.org/@storybook/builder-webpack5/-/builder-webpack5-7.0.0-beta.13.tgz",
                    "dependencies": {
                      "@storybook/addons": {
                        "from": "@storybook/addons",
                        "version": "7.0.0-beta.13",
                        "resolved": "https://registry.npmjs.org/@storybook/addons/-/addons-7.0.0-beta.13.tgz"
                      }
                    }
                  }
                }
              }
            }
          }
        ]      
      `,
      } as any);

      const installations = await pnpmProxy.findInstallations(['@storybook/*']);

      expect(installations).toMatchInlineSnapshot(`
        {
          "dedupeCommand": "pnpm dedupe",
          "dependencies": {
            "@storybook/addon-example": [
              {
                "location": "",
                "version": "7.0.0-beta.13",
              },
            ],
            "@storybook/addons": [
              {
                "location": "",
                "version": "7.0.0-beta.13",
              },
            ],
            "@storybook/builder-webpack5": [
              {
                "location": "",
                "version": "7.0.0-beta.13",
              },
            ],
            "@storybook/jest": [
              {
                "location": "",
                "version": "0.0.11-next.0",
              },
            ],
            "@storybook/nextjs": [
              {
                "location": "",
                "version": "7.0.0-beta.13",
              },
            ],
            "@storybook/package": [
              {
                "location": "",
                "version": "7.0.0-rc.7",
              },
              {
                "location": "",
                "version": "7.0.0-beta.13",
              },
            ],
            "@storybook/testing-library": [
              {
                "location": "",
                "version": "0.0.14-next.1",
              },
            ],
          },
          "duplicatedDependencies": {
            "@storybook/package": [
              "7.0.0-rc.7",
              "7.0.0-beta.13",
            ],
          },
          "infoCommand": "pnpm list --depth=1",
        }
      `);
    });

    it('finds a package that only another package depends on', async () => {
      mockedExecuteCommand.mockResolvedValue({
        stdout: JSON.stringify([
          {
            devDependencies: {
              'qa-wrapper': {
                version: '1.0.0',
                dependencies: { '@storybook/test-runner': { version: '0.24.0' } },
              },
            },
          },
        ]),
      } as any);

      const installations = await pnpmProxy.findInstallations(['@storybook/test-runner']);

      expect(installations?.dependencies).toEqual({
        '@storybook/test-runner': [{ version: '0.24.0', location: '' }],
      });
    });

    it('reports a workspace package next to the registry copy a dependency brings in', async () => {
      mockedExecuteCommand.mockResolvedValue({
        stdout: JSON.stringify([
          {
            devDependencies: {
              'has-flag': { version: 'link:packages/has-flag' },
              'supports-color': {
                version: '7.2.0',
                dependencies: { 'has-flag': { version: '4.0.0' } },
              },
            },
          },
        ]),
      } as any);

      const installations = await pnpmProxy.findInstallations(['has-flag']);

      expect(installations?.duplicatedDependencies).toEqual({
        'has-flag': ['link:packages/has-flag', '4.0.0'],
      });
    });

    it('lists the version the project depends on before the versions its dependencies bring in', async () => {
      mockedExecuteCommand.mockResolvedValue({
        stdout: JSON.stringify([
          {
            devDependencies: {
              chalk: {
                version: '4.1.2',
                dependencies: { 'supports-color': { version: '7.2.0' } },
              },
              'supports-color': { version: '9.4.0' },
            },
          },
        ]),
      } as any);

      const installations = await pnpmProxy.findInstallations(['supports-color']);

      expect(installations?.dependencies).toEqual({
        'supports-color': [
          { version: '9.4.0', location: '' },
          { version: '7.2.0', location: '' },
        ],
      });
    });
  });

  describe('precheckStorybookPackageInstall', () => {
    const packageTimeMap = {
      created: '2025-01-01T00:00:00.000Z',
      modified: '2026-05-11T12:00:00.000Z',
      '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
      '10.3.2': '2026-05-01T00:00:00.000Z',
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-11T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update minimumReleaseAgeExclude in non-interactive mode when minimumReleaseAge blocks Storybook', async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(['react', 'webpack']) } as any)
        .mockResolvedValueOnce({ stdout: 'undefined\n' } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(packageTimeMap) } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(packageTimeMap) } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(['react', 'webpack']) } as any)
        .mockResolvedValueOnce({ stdout: '' } as any);
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (factory: any) => {
        await factory();
      });

      await pnpmProxy.precheckStorybookPackageInstall({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: true,
        installContext: 'create',
      });

      expect(mockedExecuteCommand).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: [
            'config',
            'set',
            '--location=project',
            '--json',
            'minimumReleaseAgeExclude',
            JSON.stringify(expectedMinimumReleaseAgeExcludePackages),
          ],
        })
      );
    });

    it('should let the user update minimumReleaseAgeExclude interactively', async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(['react', '@storybook/preset-react-webpack']),
        } as any)
        .mockResolvedValueOnce({ stdout: 'undefined\n' } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(packageTimeMap) } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(packageTimeMap) } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(['react', 'webpack']) } as any)
        .mockResolvedValueOnce({ stdout: '' } as any);
      vi.mocked(prompt.select).mockResolvedValue('exclude' as never);
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (factory: any) => {
        await factory();
      });

      await pnpmProxy.precheckStorybookPackageInstall({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: false,
        installContext: 'create',
      });

      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining(
          'pnpm minimumReleaseAge will block storybook@10.4.0-alpha.17 from being installed'
        )
      );
      expect(vi.mocked(prompt.select)).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.arrayContaining([
            expect.objectContaining({
              label: 'Update pnpm config to exclude Storybook packages',
            }),
            expect.objectContaining({
              label: 'Stop now and rerun with the most recent allowed release: storybook@10.3.2',
            }),
          ]),
        }),
        expect.objectContaining({
          onCancel: expect.any(Function),
        })
      );
      expect(vi.mocked(logger.info)).not.toHaveBeenCalledWith(
        'Added Storybook core packages to pnpm minimumReleaseAgeExclude for this project.'
      );

      expect(mockedExecuteCommand).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: [
            'config',
            'set',
            '--location=project',
            '--json',
            'minimumReleaseAgeExclude',
            JSON.stringify(expectedMinimumReleaseAgeExcludePackages),
          ],
        })
      );
    });

    it('should tell create-storybook users how to rerun when they choose rerun', async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({ stdout: '[]' } as any)
        .mockResolvedValueOnce({ stdout: 'undefined\n' } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify([packageTimeMap]) } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify([packageTimeMap]) } as any);
      vi.mocked(prompt.select).mockResolvedValue('rerun' as never);

      const rerunPromise = pnpmProxy.precheckStorybookPackageInstall({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: false,
        installContext: 'create',
      });

      await expect(rerunPromise).rejects.toThrow(
        /Please rerun Storybook creation with:[\s\S]*npx create-storybook@10\.3\.2/
      );

      await expect(rerunPromise).rejects.not.toThrow(
        /choose one of these options|Update pnpm to exclude Storybook packages/
      );
    });

    it('should show the same rerun guidance when the prompt is cancelled', async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({ stdout: '[]' } as any)
        .mockResolvedValueOnce({ stdout: 'undefined\n' } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(packageTimeMap) } as any)
        .mockResolvedValueOnce({ stdout: JSON.stringify(packageTimeMap) } as any);
      vi.mocked(prompt.select).mockImplementationOnce(async (_options: any, promptOptions: any) => {
        promptOptions.onCancel();
        return 'exclude';
      });

      await expect(
        pnpmProxy.precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'create',
        })
      ).rejects.toThrow(
        /Please rerun Storybook creation with:[\s\S]*npx create-storybook@10\.3\.2/
      );
    });

    describe('release-time checks', () => {
      beforeEach(() => {
        mockedExecuteCommand
          .mockResolvedValueOnce({ stdout: '1440\n' } as Awaited<ReturnType<typeof executeCommand>>)
          .mockResolvedValueOnce({ stdout: '[]' } as Awaited<ReturnType<typeof executeCommand>>)
          .mockImplementation(
            ({ args = [] }) =>
              Promise.resolve({
                stdout: args.includes('time') ? JSON.stringify(packageTimeMap) : '',
              }) as ReturnType<typeof executeCommand>
          );
        vi.mocked(prompt.select).mockResolvedValue('rerun');
      });

      it('should prompt before installing a release that is too recent', async () => {
        await expect(
          pnpmProxy.precheckStorybookPackageInstall({
            storybookVersion: '10.4.0-alpha.17',
            nonInteractive: false,
            installContext: 'create',
          })
        ).rejects.toThrow(MinimumReleaseAgeHandledError);

        expect(prompt.select).toHaveBeenCalled();
      });

      it.each([
        { version: '10.3.2', condition: 'already satisfies the minimum release age' },
        { version: '10.4.0-alpha.18', condition: 'has no release time' },
      ])(
        'should continue without prompting when the requested version $condition',
        async ({ version }) => {
          await expect(
            pnpmProxy.precheckStorybookPackageInstall({
              storybookVersion: version,
              nonInteractive: false,
              installContext: 'create',
            })
          ).resolves.toBeUndefined();

          expect(prompt.select).not.toHaveBeenCalled();
          expect(logger.warn).not.toHaveBeenCalled();
          expect(prompt.executeTaskWithSpinner).not.toHaveBeenCalled();
        }
      );
    });

    it('should skip the precheck when Storybook packages are already excluded', async () => {
      const updateSpy = vi.spyOn(pnpmProxy as any, 'updateMinimumReleaseAgeExclude');
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({
          stdout: JSON.stringify(STORYBOOK_PACKAGE_PATTERNS),
        } as any)
        .mockResolvedValueOnce({ stdout: 'undefined\n' } as any);

      await expect(
        pnpmProxy.precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'upgrade',
        })
      ).resolves.toBeUndefined();

      expect(vi.mocked(prompt.select)).not.toHaveBeenCalled();
      expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should skip the precheck for the non strict default gate of pnpm 11', async () => {
      mockedExecuteCommand.mockImplementation(
        () => Promise.resolve({ stdout: 'undefined\n' }) as ReturnType<typeof executeCommand>
      );

      await expect(
        pnpmProxy.precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'create',
        })
      ).resolves.toBeUndefined();

      expect(mockedExecuteCommand).not.toHaveBeenCalledWith(
        expect.objectContaining({ args: expect.arrayContaining(['time']) })
      );
      expect(vi.mocked(prompt.select)).not.toHaveBeenCalled();
    });
  });
});
