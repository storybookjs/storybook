import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prompt } from 'storybook/internal/node-logger';

import { JsPackageManager } from './JsPackageManager';
import { NPMProxy } from './NPMProxy';

describe('NPM Proxy', () => {
  let npmProxy: NPMProxy;

  beforeEach(() => {
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
        vi.mocked(prompt.executeTask).mockImplementationOnce(async (fn: any) => {
          await Promise.resolve(fn());
        });
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValue({ stdout: '6.0.0' } as any);

        await npmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'npm', args: ['install'] })
        );
      });
    });
    describe('npm7', () => {
      it('should run `npm install`', async () => {
        // sort of un-mock part of the function so executeCommand (also mocked) is called
        vi.mocked(prompt.executeTask).mockImplementationOnce(async (fn: any) => {
          await Promise.resolve(fn());
        });
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValue({ stdout: '7.1.0' } as any);

        await npmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'npm', args: ['install'] })
        );
      });
    });
  });

  describe('runScript', () => {
    describe('npm6', () => {
      it('should execute script `npm exec -- compodoc -e json -d .`', () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValue({ stdout: '6.0.0' } as any);

        npmProxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['exec', '--', 'compodoc', '-e', 'json', '-d', '.'],
          })
        );
      });
    });
    describe('npm7', () => {
      it('should execute script `npm run compodoc -- -e json -d .`', () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValue({ stdout: '7.1.0' } as any);

        npmProxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

        expect(executeCommandSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['exec', '--', 'compodoc', '-e', 'json', '-d', '.'],
          })
        );
      });
    });
  });

  describe('addDependencies', () => {
    describe('npm6', () => {
      it('with devDep it should run `npm install -D storybook`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValue({ stdout: '6.0.0' } as any);

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
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValue({ stdout: '7.0.0' } as any);

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
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValue({ stdout: '7.0.0' } as any);

        vi.spyOn(npmProxy, 'packageJsonPaths', 'get').mockImplementation(() => ['package.json']);

        const writePackageSpy = vi.spyOn(npmProxy, 'writePackageJson').mockImplementation(vi.fn());
        vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation(() => {
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
      const executeCommandSpy = vi
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '5.3.19' } as any);

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
      const executeCommandSpy = vi
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '["4.25.3","5.3.19","6.0.0-beta.23"]' } as any);

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
      vi.spyOn(npmProxy, 'executeCommand').mockResolvedValue({ stdout: 'NOT A JSON' } as any);

      await expect(npmProxy.latestVersion('storybook', '5.X')).resolves.toBe(null);
    });
  });

  describe('getVersion', () => {
    it('with a Storybook package listed in versions.json it returns the version', async () => {
      const storybookAngularVersion = (await import('../versions')).default['@storybook/angular'];
      const executeCommandSpy = vi
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '5.3.19' } as any);

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
      const executeCommandSpy = vi
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: `${packageVersion}` } as any);

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
      vi.spyOn(npmProxy, 'executeCommand').mockResolvedValue({
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

  describe('parseErrors', () => {
    it('should parse npm errors', () => {
      const NPM_LEGACY_RESOLVE_ERROR_SAMPLE = `
        npm ERR!
        npm ERR! code ERESOLVE
        npm ERR! ERESOLVE unable to resolve dependency tree
        npm ERR! 
        npm ERR! While resolving: before-storybook@1.0.0
        npm ERR! Found: react@undefined
        npm ERR! node_modules/react
        npm ERR!   react@"30" from the root project
        `;

      const NPM_RESOLVE_ERROR_SAMPLE = `
        npm error
        npm error code ERESOLVE
        npm error ERESOLVE unable to resolve dependency tree
        npm error 
        npm error While resolving: before-storybook@1.0.0
        npm error Found: react@undefined
        npm error node_modules/react
        npm error   react@"30" from the root project
        `;

      const NPM_TIMEOUT_ERROR_SAMPLE = `
          npm notice 
          npm notice New major version of npm available! 8.5.0 -> 9.6.7
          npm notice Changelog: <https://github.com/npm/cli/releases/tag/v9.6.7>
          npm notice Run \`npm install -g npm@9.6.7\` to update!
          npm notice 
          npm ERR! code ERR_SOCKET_TIMEOUT
          npm ERR! errno ERR_SOCKET_TIMEOUT
          npm ERR! network Invalid response body while trying to fetch https://registry.npmjs.org/@storybook%2ftypes: Socket timeout
          npm ERR! network This is a problem related to network connectivity.
      `;

      expect(npmProxy.parseErrorFromLogs(NPM_LEGACY_RESOLVE_ERROR_SAMPLE)).toEqual(
        'NPM error ERESOLVE - Dependency resolution error.'
      );
      expect(npmProxy.parseErrorFromLogs(NPM_RESOLVE_ERROR_SAMPLE)).toEqual(
        'NPM error ERESOLVE - Dependency resolution error.'
      );
      expect(npmProxy.parseErrorFromLogs(NPM_TIMEOUT_ERROR_SAMPLE)).toEqual(
        'NPM error ERR_SOCKET_TIMEOUT - Socket timed out.'
      );
    });

    it('should show unknown npm error', () => {
      const NPM_ERROR_SAMPLE = `
        npm ERR! 
        npm ERR! While resolving: before-storybook@1.0.0
        npm ERR! Found: react@undefined
        npm ERR! node_modules/react
        npm ERR!   react@"30" from the root project
      `;

      expect(npmProxy.parseErrorFromLogs(NPM_ERROR_SAMPLE)).toEqual(`NPM error`);
    });
  });
});
