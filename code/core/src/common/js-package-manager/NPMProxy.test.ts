import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NPMProxy } from './NPMProxy';

// mock createLogStream
vi.mock('../utils/cli', () => ({
  createLogStream: vi.fn(() => ({
    logStream: '',
    readLogFile: vi.fn(),
    moveLogFile: vi.fn(),
    removeLogFile: vi.fn(),
  })),
}));

describe('NPM Proxy', () => {
  let npmProxy: NPMProxy;

  beforeEach(() => {
    npmProxy = new NPMProxy();
  });

  it('type should be npm', () => {
    expect(npmProxy.type).toEqual('npm');
  });

  describe('initPackageJson', () => {
    it('should run `npm init -y`', async () => {
      const executeCommandSpy = vi.spyOn(npmProxy, 'executeCommand').mockResolvedValueOnce('');

      await npmProxy.initPackageJson();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'npm', args: ['init', '-y'] })
      );
    });
  });

  describe('installDependencies', () => {
    describe('npm6', () => {
      it('should run `npm install`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('6.0.0');

        await npmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ command: 'npm', args: ['install'] })
        );
      });
    });
    describe('npm7', () => {
      it('should run `npm install`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.1.0');

        await npmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ command: 'npm', args: ['install'] })
        );
      });
    });
  });

  describe('runScript', () => {
    describe('npm6', () => {
      it('should execute script `npm exec -- compodoc -e json -d .`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('6.0.0');

        npmProxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['exec', '--', 'compodoc', '-e', 'json', '-d', '.'],
          })
        );
      });
    });
    describe('npm7', () => {
      it('should execute script `npm run compodoc -- -e json -d .`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.1.0');

        await npmProxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
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
      it('with devDep it should run `npm install -D @storybook/core`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('6.0.0');

        await npmProxy.addDependencies({ installAsDevDependencies: true }, ['@storybook/core']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['install', '-D', '@storybook/core'],
          })
        );
      });
    });
    describe('npm7', () => {
      it('with devDep it should run `npm install -D @storybook/core`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.0.0');

        await npmProxy.addDependencies({ installAsDevDependencies: true }, ['@storybook/core']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['install', '-D', '@storybook/core'],
          })
        );
      });
    });
  });

  describe('removeDependencies', () => {
    describe('npm6', () => {
      it('with devDep it should run `npm uninstall @storybook/core`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('6.0.0');

        npmProxy.removeDependencies({}, ['@storybook/core']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['uninstall', '@storybook/core'],
          })
        );
      });
    });
    describe('npm7', () => {
      it('with devDep it should run `npm uninstall @storybook/core`', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.0.0');

        await npmProxy.removeDependencies({}, ['@storybook/core']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['uninstall', '@storybook/core'],
          })
        );
      });
    });
    describe('skipInstall', () => {
      it('should only change package.json without running install', async () => {
        const executeCommandSpy = vi
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.0.0');
        const writePackageSpy = vi
          .spyOn(npmProxy, 'writePackageJson')
          .mockImplementation(vi.fn<any>());

        await npmProxy.removeDependencies(
          {
            skipInstall: true,
            packageJson: {
              devDependencies: {
                '@storybook/manager-webpack5': 'x.x.x',
                '@storybook/react': 'x.x.x',
              },
            },
          },
          ['@storybook/manager-webpack5']
        );

        expect(writePackageSpy).toHaveBeenCalledWith({
          devDependencies: {
            '@storybook/react': 'x.x.x',
          },
        });
        expect(executeCommandSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('latestVersion', () => {
    it('without constraint it returns the latest version', async () => {
      const executeCommandSpy = vi
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValueOnce('5.3.19');

      const version = await npmProxy.latestVersion('@storybook/core');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', '@storybook/core', 'version'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = vi
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValueOnce('["4.25.3","5.3.19","6.0.0-beta.23"]');

      const version = await npmProxy.latestVersion('@storybook/core', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', '@storybook/core', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it throws an error if command output is not a valid JSON', async () => {
      vi.spyOn(npmProxy, 'executeCommand').mockResolvedValueOnce('NOT A JSON');

      await expect(npmProxy.latestVersion('@storybook/core', '5.X')).rejects.toThrow();
    });
  });

  describe('getVersion', () => {
    it('with a Storybook package listed in versions.json it returns the version', async () => {
      const storybookAngularVersion = (await import('../versions')).default['@storybook/angular'];
      const executeCommandSpy = vi
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValueOnce('5.3.19');

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
        .mockResolvedValueOnce(`${packageVersion}`);

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
      const writePackageSpy = vi
        .spyOn(npmProxy, 'writePackageJson')
        .mockImplementation(vi.fn<any>());

      vi.spyOn(npmProxy, 'retrievePackageJson').mockImplementation(
        vi.fn(async () => ({
          dependencies: {},
          devDependencies: {},
          overrides: {
            bar: 'x.x.x',
          },
        }))
      );

      const versions = {
        foo: 'x.x.x',
      };
      await npmProxy.addPackageResolutions(versions);

      expect(writePackageSpy).toHaveBeenCalledWith({
        dependencies: {},
        devDependencies: {},
        overrides: {
          ...versions,
          bar: 'x.x.x',
        },
      });
    });
  });

  describe('mapDependencies', () => {
    it('should display duplicated dependencies based on npm output', async () => {
      // npm ls --depth 10 --json
      vi.spyOn(npmProxy, 'executeCommand').mockResolvedValueOnce(`
        {
          "dependencies": {
            "unrelated-and-should-be-filtered": {
              "version": "1.0.0"
            },
            "@storybook/addon-interactions": {
              "version": "7.0.0-rc.7",
              "resolved": "https://registry.npmjs.org/@storybook/addon-interactions/-/addon-interactions-7.0.0-rc.7.tgz",
              "overridden": false,
              "dependencies": {
                "@storybook/instrumenter": {
                  "version": "6.0.0",
                  "resolved": "https://registry.npmjs.org/@storybook/instrumenter/-/instrumenter-7.0.0-rc.7.tgz",
                  "overridden": false,
                  "dependencies": {
                    "@storybook/channels": {
                      "version": "7.0.0-rc.7"
                    }
                  }
                }
              }
            },
            "@storybook/instrumenter": {
              "version": "7.0.0-beta.11",
              "resolved": "https://registry.npmjs.org/@storybook/instrumenter/-/instrumenter-7.0.0-beta.11.tgz",
              "overridden": false,
              "dependencies": {}
            },
            "@storybook/jest": {
              "version": "0.0.11-next.1",
              "resolved": "https://registry.npmjs.org/@storybook/jest/-/jest-0.0.11-next.1.tgz",
              "overridden": false,
              "dependencies": {
                "@storybook/instrumenter": {
                  "version": "7.0.0-alpha.21"
                }
              }
            },
            "@storybook/testing-library": {
              "version": "0.0.14-next.1",
              "resolved": "https://registry.npmjs.org/@storybook/testing-library/-/testing-library-0.0.14-next.1.tgz",
              "overridden": false,
              "dependencies": {
                "@storybook/instrumenter": {
                  "version": "5.4.2-alpha.0"
                }
              }
            }
          }
        }      
      `);

      const installations = await npmProxy.findInstallations(['@storybook/*']);

      expect(installations).toMatchInlineSnapshot(`
        {
          "dedupeCommand": "npm dedupe",
          "dependencies": {
            "@storybook/addon-interactions": [
              {
                "location": "",
                "version": "7.0.0-rc.7",
              },
            ],
            "@storybook/channels": [
              {
                "location": "",
                "version": "7.0.0-rc.7",
              },
            ],
            "@storybook/instrumenter": [
              {
                "location": "",
                "version": "6.0.0",
              },
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
            "@storybook/jest": [
              {
                "location": "",
                "version": "0.0.11-next.1",
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
            "@storybook/instrumenter": [
              "5.4.2-alpha.0",
              "6.0.0",
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
