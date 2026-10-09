import { beforeEach, describe, expect, it, vi } from 'vitest';

import { babelParse } from 'storybook/internal/babel';
import { formatExistingFile } from 'storybook/internal/common';

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
    vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
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

    it('renames its dirname import when the main config already declares dirname', async () => {
      await runFix(wrapGetAbsolutePath, {
        mainConfigPath: require.resolve('./__test__/main-config-with-own-dirname.js'),
        storiesPaths: [],
        result: {},
      } as unknown as Omit<RunOptions<object>, 'files'>);

      const writeFile = vi.mocked((await import('node:fs/promises')).writeFile);
      const output = String(writeFile.mock.calls.at(-1)?.[1]);

      expect(() => babelParse(output)).not.toThrow();
      expect(output).toMatchInlineSnapshot(`
        "import { dirname as pathDirname } from 'node:path';
        import path from 'node:path';
        import { fileURLToPath } from 'node:url';

        const dirname = path.dirname(fileURLToPath(import.meta.url));

        const config = {
          stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
          addons: [getAbsolutePath('@storybook/addon-vitest')],
          framework: getAbsolutePath('@storybook/react-vite'),
          viteFinal: (viteConfig) => ({ ...viteConfig, root: path.resolve(dirname, '..') }),
        };
        export default config;

        function getAbsolutePath(value) {
          return pathDirname(fileURLToPath(import.meta.resolve(\`\${value}/package.json\`)));
        }
        "
      `);
    });

    it('keeps the wrapper parameter from shadowing an import aliased as value', async () => {
      await runFix(wrapGetAbsolutePath, {
        mainConfigPath: require.resolve('./__test__/main-config-with-aliased-dirname.js'),
        storiesPaths: [],
        result: {},
      } as unknown as Omit<RunOptions<object>, 'files'>);

      const writeFile = vi.mocked((await import('node:fs/promises')).writeFile);
      const output = String(writeFile.mock.calls.at(-1)?.[1]);

      expect(output).toMatchInlineSnapshot(`
        "import { fileURLToPath } from 'node:url';
        import { dirname as value } from 'node:path';

        const config = {
          stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
          framework: getAbsolutePath('@storybook/react-vite'),
          viteFinal: (viteConfig) => ({ ...viteConfig, root: value(import.meta.url) }),
        };
        export default config;

        function getAbsolutePath(_value) {
          return value(fileURLToPath(import.meta.resolve(\`\${_value}/package.json\`)));
        }
        "
      `);
    });

    it('renames its dirname import when the main config destructures dirname', async () => {
      await runFix(wrapGetAbsolutePath, {
        mainConfigPath: require.resolve('./__test__/main-config-with-destructured-dirname.js'),
        storiesPaths: [],
        result: {},
      } as unknown as Omit<RunOptions<object>, 'files'>);

      const writeFile = vi.mocked((await import('node:fs/promises')).writeFile);
      const output = String(writeFile.mock.calls.at(-1)?.[1]);

      expect(() => babelParse(output)).not.toThrow();
      expect(output).toMatchInlineSnapshot(`
        "import { fileURLToPath } from 'node:url';
        import { dirname as pathDirname } from 'node:path';
        import path from 'node:path';

        const { dirname } = path;

        const config = {
          stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
          framework: getAbsolutePath('@storybook/react-vite'),
          viteFinal: (viteConfig) => ({ ...viteConfig, root: dirname(import.meta.url) }),
        };
        export default config;

        function getAbsolutePath(value) {
          return pathDirname(fileURLToPath(import.meta.resolve(\`\${value}/package.json\`)));
        }
        "
      `);
    });

    it('reuses a dirname import from the unprefixed path module', async () => {
      await runFix(wrapGetAbsolutePath, {
        mainConfigPath: require.resolve('./__test__/main-config-with-unprefixed-dirname.js'),
        storiesPaths: [],
        result: {},
      } as unknown as Omit<RunOptions<object>, 'files'>);

      const writeFile = vi.mocked((await import('node:fs/promises')).writeFile);
      const output = String(writeFile.mock.calls.at(-1)?.[1]);

      expect(output).toMatchInlineSnapshot(`
        "import { fileURLToPath } from 'node:url';
        import { dirname as pathDirname } from 'path';

        const config = {
          stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
          framework: getAbsolutePath('@storybook/react-vite'),
          viteFinal: (viteConfig) => ({ ...viteConfig, root: pathDirname(import.meta.url) }),
        };
        export default config;

        function getAbsolutePath(value) {
          return pathDirname(fileURLToPath(import.meta.resolve(\`\${value}/package.json\`)));
        }
        "
      `);
    });
  });
});
