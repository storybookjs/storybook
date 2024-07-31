import { describe, beforeEach, it, expect, vi } from 'vitest';
import { PNPMProxy } from './PNPMProxy';

describe('PNPM Proxy', () => {
  let pnpmProxy: PNPMProxy;

  beforeEach(() => {
    pnpmProxy = new PNPMProxy();
  });

  it('type should be pnpm', () => {
    expect(pnpmProxy.type).toEqual('pnpm');
  });

  describe('initPackageJson', () => {
    it('should run `pnpm init`', async () => {
      const executeCommandSpy = vi.spyOn(pnpmProxy, 'executeCommand').mockResolvedValueOnce('');

      await pnpmProxy.initPackageJson();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['init'] })
      );
    });
  });

  describe('installDependencies', () => {
    it('should run `pnpm install`', async () => {
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValueOnce('7.1.0');

      await pnpmProxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['install'] })
      );
    });
  });

  describe('runScript', () => {
    it('should execute script `pnpm exec compodoc -- -e json -d .`', async () => {
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValueOnce('7.1.0');

      await pnpmProxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

      expect(executeCommandSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['exec', 'compodoc', '-e', 'json', '-d', '.'],
        })
      );
    });
  });

  describe('addDependencies', () => {
    it('with devDep it should run `pnpm add -D @storybook/core`', async () => {
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValueOnce('6.0.0');

      await pnpmProxy.addDependencies({ installAsDevDependencies: true }, ['@storybook/core']);

      expect(executeCommandSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['add', '-D', '@storybook/core'],
        })
      );
    });
  });

  describe('removeDependencies', () => {
    it('with devDep it should run `npm uninstall @storybook/core`', async () => {
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValueOnce('6.0.0');

      await pnpmProxy.removeDependencies({}, ['@storybook/core']);

      expect(executeCommandSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['remove', '@storybook/core'],
        })
      );
    });

    describe('skipInstall', () => {
      it('should only change package.json without running install', async () => {
        const executeCommandSpy = vi
          .spyOn(pnpmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.0.0');
        const writePackageSpy = vi
          .spyOn(pnpmProxy, 'writePackageJson')
          .mockImplementation(vi.fn<any>());

        await pnpmProxy.removeDependencies(
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
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValueOnce('"5.3.19"');

      const version = await pnpmProxy.latestVersion('@storybook/core');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['info', '@storybook/core', 'version', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValueOnce('["4.25.3","5.3.19","6.0.0-beta.23"]');

      const version = await pnpmProxy.latestVersion('@storybook/core', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['info', '@storybook/core', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('throws an error if command output is not a valid JSON', async () => {
      vi.spyOn(pnpmProxy, 'executeCommand').mockResolvedValueOnce('NOT A JSON');

      await expect(pnpmProxy.latestVersion('@storybook/core')).rejects.toThrow();
    });
  });

  describe('getVersion', () => {
    it('with a Storybook package listed in versions.json it returns the version', async () => {
      const storybookAngularVersion = (await import('../versions')).default['@storybook/angular'];
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValueOnce('"5.3.19"');

      const version = await pnpmProxy.getVersion('@storybook/angular');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['info', '@storybook/angular', 'version', '--json'],
        })
      );
      expect(version).toEqual(`^${storybookAngularVersion}`);
    });

    it('with a Storybook package not listed in versions.json it returns the latest version', async () => {
      const packageVersion = '5.3.19';
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValueOnce(`"${packageVersion}"`);

      const version = await pnpmProxy.getVersion('@storybook/react-native');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['info', '@storybook/react-native', 'version', '--json'],
        })
      );
      expect(version).toEqual(`^${packageVersion}`);
    });
  });

  describe('addPackageResolutions', () => {
    it('adds resolutions to package.json and account for existing resolutions', async () => {
      const writePackageSpy = vi
        .spyOn(pnpmProxy, 'writePackageJson')
        .mockImplementation(vi.fn<any>());

      const basePackageAttributes = {
        dependencies: {},
        devDependencies: {},
      };

      vi.spyOn(pnpmProxy, 'retrievePackageJson').mockImplementation(
        vi.fn(async () => ({
          ...basePackageAttributes,
          overrides: {
            bar: 'x.x.x',
          },
        }))
      );

      const versions = {
        foo: 'x.x.x',
      };
      await pnpmProxy.addPackageResolutions(versions);

      expect(writePackageSpy).toHaveBeenCalledWith({
        ...basePackageAttributes,
        overrides: {
          ...versions,
          bar: 'x.x.x',
        },
      });
    });
  });

  describe('mapDependencies', () => {
    it('should display duplicated dependencies based on pnpm output', async () => {
      // pnpm list "@storybook/*" "storybook" --depth 10 --json
      vi.spyOn(pnpmProxy, 'executeCommand').mockResolvedValueOnce(`
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
              "@storybook/addon-interactions": {
                "from": "@storybook/addon-interactions",
                "version": "7.0.0-beta.13",
                "resolved": "https://registry.npmjs.org/@storybook/addon-interactions/-/addon-interactions-7.0.0-beta.13.tgz",
                "dependencies": {
                  "@storybook/instrumenter": {
                    "from": "@storybook/instrumenter",
                    "version": "7.0.0-beta.13",
                    "resolved": "https://registry.npmjs.org/@storybook/instrumenter/-/instrumenter-7.0.0-beta.13.tgz"
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
                  "@storybook/instrumenter": {
                    "from": "@storybook/instrumenter",
                    "version": "7.0.0-rc.7",
                    "resolved": "https://registry.npmjs.org/@storybook/instrumenter/-/instrumenter-7.0.0-rc.7.tgz"
                  }
                }
              },
              "@storybook/testing-library": {
                "from": "@storybook/testing-library",
                "version": "0.0.14-next.1",
                "resolved": "https://registry.npmjs.org/@storybook/testing-library/-/testing-library-0.0.14-next.1.tgz",
                "dependencies": {
                  "@storybook/instrumenter": {
                    "from": "@storybook/instrumenter",
                    "version": "7.0.0-rc.7",
                    "resolved": "https://registry.npmjs.org/@storybook/instrumenter/-/instrumenter-7.0.0-rc.7.tgz"
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
      `);

      const installations = await pnpmProxy.findInstallations(['@storybook/*']);

      expect(installations).toMatchInlineSnapshot(`
        {
          "dedupeCommand": "pnpm dedupe",
          "dependencies": {
            "@storybook/addon-interactions": [
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
            "@storybook/instrumenter": [
              {
                "location": "",
                "version": "7.0.0-rc.7",
              },
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
            "@storybook/testing-library": [
              {
                "location": "",
                "version": "0.0.14-next.1",
              },
            ],
          },
          "duplicatedDependencies": {
            "@storybook/instrumenter": [
              "7.0.0-rc.7",
              "7.0.0-beta.13",
            ],
          },
          "infoCommand": "pnpm list --depth=1",
        }
      `);
    });
  });

  describe('parseErrors', () => {
    it('should parse pnpm errors', () => {
      const PNPM_ERROR_SAMPLE = `
        ERR_PNPM_NO_MATCHING_VERSION No matching version found for react@29.2.0

        This error happened while installing a direct dependency of /Users/yannbraga/open-source/sandboxes/react-vite/default-js/before-storybook
        
        The latest release of react is "18.2.0".
        `;

      expect(pnpmProxy.parseErrorFromLogs(PNPM_ERROR_SAMPLE)).toEqual(
        'PNPM error ERR_PNPM_NO_MATCHING_VERSION No matching version found for react@29.2.0'
      );
    });

    it('should show unknown pnpm error', () => {
      const PNPM_ERROR_SAMPLE = `
        This error happened while installing a direct dependency of /Users/yannbraga/open-source/sandboxes/react-vite/default-js/before-storybook
          
        The latest release of react is "18.2.0".
      `;

      expect(pnpmProxy.parseErrorFromLogs(PNPM_ERROR_SAMPLE)).toEqual(`PNPM error`);
    });
  });
});
