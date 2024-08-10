import { describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import stripAnsi from 'strip-ansi';

import { missingStorybookDependencies } from './missing-storybook-dependencies';

vi.mock('globby', () => ({
  __esModule: true,
  globby: vi.fn().mockResolvedValue(['.storybook/manager.ts', 'path/to/file.stories.tsx']),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('node:fs/promises');
  return {
    ...original,
    readFile: vi.fn().mockResolvedValue(`
    // these are NOT installed, will be reported
    import { someFunction } from '@storybook/preview-api';
    import { anotherFunction } from '@storybook/manager-api';
    import { SomeError } from '@storybook/core-events/server-errors';
    // this IS installed, will not be reported
    import { yetAnotherFunction } from '@storybook/theming';
  `),
  };
});

vi.mock('../../helpers', () => ({
  getStorybookVersionSpecifier: vi.fn().mockReturnValue('^8.1.10'),
}));

const check = async ({
  packageManager,
  storybookVersion = '8.1.10',
}: {
  packageManager: JsPackageManager;
  storybookVersion?: string;
}) => {
  return missingStorybookDependencies.check({
    packageManager,
    mainConfig: {} as any,
    storybookVersion,
  });
};

describe('missingStorybookDependencies', () => {
  const mockPackageManager = {
    findInstallations: vi.fn().mockResolvedValue({
      dependencies: {
        '@storybook/react': '8.1.0',
        '@storybook/theming': '8.1.0',
      },
    }),
    retrievePackageJson: vi.fn().mockResolvedValue({
      dependencies: {
        '@storybook/core': '8.1.0',
      },
    }),
    addDependencies: vi.fn().mockResolvedValue(undefined),
  } as Partial<JsPackageManager>;

  describe('check function', () => {
    it('should identify missing dependencies', async () => {
      const result = await check({
        packageManager: mockPackageManager as JsPackageManager,
      });

      expect(Object.keys(result!.packageUsage)).not.includes('@storybook/theming');
      expect(result).toEqual({
        packageUsage: {
          '@storybook/preview-api': ['.storybook/manager.ts', 'path/to/file.stories.tsx'],
          '@storybook/manager-api': ['.storybook/manager.ts', 'path/to/file.stories.tsx'],
          '@storybook/core-events': ['.storybook/manager.ts', 'path/to/file.stories.tsx'],
        },
      });
    });
  });

  describe('prompt function', () => {
    it('should provide a proper message with the missing dependencies', () => {
      const packageUsage = {
        '@storybook/preview-api': ['.storybook/manager.ts'],
        '@storybook/manager-api': ['path/to/file.stories.tsx'],
      };

      const message = missingStorybookDependencies.prompt({ packageUsage });

      expect(stripAnsi(message)).toMatchInlineSnapshot(`
        "Found the following Storybook packages used in your project, but they are missing from your project dependencies:
        - @storybook/manager-api: (1 file)
        - @storybook/preview-api: (1 file)

        Referencing missing packages can cause your project to crash. We can automatically add them to your dependencies.

        More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#failed-to-resolve-import-storybookx-error"
      `);
    });
  });

  describe('run function', () => {
    it('should add missing dependencies', async () => {
      const dryRun = false;
      const packageUsage = {
        '@storybook/preview-api': ['.storybook/manager.ts'],
        '@storybook/manager-api': ['path/to/file.stories.tsx'],
      };

      await missingStorybookDependencies.run!({
        result: { packageUsage },
        dryRun,
        packageManager: mockPackageManager as JsPackageManager,
        mainConfigPath: 'path/to/main-config.js',
      });

      expect(mockPackageManager.addDependencies).toHaveBeenNthCalledWith(
        1,
        { installAsDevDependencies: true },
        ['@storybook/preview-api@8.1.0', '@storybook/manager-api@8.1.0']
      );
      expect(mockPackageManager.addDependencies).toHaveBeenNthCalledWith(
        2,
        { installAsDevDependencies: true, skipInstall: true, packageJson: expect.anything() },
        ['@storybook/preview-api@8.1.0', '@storybook/manager-api@8.1.0']
      );
    });
  });
});
