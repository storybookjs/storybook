import { describe, beforeEach, it, expect, vi } from 'vitest';
import { dedent } from 'ts-dedent';
import { Yarn1Proxy } from './Yarn1Proxy';

describe('Yarn 1 Proxy', () => {
  let yarn1Proxy: Yarn1Proxy;

  beforeEach(() => {
    yarn1Proxy = new Yarn1Proxy();
  });

  it('type should be yarn1', () => {
    expect(yarn1Proxy.type).toEqual('yarn1');
  });

  describe('initPackageJson', () => {
    it('should run `yarn init -y`', async () => {
      const executeCommandSpy = vi.spyOn(yarn1Proxy, 'executeCommand').mockResolvedValueOnce('');

      await yarn1Proxy.initPackageJson();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'yarn', args: ['init', '-y'] })
      );
    });
  });

  describe('installDependencies', () => {
    it('should run `yarn`', async () => {
      const executeCommandSpy = vi.spyOn(yarn1Proxy, 'executeCommand').mockResolvedValueOnce('');

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
    it('should execute script `yarn compodoc -- -e json -d .`', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockResolvedValueOnce('7.1.0');

      await yarn1Proxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

      expect(executeCommandSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ command: 'yarn', args: ['compodoc', '-e', 'json', '-d', '.'] })
      );
    });
  });

  describe('addDependencies', () => {
    it('with devDep it should run `yarn install -D --ignore-workspace-root-check @storybook/core`', async () => {
      const executeCommandSpy = vi.spyOn(yarn1Proxy, 'executeCommand').mockResolvedValueOnce('');

      await yarn1Proxy.addDependencies({ installAsDevDependencies: true }, ['@storybook/core']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['add', '--ignore-workspace-root-check', '-D', '@storybook/core'],
        })
      );
    });
  });

  describe('removeDependencies', () => {
    it('should run `yarn remove --ignore-workspace-root-check @storybook/core`', async () => {
      const executeCommandSpy = vi.spyOn(yarn1Proxy, 'executeCommand').mockResolvedValueOnce('');

      yarn1Proxy.removeDependencies({}, ['@storybook/core']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['remove', '--ignore-workspace-root-check', '@storybook/core'],
        })
      );
    });

    it('skipInstall should only change package.json without running install', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockResolvedValueOnce('7.0.0');
      const writePackageSpy = vi
        .spyOn(yarn1Proxy, 'writePackageJson')
        .mockImplementation(vi.fn<any>());

      await yarn1Proxy.removeDependencies(
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

  describe('latestVersion', () => {
    it('without constraint it returns the latest version', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockResolvedValueOnce('{"type":"inspect","data":"5.3.19"}');

      const version = await yarn1Proxy.latestVersion('@storybook/core');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['info', '@storybook/core', 'version', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn1Proxy, 'executeCommand')
        .mockResolvedValueOnce('{"type":"inspect","data":["4.25.3","5.3.19","6.0.0-beta.23"]}');

      const version = await yarn1Proxy.latestVersion('@storybook/core', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['info', '@storybook/core', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('throws an error if command output is not a valid JSON', async () => {
      vi.spyOn(yarn1Proxy, 'executeCommand').mockResolvedValueOnce('NOT A JSON');

      await expect(yarn1Proxy.latestVersion('@storybook/core')).rejects.toThrow();
    });
  });

  describe('addPackageResolutions', () => {
    it('adds resolutions to package.json and account for existing resolutions', async () => {
      const writePackageSpy = vi
        .spyOn(yarn1Proxy, 'writePackageJson')
        .mockImplementation(vi.fn<any>());

      vi.spyOn(yarn1Proxy, 'retrievePackageJson').mockImplementation(
        vi.fn(async () => ({
          dependencies: {},
          devDependencies: {},
          resolutions: {
            bar: 'x.x.x',
          },
        }))
      );

      const versions = {
        foo: 'x.x.x',
      };
      await yarn1Proxy.addPackageResolutions(versions);

      expect(writePackageSpy).toHaveBeenCalledWith({
        dependencies: {},
        devDependencies: {},
        resolutions: {
          ...versions,
          bar: 'x.x.x',
        },
      });
    });
  });

  describe('mapDependencies', () => {
    it('should display duplicated dependencies based on yarn output', async () => {
      // yarn list --pattern "@storybook/*" "@storybook/react" --recursive --json
      vi.spyOn(yarn1Proxy, 'executeCommand').mockResolvedValueOnce(`
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
                "name": "@storybook/instrumenter@7.0.0-beta.12",
                "children": [
                  {
                    "name": "@storybook/types@7.0.0-beta.12",
                    "children": []
                  }
                ]
              },
              {
                "name": "@storybook/addon-interactions@7.0.0-beta.19",
                "children": [
                  {
                    "name": "@storybook/instrumenter@7.0.0-beta.19",
                    "children": []
                  }
                ]
              }
            ]
          }
        }
      `);

      const installations = await yarn1Proxy.findInstallations(['@storybook/*']);

      expect(installations).toMatchInlineSnapshot(`
        {
          "dedupeCommand": "yarn dedupe",
          "dependencies": {
            "@storybook/addon-interactions": [
              {
                "location": "",
                "version": "7.0.0-beta.19",
              },
            ],
            "@storybook/instrumenter": [
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
            "@storybook/instrumenter": [
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
