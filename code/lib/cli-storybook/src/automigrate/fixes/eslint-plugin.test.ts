/* eslint-disable no-underscore-dangle */
import * as fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { PackageJson } from 'storybook/internal/common';

import * as fsExtra from 'fs-extra';
import { dedent } from 'ts-dedent';

import { makePackageManager } from '../helpers/testing-helpers';
import { eslintPlugin } from './eslint-plugin';

vi.mock('fs-extra', async () => import('../../../../../__mocks__/fs-extra'));
vi.mock('fs');

const checkEslint = async ({
  packageJson,
  hasEslint = true,
  eslintExtension = 'js',
}: {
  packageJson: PackageJson;
  hasEslint?: boolean;
  eslintExtension?: string;
}) => {
  vi.mocked<typeof import('../../../../../__mocks__/fs-extra')>(fsExtra as any).__setMockFiles({
    [`.eslintrc.${eslintExtension}`]: !hasEslint
      ? null
      : dedent(`
      module.exports = {
        extends: ['plugin:react/recommended', 'airbnb-typescript', 'plugin:prettier/recommended'],
        parser: '@typescript-eslint/parser',
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
          ecmaVersion: 12,
          sourceType: 'module',
          project: 'tsconfig.eslint.json',
        },
        plugins: ['react', '@typescript-eslint'],
        rules: {
          'some/rule': 'warn',
        },
      }
    `),
  });
  vi.mocked(fs).existsSync.mockImplementation(() => true);
  return eslintPlugin.check({
    packageManager: makePackageManager(packageJson),
    mainConfig: {} as any,
    storybookVersion: '7.0.0',
  });
};

describe('eslint-plugin fix', () => {
  describe('should skip migration when', () => {
    it('project does not have eslint installed', async () => {
      const packageJson = { dependencies: {} };

      await expect(
        checkEslint({
          packageJson,
          hasEslint: false,
        })
      ).resolves.toBeFalsy();
    });

    it('project already contains eslint-plugin-storybook dependency', async () => {
      const packageJson = { dependencies: { 'eslint-plugin-storybook': '^0.0.0' } };

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
        const loggerSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await checkEslint({
          packageJson,
          hasEslint: false,
        });

        expect(loggerSpy).toHaveBeenCalledWith('Unable to find .eslintrc config file, skipping');

        await expect(result).toBeFalsy();
        loggerSpy.mockRestore();
      });
    });

    describe('should install eslint plugin', () => {
      it('when .eslintrc is using a supported extension', async () => {
        await expect(
          checkEslint({
            packageJson,
          })
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `[Error: warn: Unable to find .eslintrc config file, skipping]`
        );
      });

      it('when .eslintrc is using unsupported extension', async () => {
        await expect(
          checkEslint({
            packageJson,
            eslintExtension: 'yml',
          })
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `[Error: warn: Unable to find .eslintrc config file, skipping]`
        );
      });
    });
  });
});
