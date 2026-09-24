import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectAgent } from 'storybook/internal/telemetry';

import type { CheckOptions, RunOptions } from '../types.ts';
import { type WrapGetAbsolutePathRunOptions, wrapGetAbsolutePath } from './wrap-getAbsolutePath.ts';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  writeFile: vi.fn(),
}));
vi.mock('storybook/internal/telemetry', { spy: true });

describe('wrapGetAbsolutePath', () => {
  beforeEach(() => {
    vi.mocked(detectAgent).mockReturnValue(undefined);
  });

  describe('check', () => {
    it('should return the configuration object for an AI upgrade with a custom package resolver', async () => {
      vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });

      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-with-custom-resolver.ts'),
      } as CheckOptions);

      await expect(check).resolves.toEqual({
        isConfigTypescript: true,
        isStorybookInMonorepo: true,
        storybookVersion: '7.0.0',
      });
    });

    it('should retain the custom package resolver refusal outside an AI upgrade', async () => {
      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-with-custom-resolver.ts'),
      } as CheckOptions);

      await expect(check).resolves.toBeNull();
    });

    it('should return null if not in a monorepo', async () => {
      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => false,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
      } as CheckOptions);

      await expect(check).resolves.toBeNull();
    });

    it('should return the configuration object if in a monorepo environment', async () => {
      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
      } as CheckOptions);

      await expect(check).resolves.toEqual({
        isConfigTypescript: false,
        isStorybookInMonorepo: true,
        storybookVersion: '7.0.0',
      });
    });

    it('should return null, if all fields have the require wrapper', async () => {
      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-with-wrappers.js'),
      } as CheckOptions);

      await expect(check).resolves.toBeNull();
    });
  });

  describe('run', () => {
    it('should add the helper for an AI upgrade with a custom package resolver', async () => {
      const writeFile = vi.mocked((await import('node:fs/promises')).writeFile);
      writeFile.mockClear();

      await wrapGetAbsolutePath.run?.({
        mainConfigPath: require.resolve('./__test__/main-config-with-custom-resolver.ts'),
        result: {
          isConfigTypescript: true,
        },
      } as RunOptions<WrapGetAbsolutePathRunOptions>);

      expect(writeFile.mock.calls[0][1]).toMatchInlineSnapshot(`
        "import { fileURLToPath } from 'node:url';
        import { dirname } from 'node:path';
        import { resolvePackage } from './resolve-package.ts';

        export default {
          framework: resolvePackage('@storybook/react-vite'),
        };

        function getAbsolutePath(value: string): any {
          return dirname(fileURLToPath(import.meta.resolve(\`\${value}/package.json\`)));
        }
        "
      `);
    });

    it('should wrap the require wrapper', async () => {
      await wrapGetAbsolutePath.run?.({
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
        result: {
          isConfigTypescript: false,
        },
      } as RunOptions<WrapGetAbsolutePathRunOptions>);

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
