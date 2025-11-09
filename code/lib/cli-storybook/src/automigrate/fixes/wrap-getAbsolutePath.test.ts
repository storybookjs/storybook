import type { MockInstance } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import * as detect from 'storybook/internal/cli';

import type { RunOptions } from '../types';
import { type WrapGetAbsolutePathRunOptions, wrapGetAbsolutePath } from './wrap-getAbsolutePath';

vi.mock('storybook/internal/cli', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/cli')>()),
  detectPnp: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  writeFile: vi.fn(),
}));

describe('wrapGetAbsolutePath', () => {
  describe('check', () => {
    it('should return null if not in a monorepo and pnp is not enabled', async () => {
      (detect.detectPnp as any as MockInstance).mockResolvedValue(false);

      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => false,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
      } as RunOptions<WrapGetAbsolutePathRunOptions>);

      await expect(check).resolves.toBeNull();
    });

    it('should return the configuration object if in a pnp environment', async () => {
      (detect.detectPnp as any as MockInstance).mockResolvedValue(true);

      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => false,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
      } as RunOptions<WrapGetAbsolutePathRunOptions>);

      await expect(check).resolves.toEqual({
        isConfigTypescript: false,
        isPnp: true,
        isStorybookInMonorepo: false,
        storybookVersion: '7.0.0',
      });
    });

    it('should return the configuration object if in a monorepo environment', async () => {
      (detect.detectPnp as any as MockInstance).mockResolvedValue(false);

      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
      } as RunOptions<WrapGetAbsolutePathRunOptions>);

      await expect(check).resolves.toEqual({
        isConfigTypescript: false,
        isPnp: false,
        isStorybookInMonorepo: true,
        storybookVersion: '7.0.0',
      });
    });

    it('should return null, if all fields have the require wrapper', async () => {
      (detect.detectPnp as any as MockInstance).mockResolvedValue(true);

      const check = wrapGetAbsolutePath.check({
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-with-wrappers.js'),
      } as RunOptions<WrapGetAbsolutePathRunOptions>);

      await expect(check).resolves.toBeNull();
    });
  });

  describe('run', () => {
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
        "import { fileURLToPath } from "node:url";
        import { dirname } from "node:path";
        const config = {
          stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
          addons: [
            {
              name: getAbsolutePath("@chromatic-com/storybook"),
              options: {},
            },
            getAbsolutePath("@storybook/addon-vitest"),
          ],
          framework: {
            name: getAbsolutePath("@storybook/angular"),
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
