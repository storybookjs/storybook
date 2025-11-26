import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as cliImports from 'storybook/internal/cli';
import type { PackageJson } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { makePackageManager } from '../helpers/testing-helpers';
import { eslintPlugin } from './eslint-plugin';

const defaultHasEslintValues = {
  hasEslint: false,
  eslintConfigFile: undefined,
  isStorybookPluginInstalled: false,
  isFlatConfig: false,
  unsupportedExtension: undefined,
};

const checkEslint = async ({ packageJson }: { packageJson: PackageJson }) => {
  return eslintPlugin.check({
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

    describe('should no-op and warn when', () => {
      it('.eslintrc is not found', async () => {
        const loggerSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        vi.spyOn(cliImports, 'extractEslintInfo').mockImplementation(async () => {
          return { ...defaultHasEslintValues, hasEslint: true, eslintConfigFile: undefined };
        });

        const result = await checkEslint({
          packageJson,
        });

        expect(loggerSpy).toHaveBeenCalledWith('Unable to find eslint config file, skipping');

        expect(result).toBeFalsy();
        loggerSpy.mockRestore();
      });
    });
  });
});
