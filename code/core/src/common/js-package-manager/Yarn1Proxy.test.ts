import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prompt } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import { JsPackageManager } from './JsPackageManager';
import { Yarn1Proxy } from './Yarn1Proxy';

vi.mock('node:process', async (importOriginal) => {
  const original: any = await importOriginal();
  return {
    ...original,
    default: {
      ...original.default,
      env: {
        ...original.default.env,
        CI: false,
      },
    },
  };
});

describe('Yarn 1 Proxy', () => {
  let yarn1Proxy: Yarn1Proxy;

  beforeEach(() => {
    yarn1Proxy = new Yarn1Proxy();
    JsPackageManager.clearLatestVersionCache();
    vi.spyOn(yarn1Proxy, 'writePackageJson').mockImplementation(vi.fn());
  });

  it('type should be yarn1', () => {
    expect(yarn1Proxy.type).toEqual('yarn1');
  });

  describe('installDependencies', () => {
    it('should run `yarn`', async () => {
      // sort of un-mock part of the function so executeCommand (also mocked) is called
      vi.mocked(prompt.executeTask).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      const executeCommandSpy = vi
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockReturnValue(Promise.resolve({ stdout: '' }) as any);

      await yarn1Proxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['install', '--ignore-workspace-root-check'],
        })
      );
    });
  });

  describe('runScript', () => {
    it('should execute script `yarn compodoc -- -e json -d .`', () => {
      const executeCommandSpy = vi
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockReturnValue(Promise.resolve({ stdout: '7.1.0' }) as any);

      yarn1Proxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

      expect(executeCommandSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['exec', 'compodoc', '-e', 'json', '-d', '.'],
        })
      );
    });
  });

  describe('addDependencies', () => {
    it('with devDep it should run `yarn install -D --ignore-workspace-root-check storybook`', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockReturnValue(Promise.resolve({ stdout: '' }) as any);

      await yarn1Proxy.addDependencies({ type: 'devDependencies' }, ['storybook']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['add', '--ignore-workspace-root-check', '-D', 'storybook'],
        })
      );
    });
  });

  describe('removeDependencies', () => {
    it('skipInstall should only change package.json without running install', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockReturnValue(Promise.resolve({ stdout: '7.0.0' }) as any);
      const writePackageSpy = vi.spyOn(yarn1Proxy, 'writePackageJson').mockImplementation(vi.fn());

      vi.spyOn(JsPackageManager, 'getPackageJson').mockImplementation((args) => {
        return {
          dependencies: {},
          devDependencies: {
            '@storybook/manager-webpack5': 'x.x.x',
            '@storybook/react': 'x.x.x',
          },
        };
      });

      await yarn1Proxy.removeDependencies(['@storybook/manager-webpack5']);

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
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockReturnValue(Promise.resolve({ stdout: '{"type":"inspect","data":"5.3.19"}' }) as any);

      const version = await yarn1Proxy.latestVersion('storybook');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['info', 'storybook', 'version', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = vi.spyOn(yarn1Proxy, 'executeCommand').mockReturnValue(
        Promise.resolve({
          stdout: '{"type":"inspect","data":["4.25.3","5.3.19","6.0.0-beta.23"]}',
        }) as any
      );

      const version = await yarn1Proxy.latestVersion('storybook', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['info', 'storybook', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('throws an error if command output is not a valid JSON', async () => {
      vi.spyOn(yarn1Proxy, 'executeCommand').mockReturnValue(
        Promise.resolve({ stdout: 'NOT A JSON' }) as any
      );

      await expect(yarn1Proxy.latestVersion('storybook')).resolves.toBe(null);
    });
  });

  describe('addPackageResolutions', () => {
    it('adds resolutions to package.json and account for existing resolutions', async () => {
      const writePackageSpy = vi.spyOn(yarn1Proxy, 'writePackageJson').mockImplementation(vi.fn());

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
      yarn1Proxy.addPackageResolutions(versions);

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
    it('should display duplicated dependencies based on yarn output', async () => {
      // yarn list --pattern "@storybook/*" "@storybook/react" --recursive --json
      vi.spyOn(yarn1Proxy, 'executeCommand').mockResolvedValueOnce({
        stdout: `
        {
          "type": "tree",
          "data": {
            "type": "list",
            "trees": [
              {
                "name": "unrelated-and-should-be-filtered@1.0.0",
                "children": []
              },
              {
                "name": "@storybook/package@7.0.0-beta.12",
                "children": [
                  {
                    "name": "@storybook/types@7.0.0-beta.12",
                    "children": []
                  }
                ]
              },
              {
                "name": "@storybook/addon-example@7.0.0-beta.19",
                "children": [
                  {
                    "name": "@storybook/package@7.0.0-beta.19",
                    "children": []
                  }
                ]
              }
            ]
          }
        }
      `,
      } as any);

      const installations = await yarn1Proxy.findInstallations(['@storybook/*']);

      expect(installations).toMatchInlineSnapshot(`
        {
          "dedupeCommand": "yarn dedupe",
          "dependencies": {
            "@storybook/addon-example": [
              {
                "location": "",
                "version": "7.0.0-beta.19",
              },
            ],
            "@storybook/package": [
              {
                "location": "",
                "version": "7.0.0-beta.12",
              },
              {
                "location": "",
                "version": "7.0.0-beta.19",
              },
            ],
            "@storybook/types": [
              {
                "location": "",
                "version": "7.0.0-beta.12",
              },
            ],
          },
          "duplicatedDependencies": {
            "@storybook/package": [
              "7.0.0-beta.12",
              "7.0.0-beta.19",
            ],
          },
          "infoCommand": "yarn why",
        }
      `);
    });
  });

  describe('parseErrors', () => {
    it('should parse yarn1 errors', () => {
      const YARN1_ERROR_SAMPLE = dedent`
        yarn add v1.22.19
        [1/4] Resolving packages...
        error Couldn't find any versions for "react" that matches "28.2.0"
        info Visit https://yarnpkg.com/en/docs/cli/add for documentation about this command.
      `;

      expect(yarn1Proxy.parseErrorFromLogs(YARN1_ERROR_SAMPLE)).toEqual(
        `YARN1 error: Couldn't find any versions for "react" that matches "28.2.0"`
      );
    });

    it('should show unknown yarn1 error', () => {
      const YARN1_ERROR_SAMPLE = dedent`
        yarn install v1.22.19
        [1/4] 🔍  Resolving packages...
        info Visit https://yarnpkg.com/en/docs/cli/install for documentation about this command.
      `;

      expect(yarn1Proxy.parseErrorFromLogs(YARN1_ERROR_SAMPLE)).toEqual(`YARN1 error`);
    });
  });
});
