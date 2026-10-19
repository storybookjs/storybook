import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, prompt } from 'storybook/internal/node-logger';
import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import { fs as memfs, vol } from 'memfs';

import { executeCommand, executeCommandSync } from '../utils/command.ts';
import { JsPackageManager } from './JsPackageManager.ts';
import { PNPMProxy } from './PNPMProxy.ts';

vi.mock('storybook/internal/node-logger', () => ({
  prompt: {
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
  'storybook',
  '@storybook/*',
  'eslint-plugin-storybook',
  '@chromatic-com/storybook',
];

describe('PNPM Proxy', () => {
  let pnpmProxy: PNPMProxy;

  /** The in-memory project the proxy operates on, so `allowBuilds` writes never touch the repo. */
  const PROJECT_DIR = '/project';
  const WORKSPACE_YAML = `${PROJECT_DIR}/pnpm-workspace.yaml`;
  const workspaceYaml = () => vol.toJSON()[WORKSPACE_YAML];

  const useMemfsProject = (proxy: PNPMProxy, packageJson: Record<string, unknown> = {}) => {
    vi.spyOn(proxy as any, 'findWorkspaceYamlPath').mockImplementation(() =>
      vol.existsSync(WORKSPACE_YAML) ? WORKSPACE_YAML : undefined
    );
    vi.spyOn(proxy, 'primaryPackageJson', 'get').mockReturnValue({
      operationDir: PROJECT_DIR,
      packageJson: { dependencies: {}, devDependencies: {}, peerDependencies: {}, ...packageJson },
    } as any);
  };

  beforeEach(() => {
    // Construct against the real fs, then redirect fs to memfs for everything the tests do.
    vi.mocked(readFileSync).mockReset();
    vi.mocked(writeFileSync).mockReset();
    vi.mocked(renameSync).mockReset();
    vi.mocked(unlinkSync).mockReset();
    mockPnpmVersion('11.18.0');
    pnpmProxy = new PNPMProxy();
    vol.reset();
    vol.mkdirSync(PROJECT_DIR, { recursive: true });
    vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
    vi.mocked(writeFileSync).mockImplementation(memfs.writeFileSync as typeof writeFileSync);
    vi.mocked(renameSync).mockImplementation(memfs.renameSync as typeof renameSync);
    vi.mocked(unlinkSync).mockImplementation(memfs.unlinkSync as typeof unlinkSync);
    useMemfsProject(pnpmProxy);
    JsPackageManager.clearLatestVersionCache();
    vi.spyOn(pnpmProxy, 'writePackageJson').mockImplementation(vi.fn());
  });

  it('type should be pnpm', () => {
    expect(pnpmProxy.type).toEqual('pnpm');
  });

  describe('getRegistryURL', () => {
    it('uses npm 12-compatible workspace flags', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValueOnce({
        stdout: 'https://registry.npmjs.org/',
      } as Awaited<ReturnType<typeof executeCommand>>);

      await expect(pnpmProxy.getRegistryURL()).resolves.toBe('https://registry.npmjs.org/');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['config', 'get', 'registry', '--workspaces=false', '--include-workspace-root'],
        })
      );
    });
  });

  describe('installDependencies', () => {
    it('should run `pnpm install`', async () => {
      // sort of un-mock part of the function so executeCommand (also mocked) is called
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '7.1.0' } as any);

      await pnpmProxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['install'] })
      );
    });

    it('installs every workspace project from the workspace root', async () => {
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      vi.spyOn(pnpmProxy, 'detectWorkspaceRoot').mockReturnValue(true);
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '12.4.2' } as any);

      await pnpmProxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['install'] })
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
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/\/project\/pnpm-workspace\.yaml\.[0-9a-f]+\.tmp$/),
        'allowBuilds:\n  esbuild: true\n',
        'utf8'
      );
      expect(renameSync).toHaveBeenCalledWith(
        expect.stringMatching(/\/project\/pnpm-workspace\.yaml\.[0-9a-f]+\.tmp$/),
        WORKSPACE_YAML
      );
      expect(Object.keys(vol.toJSON()).some((filePath) => filePath.endsWith('.tmp'))).toBe(false);
      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['install'] })
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

    it('leaves a decision the user already recorded alone', async () => {
      vol.fromJSON({ [WORKSPACE_YAML]: 'allowBuilds:\n  esbuild: false\n' });

      await install();

      expect(workspaceYaml()).toBe('allowBuilds:\n  esbuild: false\n');
      expect(writeFileSync).not.toHaveBeenCalled();
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
      [
        'a pinned allowBuilds matcher pnpm has not resolved yet',
        'allowBuilds:\n  esbuild@0.28.2: set this to true or false\n',
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

    // pnpm 11 dropped these lists and stopped reading package.json's `pnpm` field, so leftovers
    // there no longer govern builds: esbuild still needs its allowBuilds entry.
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
        expect.objectContaining({ command: 'pnpm', args: ['install'] })
      );
    });

    it('does nothing on pnpm < 10.26, which has no allowBuilds setting', async () => {
      mockPnpmVersion('10.25.0');
      pnpmProxy = new PNPMProxy();
      useMemfsProject(pnpmProxy);

      await install();

      expect(workspaceYaml()).toBeUndefined();
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
          stdout: JSON.stringify([
            'storybook',
            '@storybook/*',
            'eslint-plugin-storybook',
            '@chromatic-com/storybook',
          ]),
        } as any);

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
  });
});
