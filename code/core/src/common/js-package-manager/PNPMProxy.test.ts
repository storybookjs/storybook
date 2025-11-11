import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prompt } from 'storybook/internal/node-logger';

import { JsPackageManager } from './JsPackageManager';
import { PNPMProxy } from './PNPMProxy';

describe('PNPM Proxy', () => {
  let pnpmProxy: PNPMProxy;

  beforeEach(() => {
    pnpmProxy = new PNPMProxy();
    JsPackageManager.clearLatestVersionCache();
    vi.spyOn(pnpmProxy, 'writePackageJson').mockImplementation(vi.fn());
  });

  it('type should be pnpm', () => {
    expect(pnpmProxy.type).toEqual('pnpm');
  });

  describe('installDependencies', () => {
    it('should run `pnpm install`', async () => {
      // sort of un-mock part of the function so executeCommand (also mocked) is called
      vi.mocked(prompt.executeTask).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '7.1.0' } as any);

      await pnpmProxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'pnpm', args: ['install'] })
      );
    });
  });

  describe('runScript', () => {
    it('should execute script `pnpm exec compodoc -- -e json -d .`', () => {
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '7.1.0' } as any);

      pnpmProxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['exec', 'compodoc', '-e', 'json', '-d', '.'],
        })
      );
    });
  });

  describe('addDependencies', () => {
    it('with devDep it should run `pnpm add -D storybook`', async () => {
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '6.0.0' } as any);

      await pnpmProxy.addDependencies({ type: 'devDependencies' }, ['storybook']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: ['add', '-D', 'storybook'],
        })
      );
    });
  });

  describe('removeDependencies', () => {
    it('should only change package.json without running install', async () => {
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '7.0.0' } as any);
      const writePackageSpy = vi.spyOn(pnpmProxy, 'writePackageJson').mockImplementation(vi.fn());

      vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation(() => {
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
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '5.3.19' } as any);

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
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '["4.25.3","5.3.19","6.0.0-beta.23"]' } as any);

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
      vi.spyOn(pnpmProxy, 'executeCommand').mockResolvedValue({ stdout: 'NOT A JSON' } as any);

      await expect(pnpmProxy.latestVersion('storybook', '5.X')).resolves.toBe(null);
    });
  });

  describe('getVersion', () => {
    it('with a Storybook package listed in versions.json it returns the version', async () => {
      const storybookAngularVersion = (await import('../versions')).default['@storybook/angular'];
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: '5.3.19' } as any);

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
      const executeCommandSpy = vi
        .spyOn(pnpmProxy, 'executeCommand')
        .mockResolvedValue({ stdout: `${packageVersion}` } as any);

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
      vi.spyOn(pnpmProxy, 'executeCommand').mockResolvedValue({
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
