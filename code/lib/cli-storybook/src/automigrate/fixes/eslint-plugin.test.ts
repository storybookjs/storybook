import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as cliImports from 'storybook/internal/cli';
import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { join } from 'pathe';

import { checkFix } from '../helpers/fix-test-utils.ts';
import { makePackageManager } from '../helpers/testing-helpers.ts';
import { eslintPlugin } from './eslint-plugin.ts';

const defaultHasEslintValues = {
  hasEslint: false,
  eslintConfigFile: undefined,
  isStorybookPluginInstalled: false,
  isFlatConfig: false,
  unsupportedExtension: undefined,
};

const checkEslint = async ({ packageJson }: { packageJson: PackageJson }) => {
  return checkFix(eslintPlugin, {
    packageManager: makePackageManager(packageJson),
    mainConfig: {} as any,
    storybookVersion: '7.0.0',
    storiesPaths: [],
  });
};

describe('eslint-plugin fix', () => {
  beforeEach(() => {
    vi.spyOn(cliImports, 'extractEslintInfo').mockClear();
  });

  describe('should skip migration when', () => {
    it('project does not have eslint installed', async () => {
      const packageJson = { dependencies: {} };
      vi.spyOn(cliImports, 'extractEslintInfo').mockImplementation(async () => {
        return { ...defaultHasEslintValues, hasEslint: false };
      });

      await expect(
        checkEslint({
          packageJson,
        })
      ).resolves.toBeFalsy();
    });

    it('project already contains eslint-plugin-storybook dependency', async () => {
      const packageJson = { dependencies: { 'eslint-plugin-storybook': '^0.0.0' } };

      vi.spyOn(cliImports, 'extractEslintInfo').mockImplementation(async () => {
        return { ...defaultHasEslintValues, hasEslint: true, isStorybookPluginInstalled: true };
      });

      await expect(
        checkEslint({
          packageJson,
        })
      ).resolves.toBeFalsy();
    });
  });

  describe('when project does not contain eslint-plugin-storybook but has eslint installed', () => {
    const packageJson = { dependencies: { '@storybook/react': '^6.2.0', eslint: '^7.0.0' } };

    describe('should no-op when', () => {
      it('.eslintrc is not found', async () => {
        const loggerSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        vi.spyOn(cliImports, 'extractEslintInfo').mockImplementation(async () => {
          return { ...defaultHasEslintValues, hasEslint: true, eslintConfigFile: undefined };
        });

        const result = await checkEslint({
          packageJson,
        });

        expect(loggerSpy).not.toHaveBeenCalled();

        expect(result).toBeFalsy();
        loggerSpy.mockRestore();
      });
    });
  });

  describe('run', () => {
    it('adds the plugin to the package that owns the eslint config', async () => {
      const root = mkdtempSync(join(tmpdir(), 'sb-eslint-plugin-'));
      const eslintConfigFile = join(root, 'eslint.config.mjs');
      writeFileSync(join(root, 'package.json'), JSON.stringify({ devDependencies: {} }));
      writeFileSync(eslintConfigFile, 'export default [];');
      mkdirSync(join(root, 'storybook'));
      writeFileSync(
        join(root, 'storybook', 'package.json'),
        JSON.stringify({ devDependencies: {} })
      );

      const addDependencies = vi.fn().mockResolvedValue(undefined);
      const packageManager = {
        ...makePackageManager({ devDependencies: {} }),
        addDependencies,
      } as unknown as JsPackageManager;

      vi.spyOn(cliImports, 'configureEslintPlugin').mockResolvedValue(undefined);

      await eslintPlugin.run!({
        packageManager,
        result: { eslintConfigFile, isFlatConfig: true },
        mainConfig: {} as any,
        configDir: join(root, 'storybook'),
        storybookVersion: '7.0.0',
        storiesPaths: [],
        files: {} as any,
      } as any);

      expect(addDependencies).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'devDependencies',
          skipInstall: true,
          packageJsonInfo: expect.objectContaining({
            packageJsonPath: join(root, 'package.json'),
          }),
        }),
        ['eslint-plugin-storybook@7.0.0']
      );
    });
  });
});
