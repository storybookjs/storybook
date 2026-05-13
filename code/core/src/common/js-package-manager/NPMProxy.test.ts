import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prompt } from 'storybook/internal/node-logger';
import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import { executeCommand } from '../utils/command.ts';
import { JsPackageManager } from './JsPackageManager.ts';
import { NPMProxy } from './NPMProxy.ts';

vi.mock('storybook/internal/node-logger', () => ({
  prompt: {
    executeTaskWithSpinner: vi.fn(),
    getPreferredStdio: vi.fn(() => 'inherit'),
  },
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock(import('../utils/command.ts'), { spy: true });

const mockedExecuteCommand = vi.mocked(executeCommand);

describe('NPM Proxy', () => {
  let npmProxy: NPMProxy;

  beforeEach(() => {
    vi.useRealTimers();
    npmProxy = new NPMProxy();
    JsPackageManager.clearLatestVersionCache();
    vi.spyOn(npmProxy, 'writePackageJson').mockImplementation(vi.fn());
  });

  it('type should be npm', () => {
    expect(npmProxy.type).toEqual('npm');
  });

  describe('installDependencies', () => {
    describe('npm6', () => {
      it('should run `npm install`', async () => {
        // sort of un-mock part of the function so executeCommand (also mocked) is called
        vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
          await Promise.resolve(fn());
        });
        const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
          stdout: '6.0.0',
        } as any);

        await npmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'npm', args: ['install'] })
        );
      });
    });
    describe('npm7', () => {
      it('should run `npm install`', async () => {
        // sort of un-mock part of the function so executeCommand (also mocked) is called
        vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
          await Promise.resolve(fn());
        });
        const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
          stdout: '7.1.0',
        } as any);

        await npmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'npm', args: ['install'] })
        );
      });

      it('should rethrow minimum-release-age install errors as handled errors', async () => {
        vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
          await Promise.resolve(fn());
        });
        const originalError = new Error(
          [
            'npm error code ETARGET',
            'npm error notarget No matching version found for @storybook/react-vite@10.4.0-alpha.17 with a date before 02/05/2026, 13:32:18.',
            "npm error notarget In most cases you or one of your dependencies are requesting a package version that doesn't exist.",
          ].join('\n')
        );
        mockedExecuteCommand.mockRejectedValueOnce(originalError);

        const error = await npmProxy.installDependencies().then(
          () => null,
          (caughtError) => caughtError
        );

        expect(error).toBeInstanceOf(MinimumReleaseAgeHandledError);
        expect(error).toMatchObject({ cause: originalError });
        expect(error?.message).toContain('min-release-age');
        expect(error?.message).toContain('@storybook/react-vite@10.4.0-alpha.17');
      });
    });
  });

  describe('precheckStorybookPackageInstall', () => {
    it('throws a handled error with rerun instructions when npm min-release-age blocks the requested version', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-10T00:00:00.000Z'));
      mockedExecuteCommand.mockResolvedValueOnce({ stdout: '1' } as any).mockResolvedValueOnce({
        stdout: JSON.stringify({
          '10.4.0-alpha.17': '2025-01-09T23:30:00.000Z',
          '10.3.9': '2025-01-08T20:00:00.000Z',
        }),
      } as any);

      const error = await npmProxy
        .precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'upgrade',
        })
        .then(
          () => null,
          (caughtError) => caughtError
        );

      expect(error).toBeInstanceOf(MinimumReleaseAgeHandledError);
      expect(error).toBeTruthy();
      expect(error?.message).toContain('npx storybook@10.3.9 upgrade');
      expect(error?.message).toContain('min-release-age');
    });
  });

  describe('runScript', () => {
    describe('npm6', () => {
      it('should execute script `npm exec -- compodoc -e json -d .`', () => {
        const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
          stdout: '6.0.0',
        } as any);

        npmProxy.runPackageCommand({
          args: ['compodoc', '-e', 'json', '-d', '.'],
        });

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'npx',
            args: ['compodoc', '-e', 'json', '-d', '.'],
          })
        );
      });
    });
    describe('npm7', () => {
      it('should execute script `npm run compodoc -- -e json -d .`', () => {
        const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
          stdout: '7.1.0',
        } as any);

        npmProxy.runPackageCommand({
          args: ['compodoc', '-e', 'json', '-d', '.'],
        });

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'npx',
            args: ['compodoc', '-e', 'json', '-d', '.'],
          })
        );
      });
    });
  });

  describe('addDependencies', () => {
    describe('npm6', () => {
      it('with devDep it should run `npm install -D storybook`', async () => {
        const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
          stdout: '6.0.0',
        } as any);

        await npmProxy.addDependencies({ type: 'devDependencies' }, ['storybook']);

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['install', '-D', 'storybook'],
          })
        );
      });
    });
    describe('npm7', () => {
      it('with devDep it should run `npm install -D storybook`', async () => {
        const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
          stdout: '7.0.0',
        } as any);

        await npmProxy.addDependencies({ type: 'devDependencies' }, ['storybook']);

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['install', '-D', 'storybook'],
          })
        );
      });
    });
  });

  describe('removeDependencies', () => {
    describe('skipInstall', () => {
      it('should only change package.json without running install', async () => {
        const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
          stdout: '7.0.0',
        } as any);

        vi.spyOn(npmProxy, 'packageJsonPaths', 'get').mockImplementation(() => ['package.json']);

        const writePackageSpy = vi.spyOn(npmProxy, 'writePackageJson').mockImplementation(vi.fn());
        vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation((args) => {
          return {
            dependencies: {},
            devDependencies: {
              '@storybook/manager-webpack5': 'x.x.x',
              '@storybook/react': 'x.x.x',
            },
          };
        });

        await npmProxy.removeDependencies(['@storybook/manager-webpack5']);

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
  });

  describe('latestVersion', () => {
    it('without constraint it returns the latest version', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '5.3.19' } as any);

      const version = await npmProxy.latestVersion('storybook');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', 'storybook', 'version'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({
        stdout: '["4.25.3","5.3.19","6.0.0-beta.23"]',
      } as any);

      const version = await npmProxy.latestVersion('storybook', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', 'storybook', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it throws an error if command output is not a valid JSON', async () => {
      mockedExecuteCommand.mockResolvedValue({ stdout: 'NOT A JSON' } as any);

      await expect(npmProxy.latestVersion('storybook', '5.X')).resolves.toBe(null);
    });
  });

  describe('getVersion', () => {
    it('with a Storybook package listed in versions.json it returns the version', async () => {
      const storybookAngularVersion = (await import('../versions.ts')).default[
        '@storybook/angular'
      ];
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '5.3.19' } as any);

      const version = await npmProxy.getVersion('@storybook/angular');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
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

      const version = await npmProxy.getVersion('@storybook/react-native');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', '@storybook/react-native', 'version'],
        })
      );
      expect(version).toEqual(`^${packageVersion}`);
    });
  });

  describe('addPackageResolutions', () => {
    it('adds resolutions to package.json and account for existing resolutions', async () => {
      const writePackageSpy = vi.spyOn(npmProxy, 'writePackageJson').mockImplementation(vi.fn());

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
      npmProxy.addPackageResolutions(versions);

      expect(writePackageSpy).toHaveBeenCalledWith(
        {
          dependencies: {},
          devDependencies: {},
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
    it('should display duplicated dependencies based on npm output', async () => {
      // npm ls --depth 10 --json
      mockedExecuteCommand.mockResolvedValue({
        stdout: `
        {
          "dependencies": {
            "unrelated-and-should-be-filtered": {
              "version": "1.0.0"
            },
            "@storybook/package": {
              "version": "7.0.0-beta.11",
              "resolved": "https://registry.npmjs.org/@storybook/package/-/core-7.0.0-beta.11.tgz",
              "overridden": false,
              "dependencies": {}
            },
            "@storybook/jest": {
              "version": "0.0.11-next.1",
              "resolved": "https://registry.npmjs.org/@storybook/jest/-/jest-0.0.11-next.1.tgz",
              "overridden": false,
              "dependencies": {
                "@storybook/package": {
                  "version": "7.0.0-alpha.21"
                }
              }
            },
            "@storybook/testing-library": {
              "version": "0.0.14-next.1",
              "resolved": "https://registry.npmjs.org/@storybook/testing-library/-/testing-library-0.0.14-next.1.tgz",
              "overridden": false,
              "dependencies": {
                "@storybook/package": {
                  "version": "5.4.2-alpha.0"
                }
              }
            }
          }
        }      
      `,
      } as any);

      const installations = await npmProxy.findInstallations(['@storybook/*']);

      expect(installations).toMatchInlineSnapshot(`
        {
          "dedupeCommand": "npm dedupe",
          "dependencies": {
            "@storybook/jest": [
              {
                "location": "",
                "version": "0.0.11-next.1",
              },
            ],
            "@storybook/package": [
              {
                "location": "",
                "version": "7.0.0-beta.11",
              },
              {
                "location": "",
                "version": "7.0.0-alpha.21",
              },
              {
                "location": "",
                "version": "5.4.2-alpha.0",
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
              "5.4.2-alpha.0",
              "7.0.0-alpha.21",
              "7.0.0-beta.11",
            ],
          },
          "infoCommand": "npm ls --depth=1",
        }
      `);
    });
  });

});
