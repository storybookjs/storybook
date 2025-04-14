import type { MockInstance } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import * as detect from 'storybook/internal/cli';

import { wrapRequire } from './wrap-require';

vi.mock('storybook/internal/cli', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/cli')>()),
  detectPnp: vi.fn(),
}));

describe('wrapRequire', () => {
  describe('check', () => {
    it('should return null if not in a monorepo and pnp is not enabled', async () => {
      (detect.detectPnp as any as MockInstance).mockResolvedValue(false);

      const check = wrapRequire.check({
        packageManager: {
          isStorybookInMonorepo: () => false,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
      } as any);

      await expect(check).resolves.toBeNull();
    });

    it('should return the configuration object if in a pnp environment', async () => {
      (detect.detectPnp as any as MockInstance).mockResolvedValue(true);

      const check = wrapRequire.check({
        packageManager: {
          isStorybookInMonorepo: () => false,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
      } as any);

      await expect(check).resolves.toEqual({
        isConfigTypescript: false,
        isPnp: true,
        isStorybookInMonorepo: false,
        storybookVersion: '7.0.0',
      });
    });

    it('should return the configuration object if in a monorepo environment', async () => {
      (detect.detectPnp as any as MockInstance).mockResolvedValue(false);

      const check = wrapRequire.check({
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-without-wrappers.js'),
      } as any);

      await expect(check).resolves.toEqual({
        isConfigTypescript: false,
        isPnp: false,
        isStorybookInMonorepo: true,
        storybookVersion: '7.0.0',
      });
    });

    it('should return null, if all fields have the require wrapper', async () => {
      (detect.detectPnp as any as MockInstance).mockResolvedValue(true);

      const check = wrapRequire.check({
        packageManager: {
          isStorybookInMonorepo: () => true,
        },
        storybookVersion: '7.0.0',
        mainConfigPath: require.resolve('./__test__/main-config-with-wrappers.js'),
      } as any);

      await expect(check).resolves.toBeNull();
    });
  });
});
