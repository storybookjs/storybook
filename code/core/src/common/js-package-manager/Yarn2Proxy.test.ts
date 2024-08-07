import { describe, beforeEach, it, expect, vi } from 'vitest';
import { Yarn2Proxy } from './Yarn2Proxy';

describe('Yarn 2 Proxy', () => {
  let yarn2Proxy: Yarn2Proxy;

  beforeEach(() => {
    yarn2Proxy = new Yarn2Proxy();
  });

  it('type should be yarn2', () => {
    expect(yarn2Proxy.type).toEqual('yarn2');
  });

  describe('initPackageJson', () => {
    it('should run `yarn init`', async () => {
      const executeCommandSpy = vi.spyOn(yarn2Proxy, 'executeCommand').mockResolvedValueOnce('');

      await yarn2Proxy.initPackageJson();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'yarn', args: ['init'] })
      );
    });
  });

  describe('installDependencies', () => {
    it('should run `yarn`', async () => {
      const executeCommandSpy = vi.spyOn(yarn2Proxy, 'executeCommand').mockResolvedValueOnce('');

      await yarn2Proxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'yarn', args: ['install'] })
      );
    });
  });

  describe('runScript', () => {
    it('should execute script `yarn compodoc -- -e json -d .`', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn2Proxy, 'executeCommand')
        .mockResolvedValueOnce('7.1.0');

      await yarn2Proxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

      expect(executeCommandSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['compodoc', '-e', 'json', '-d', '.'],
        })
      );
    });
  });

  describe('setRegistryUrl', () => {
    it('should run `yarn config set npmRegistryServer https://foo.bar`', async () => {
      const executeCommandSpy = vi.spyOn(yarn2Proxy, 'executeCommand').mockResolvedValueOnce('');

      await yarn2Proxy.setRegistryURL('https://foo.bar');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['config', 'set', 'registry', 'https://foo.bar'],
        })
      );
    });
  });

  describe('addDependencies', () => {
    it('with devDep it should run `yarn install -D @storybook/core`', async () => {
      const executeCommandSpy = vi.spyOn(yarn2Proxy, 'executeCommand').mockResolvedValueOnce('');

      await yarn2Proxy.addDependencies({ installAsDevDependencies: true }, ['@storybook/core']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['add', '-D', '@storybook/core'],
        })
      );
    });
  });

  describe('removeDependencies', () => {
    it('should run `yarn remove @storybook/core`', async () => {
      const executeCommandSpy = vi.spyOn(yarn2Proxy, 'executeCommand').mockResolvedValueOnce('');

      await yarn2Proxy.removeDependencies({}, ['@storybook/core']);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['remove', '@storybook/core'],
        })
      );
    });

    it('skipInstall should only change package.json without running install', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn2Proxy, 'executeCommand')
        .mockResolvedValueOnce('7.0.0');
      const writePackageSpy = vi
        .spyOn(yarn2Proxy, 'writePackageJson')
        .mockImplementation(vi.fn<any>());

      await yarn2Proxy.removeDependencies(
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
        .spyOn(yarn2Proxy, 'executeCommand')
        .mockResolvedValueOnce('{"name":"@storybook/core","version":"5.3.19"}');

      const version = await yarn2Proxy.latestVersion('@storybook/core');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['npm', 'info', '@storybook/core', '--fields', 'version', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = vi
        .spyOn(yarn2Proxy, 'executeCommand')
        .mockResolvedValueOnce(
          '{"name":"@storybook/core","versions":["4.25.3","5.3.19","6.0.0-beta.23"]}'
        );

      const version = await yarn2Proxy.latestVersion('@storybook/core', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'yarn',
          args: ['npm', 'info', '@storybook/core', '--fields', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('throws an error if command output is not a valid JSON', async () => {
      vi.spyOn(yarn2Proxy, 'executeCommand').mockResolvedValueOnce('NOT A JSON');

      await expect(yarn2Proxy.latestVersion('@storybook/core')).rejects.toThrow();
    });
  });

  describe('addPackageResolutions', () => {
    it('adds resolutions to package.json and account for existing resolutions', async () => {
      const writePackageSpy = vi
        .spyOn(yarn2Proxy, 'writePackageJson')
        .mockImplementation(vi.fn<any>());

      vi.spyOn(yarn2Proxy, 'retrievePackageJson').mockImplementation(
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

      await yarn2Proxy.addPackageResolutions(versions);

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
    it('should display duplicated dependencies based on yarn2 output', async () => {
      // yarn info --name-only --recursive "@storybook/*" "storybook"
      vi.spyOn(yarn2Proxy, 'executeCommand').mockResolvedValueOnce(`
      "unrelated-and-should-be-filtered@npm:1.0.0"
      "@storybook/global@npm:5.0.0"
      "@storybook/instrumenter@npm:7.0.0-beta.12"
      "@storybook/instrumenter@npm:7.0.0-beta.19"
      "@storybook/jest@npm:0.0.11-next.0"
      "@storybook/manager-api@npm:7.0.0-beta.19"
      "@storybook/manager@npm:7.0.0-beta.19"
      "@storybook/mdx2-csf@npm:0.1.0-next.5"
      `);

      const installations = await yarn2Proxy.findInstallations(['@storybook/*']);

      expect(installations).toMatchInlineSnapshot(`
        {
          "dedupeCommand": "yarn dedupe",
          "dependencies": {
            "@storybook/global": [
              {
                "location": "",
                "version": "5.0.0",
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
            "@storybook/jest": [
              {
                "location": "",
                "version": "0.0.11-next.0",
              },
            ],
            "@storybook/manager": [
              {
                "location": "",
                "version": "7.0.0-beta.19",
              },
            ],
            "@storybook/manager-api": [
              {
                "location": "",
                "version": "7.0.0-beta.19",
              },
            ],
            "@storybook/mdx2-csf": [
              {
                "location": "",
                "version": "0.1.0-next.5",
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
    it('should single yarn2 error message', () => {
      const YARN2_ERROR_SAMPLE = `
        ➤ YN0000: ┌ Resolution step
        ➤ YN0001: │ Error: react@npm:28.2.0: No candidates found
            at ge (/Users/xyz/.cache/node/corepack/yarn/3.5.1/yarn.js:439:8124)
            at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
            at async Promise.allSettled (index 8)
            at async io (/Users/xyz/.cache/node/corepack/yarn/3.5.1/yarn.js:390:10398)
        ➤ YN0000: └ Completed in 2s 369ms
        ➤ YN0000: Failed with errors in 2s 372ms
        ➤ YN0032: fsevents@npm:2.3.2: Implicit dependencies on node-gyp are discouraged
        ➤ YN0061: @npmcli/move-file@npm:2.0.1 is deprecated: This functionality has been moved to @npmcli/fs
      `;

      expect(yarn2Proxy.parseErrorFromLogs(YARN2_ERROR_SAMPLE)).toMatchInlineSnapshot(
        `
        "YARN2 error
        YN0001: EXCEPTION
        -> Error: react@npm:28.2.0: No candidates found
        "
      `
      );
    });

    it('shows multiple yarn2 error messages', () => {
      const YARN2_ERROR_SAMPLE = `
        ➤ YN0000: · Yarn 4.1.1
        ➤ YN0000: ┌ Resolution step
        ➤ YN0085: │ + @chromatic-com/storybook@npm:1.2.25, and 300 more.
        ➤ YN0000: └ Completed in 0s 763ms
        ➤ YN0000: ┌ Post-resolution validation
        ➤ YN0002: │ before-storybook@workspace:. doesn't provide @testing-library/dom (p1ac37), requested by @testing-library/user-event.
        ➤ YN0002: │ before-storybook@workspace:. doesn't provide eslint (p1f657), requested by eslint-plugin-storybook.
        ➤ YN0086: │ Some peer dependencies are incorrectly met; run yarn explain peer-requirements <hash> for details, where <hash> is the six-letter p-prefixed code.
        ➤ YN0000: └ Completed
        ➤ YN0000: ┌ Fetch step
        ➤ YN0000: └ Completed
        ➤ YN0000: ┌ Link step
        ➤ YN0014: │ Failed to import certain dependencies
        ➤ YN0071: │ Cannot link @storybook/test into before-storybook@workspace:. dependency @testing-library/jest-dom@npm:6.4.2 [ae73b] conflicts with parent dependency @testing-library/jest-dom@npm:5.17.0
        ➤ YN0071: │ Cannot link @storybook/test into before-storybook@workspace:. dependency @testing-library/user-event@npm:14.5.2 [ae73b] conflicts with parent dependency @testing-library/user-event@npm:13.5.0 [1b0ac]
        ➤ YN0000: └ Completed in 0s 262ms
        ➤ YN0000: · Failed with errors in 1s 301ms
      `;

      expect(yarn2Proxy.parseErrorFromLogs(YARN2_ERROR_SAMPLE)).toMatchInlineSnapshot(
        `
        "YARN2 error
        YN0002: MISSING_PEER_DEPENDENCY
        -> before-storybook@workspace:. doesn't provide @testing-library/dom (p1ac37), requested by @testing-library/user-event.

        YN0002: MISSING_PEER_DEPENDENCY
        -> before-storybook@workspace:. doesn't provide eslint (p1f657), requested by eslint-plugin-storybook.

        YN0086: EXPLAIN_PEER_DEPENDENCIES_CTA
        -> Some peer dependencies are incorrectly met; run yarn explain peer-requirements <hash> for details, where <hash> is the six-letter p-prefixed code.

        YN0014: YARN_IMPORT_FAILED
        -> Failed to import certain dependencies

        YN0071: NM_CANT_INSTALL_EXTERNAL_SOFT_LINK
        -> Cannot link @storybook/test into before-storybook@workspace:. dependency @testing-library/jest-dom@npm:6.4.2 [ae73b] conflicts with parent dependency @testing-library/jest-dom@npm:5.17.0

        YN0071: NM_CANT_INSTALL_EXTERNAL_SOFT_LINK
        -> Cannot link @storybook/test into before-storybook@workspace:. dependency @testing-library/user-event@npm:14.5.2 [ae73b] conflicts with parent dependency @testing-library/user-event@npm:13.5.0 [1b0ac]
        "
      `
      );
    });
  });
});
