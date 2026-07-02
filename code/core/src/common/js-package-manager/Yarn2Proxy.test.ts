import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prompt } from 'storybook/internal/node-logger';
import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import { logger } from '../../node-logger/index.ts';
import { executeCommand } from '../utils/command.ts';
import { JsPackageManager } from './JsPackageManager.ts';
import { Yarn2Proxy } from './Yarn2Proxy.ts';

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

vi.mock('../../node-logger/index.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../utils/command', { spy: true });
const mockedExecuteCommand = vi.mocked(executeCommand);

describe('Yarn 2 Proxy', () => {
  let yarn2Proxy: Yarn2Proxy;

  beforeEach(() => {
    yarn2Proxy = new Yarn2Proxy();
    JsPackageManager.clearLatestVersionCache();
    // The repo-level .env marks test runs as sandbox context; these tests
    // assert user-facing registry-probe behavior, so run them without it.
    vi.stubEnv('IN_STORYBOOK_SANDBOX', 'false');
    vi.spyOn(yarn2Proxy, 'writePackageJson').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('type should be yarn2', () => {
    expect(yarn2Proxy.type).toEqual('yarn2');
  });

  describe('installDependencies', () => {
    it('should run `yarn`', async () => {
      // sort of un-mock part of the function so executeCommand (also mocked) is called
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: '',
      } as any);

      await yarn2Proxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'yarn', args: ['install'] })
      );
    });

    it('should rethrow minimum-age-gate install errors as handled errors', async () => {
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      const originalError = new Error(
        '➤ YN0016: │ @storybook/react-vite@npm:10.4.0-alpha.17: All versions satisfying "10.4.0-alpha.17" are quarantined'
      );
      mockedExecuteCommand.mockRejectedValueOnce(originalError);

      const error = await yarn2Proxy.installDependencies().then(
        () => null,
        (caughtError) => caughtError
      );

      expect(error).toBeInstanceOf(MinimumReleaseAgeHandledError);
      expect(error).toMatchObject({ cause: originalError });
      expect(error?.message).toContain('npmMinimalAgeGate');
      expect(error?.message).toContain('npmPreapprovedPackages');
    });
  });

  describe('runScript', () => {
    it('should execute script `yarn compodoc -- -e json -d .`', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: '7.1.0',
      } as any);

      await yarn2Proxy.runPackageCommand({ args: ['compodoc', '-e', 'json', '-d', '.'] });

      expect(executeCommandSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['exec', 'compodoc', '-e', 'json', '-d', '.'],
        })
      );
    });
  });

  describe('addDependencies', () => {
    it('with devDep it should run `yarn install -D storybook`', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: '',
      } as any);

      await yarn2Proxy.addDependencies({ type: 'devDependencies' }, ['storybook']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['add', '-D', 'storybook'],
        })
      );
    });
  });

  describe('removeDependencies', () => {
    it('skipInstall should only change package.json without running install', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: '7.0.0',
      } as any);
      const writePackageSpy = vi.spyOn(yarn2Proxy, 'writePackageJson').mockImplementation(vi.fn());

      vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation(() => {
        return {
          dependencies: {},
          devDependencies: {
            '@storybook/manager-webpack5': 'x.x.x',
            '@storybook/react': 'x.x.x',
          },
        };
      });

      await yarn2Proxy.removeDependencies(['@storybook/manager-webpack5']);

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
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: '{"name":"storybook","version":"5.3.19"}',
      } as any);

      const version = await yarn2Proxy.latestVersion('storybook');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['npm', 'info', 'storybook', '--fields', 'version', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: '{"name":"storybook","versions":["4.25.3","5.3.19","6.0.0-beta.23"]}',
      } as any);

      const version = await yarn2Proxy.latestVersion('storybook', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['npm', 'info', 'storybook', '--fields', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('throws an error if command output is not a valid JSON', async () => {
      mockedExecuteCommand.mockResolvedValue({
        stdout: 'NOT A JSON',
      } as any);

      await expect(yarn2Proxy.latestVersion('storybook')).resolves.toBe(null);
    });
  });

  describe('addPackageResolutions', () => {
    it('adds resolutions to package.json and account for existing resolutions', async () => {
      const writePackageSpy = vi.spyOn(yarn2Proxy, 'writePackageJson').mockImplementation(vi.fn());

      vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation(() => ({
        dependencies: {},
        devDependencies: {},
        resolutions: {
          bar: 'x.x.x',
        },
      }));

      const versions = {
        foo: 'x.x.x',
      };

      yarn2Proxy.addPackageResolutions(versions);

      expect(writePackageSpy).toHaveBeenCalledWith(
        {
          dependencies: {},
          devDependencies: {},
          resolutions: {
            ...versions,
            bar: 'x.x.x',
          },
        },
        expect.any(String)
      );
    });
  });

  describe('mapDependencies', () => {
    it('should display duplicated dependencies based on yarn2 output', async () => {
      // yarn info --name-only --recursive "@storybook/*" "storybook"
      mockedExecuteCommand.mockResolvedValue({
        stdout: `
            "unrelated-and-should-be-filtered@npm:1.0.0"
            "@storybook/package@npm:7.0.0-beta.12"
            "@storybook/package@npm:7.0.0-beta.19"
            "@storybook/testing-library@npm:0.0.14-next.1"
          `,
      } as any);

      const metadata = await yarn2Proxy.findInstallations(['@storybook/*', 'storybook']);

      expect(metadata).toEqual({
        dependencies: {
          '@storybook/package': [
            { location: '', version: '7.0.0-beta.12' },
            { location: '', version: '7.0.0-beta.19' },
          ],
          '@storybook/testing-library': [{ location: '', version: '0.0.14-next.1' }],
        },
        duplicatedDependencies: {
          '@storybook/package': ['7.0.0-beta.12', '7.0.0-beta.19'],
        },
        infoCommand: 'yarn why',
        dedupeCommand: 'yarn dedupe',
      });
    });
  });

  describe('precheckStorybookPackageInstall', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-11T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update npmPreapprovedPackages in non-interactive mode when npmMinimalAgeGate blocks Storybook', async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({ stdout: '[]\n' } as any)
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            name: 'storybook',
            time: {
              created: '2025-01-01T00:00:00.000Z',
              modified: '2026-05-11T12:00:00.000Z',
              '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
              '10.3.2': '2026-05-01T00:00:00.000Z',
            },
          }),
        } as any)
        .mockResolvedValueOnce({ stdout: '[]\n' } as any)
        .mockResolvedValueOnce({ stdout: '' } as any);
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (factory: any) => {
        await factory();
      });

      await yarn2Proxy.precheckStorybookPackageInstall({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: true,
        installContext: 'create',
      });

      expect(mockedExecuteCommand).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: [
            'config',
            'set',
            'npmPreapprovedPackages',
            '--json',
            JSON.stringify([
              'storybook',
              '@storybook/*',
              'eslint-plugin-storybook',
              '@chromatic-com/storybook',
            ]),
          ],
        })
      );
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        expect.stringContaining(
          'Storybook updated npmPreapprovedPackages for this project automatically'
        )
      );
    });

    it('should let the user update npmPreapprovedPackages interactively', async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({
          stdout: "[\n  'foo',\n  '@storybook/preset-react-webpack',\n]\n",
        } as any)
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            name: 'storybook',
            time: {
              created: '2025-01-01T00:00:00.000Z',
              modified: '2026-05-11T12:00:00.000Z',
              '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
              '10.3.2': '2026-05-01T00:00:00.000Z',
            },
          }),
        } as any)
        .mockResolvedValueOnce({
          stdout: "[\n  'foo',\n  '@storybook/preset-react-webpack',\n]\n",
        } as any)
        .mockResolvedValueOnce({ stdout: '' } as any);
      vi.mocked(prompt.select).mockResolvedValue('exclude' as never);
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (factory: any) => {
        await factory();
      });

      await yarn2Proxy.precheckStorybookPackageInstall({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: false,
        installContext: 'create',
      });

      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining(
          'yarn npmMinimalAgeGate will block storybook@10.4.0-alpha.17 from being installed'
        )
      );
      expect(vi.mocked(prompt.select)).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.arrayContaining([
            expect.objectContaining({
              label: 'Update yarn config to preapprove Storybook packages',
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
      expect(mockedExecuteCommand).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: [
            'config',
            'set',
            'npmPreapprovedPackages',
            '--json',
            JSON.stringify([
              'foo',
              '@storybook/preset-react-webpack',
              'storybook',
              '@storybook/*',
              'eslint-plugin-storybook',
              '@chromatic-com/storybook',
            ]),
          ],
        })
      );
    });

    it('should gracefully skip the precheck on older Yarn Berry versions without npmMinimalAgeGate', async () => {
      mockedExecuteCommand.mockRejectedValueOnce(new Error('Unknown configuration setting'));

      await expect(
        yarn2Proxy.precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'create',
        })
      ).resolves.toBeUndefined();
    });

    it('should tell create-storybook users how to rerun when they choose rerun', async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({ stdout: '[]\n' } as any)
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            name: 'storybook',
            time: {
              created: '2025-01-01T00:00:00.000Z',
              modified: '2026-05-11T12:00:00.000Z',
              '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
              '10.3.2': '2026-05-01T00:00:00.000Z',
            },
          }),
        } as any);
      vi.mocked(prompt.select).mockResolvedValue('rerun' as never);

      await expect(
        yarn2Proxy.precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'create',
        })
      ).rejects.toThrow(
        /Please rerun Storybook creation with:[\s\S]*npx create-storybook@10\.3\.2/
      );
    });

    it('should show the same rerun guidance when the prompt is cancelled', async () => {
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({ stdout: '[]\n' } as any)
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            name: 'storybook',
            time: {
              created: '2025-01-01T00:00:00.000Z',
              modified: '2026-05-11T12:00:00.000Z',
              '10.4.0-alpha.17': '2026-05-11T11:59:00.000Z',
              '10.3.2': '2026-05-01T00:00:00.000Z',
            },
          }),
        } as any);
      vi.mocked(prompt.select).mockImplementationOnce(
        async (_question: any, promptOptions: any) => {
          promptOptions.onCancel();
          return 'exclude';
        }
      );

      await expect(
        yarn2Proxy.precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'create',
        })
      ).rejects.toThrow(
        /Please rerun Storybook creation with:[\s\S]*npx create-storybook@10\.3\.2/
      );
    });

    it('should skip the precheck when Storybook packages are already preapproved', async () => {
      const updateSpy = vi.spyOn(yarn2Proxy as any, 'updatePreapprovedPackages');
      mockedExecuteCommand
        .mockResolvedValueOnce({ stdout: '1440\n' } as any)
        .mockResolvedValueOnce({
          stdout:
            "[\n  'storybook',\n  '@storybook/*',\n  'eslint-plugin-storybook',\n  '@chromatic-com/storybook',\n]\n",
        } as any);

      await expect(
        yarn2Proxy.precheckStorybookPackageInstall({
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
