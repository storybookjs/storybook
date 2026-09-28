import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatFileContent } from 'storybook/internal/common';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import { wrapGetAbsolutePath } from './wrap-getAbsolutePath.ts';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  writeFile: vi.fn(),
}));

vi.mock('storybook/internal/common', { spy: true });

describe('wrapGetAbsolutePath', () => {
  beforeEach(() => {
    vi.mocked(formatFileContent).mockImplementation(async (_path, source) => source);
  });

  describe('check', () => {
    it('should return null if not in a monorepo', async () => {
      const check = checkFix(wrapGetAbsolutePath, {
        packageManager: {
          isStorybookInMonorepo: () => false,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
        storiesPaths: [],
      } as unknown as Omit<CheckOptions, 'files'>);

      await expect(check).resolves.toBeNull();
    });

    it('should return the configuration object if in a monorepo environment', async () => {
      const check = checkFix(wrapGetAbsolutePath, {
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
        storiesPaths: [],
      } as unknown as Omit<CheckOptions, 'files'>);

      await expect(check).resolves.toEqual({});
    });

    it('should return null, if all fields have the require wrapper', async () => {
      const check = checkFix(wrapGetAbsolutePath, {
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-with-wrappers.js'),
        storiesPaths: [],
      } as unknown as Omit<CheckOptions, 'files'>);

      await expect(check).resolves.toBeNull();
    });
  });

  describe('run', () => {
    it('should wrap the require wrapper', async () => {
      await runFix(wrapGetAbsolutePath, {
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
        storiesPaths: [],
        result: {},
      } as unknown as Omit<RunOptions<object>, 'files'>);

      const writeFile = vi.mocked((await import('node:fs/promises')).writeFile);

      const call = writeFile.mock.calls[0];

      expect(call[1]).toMatchInlineSnapshot(`
        "import { fileURLToPath } from 'node:url';
        import { dirname } from 'node:path';
        const config = {
          stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
          addons: [
            {
              name: getAbsolutePath('@chromatic-com/storybook'),
              options: {},
            },
            getAbsolutePath('@storybook/addon-vitest'),
          ],
          framework: {
            name: getAbsolutePath('@storybook/angular'),
            options: {},
          },
          docs: {
            autodocs: 'tag',
          },
        };
        export default config;

        function getAbsolutePath(value) {
          return dirname(fileURLToPath(import.meta.resolve(\`\${value}/package.json\`)));
        }
        "
      `);
    });
  });
});
