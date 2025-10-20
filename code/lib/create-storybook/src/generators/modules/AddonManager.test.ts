import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddonManager } from './AddonManager';

vi.mock('storybook/internal/common', async () => {
  const actual = await vi.importActual('storybook/internal/common');
  return {
    ...actual,
    getPackageDetails: vi.fn().mockImplementation((pkg: string) => {
      const match = pkg.match(/^(@?[^@]+)(?:@(.+))?$/);
      return match ? [match[1], match[2]] : [pkg, undefined];
    }),
  };
});

describe('AddonManager', () => {
  let manager: AddonManager;

  beforeEach(() => {
    manager = new AddonManager();
  });

  describe('getWebpackCompilerAddon', () => {
    it('should return undefined when no compiler function provided', () => {
      const result = manager.getWebpackCompilerAddon('webpack5', undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when compiler function returns undefined', () => {
      const webpackCompiler = vi.fn().mockReturnValue(undefined);
      const result = manager.getWebpackCompilerAddon('webpack5', webpackCompiler);
      expect(result).toBeUndefined();
    });

    it('should return swc compiler addon', () => {
      const webpackCompiler = vi.fn().mockReturnValue('swc');
      const result = manager.getWebpackCompilerAddon('webpack5', webpackCompiler);
      expect(result).toBe('@storybook/addon-webpack5-compiler-swc');
    });

    it('should return babel compiler addon', () => {
      const webpackCompiler = vi.fn().mockReturnValue('babel');
      const result = manager.getWebpackCompilerAddon('webpack5', webpackCompiler);
      expect(result).toBe('@storybook/addon-webpack5-compiler-babel');
    });
  });

  describe('getAddonsForFeatures', () => {
    it('should return empty array for no features', () => {
      const addons = manager.getAddonsForFeatures([]);
      expect(addons).toEqual([]);
    });

    it('should add chromatic addon for test feature', () => {
      const addons = manager.getAddonsForFeatures(['test']);
      expect(addons).toContain('@chromatic-com/storybook');
    });

    it('should add docs addon for docs feature', () => {
      const addons = manager.getAddonsForFeatures(['docs']);
      expect(addons).toContain('@storybook/addon-docs');
    });

    it('should add onboarding addon for onboarding feature', () => {
      const addons = manager.getAddonsForFeatures(['onboarding']);
      expect(addons).toContain('@storybook/addon-onboarding');
    });

    it('should add all addons for all features', () => {
      const addons = manager.getAddonsForFeatures(['docs', 'test', 'onboarding']);
      expect(addons).toContain('@storybook/addon-docs');
      expect(addons).toContain('@chromatic-com/storybook');
      expect(addons).toContain('@storybook/addon-onboarding');
    });

    it('should include extra addons', () => {
      const addons = manager.getAddonsForFeatures(['docs'], ['@storybook/addon-links']);
      expect(addons).toContain('@storybook/addon-links');
      expect(addons).toContain('@storybook/addon-docs');
    });
  });

  describe('stripVersions', () => {
    it('should strip version from addon names', () => {
      const addons = ['@storybook/addon-essentials@8.0.0', '@storybook/addon-links@8.0.0'];
      const stripped = manager.stripVersions(addons);

      expect(stripped).toEqual(['@storybook/addon-essentials', '@storybook/addon-links']);
    });

    it('should handle addons without versions', () => {
      const addons = ['@storybook/addon-essentials', '@storybook/addon-links'];
      const stripped = manager.stripVersions(addons);

      expect(stripped).toEqual(['@storybook/addon-essentials', '@storybook/addon-links']);
    });
  });

  describe('configureAddons', () => {
    it('should configure addons without compiler', () => {
      const config = manager.configureAddons(['docs', 'test'], [], 'vite', undefined);

      expect(config.addonsForMain).toContain('@storybook/addon-docs');
      expect(config.addonsForMain).toContain('@chromatic-com/storybook');
      expect(config.addonPackages).toContain('@storybook/addon-docs');
      expect(config.addonPackages).toContain('@chromatic-com/storybook');
    });

    it('should include compiler addon when specified', () => {
      const webpackCompiler = vi.fn().mockReturnValue('swc');
      const config = manager.configureAddons(['docs'], [], 'webpack5', webpackCompiler);

      expect(config.addonsForMain).toContain('@storybook/addon-webpack5-compiler-swc');
      expect(config.addonPackages).toContain('@storybook/addon-webpack5-compiler-swc');
    });

    it('should strip versions from addons in main config', () => {
      const config = manager.configureAddons(
        ['docs'],
        ['@storybook/addon-links@8.0.0'],
        'vite',
        undefined
      );

      expect(config.addonsForMain).toContain('@storybook/addon-links');
      expect(config.addonsForMain).not.toContain('@storybook/addon-links@8.0.0');
    });

    it('should keep versions in addon packages', () => {
      const config = manager.configureAddons(
        ['test'],
        ['@storybook/addon-links@8.0.0'],
        'vite',
        undefined
      );

      expect(config.addonPackages).toContain('@storybook/addon-links@8.0.0');
    });

    it('should handle all features together', () => {
      const webpackCompiler = vi.fn().mockReturnValue('swc');
      const config = manager.configureAddons(
        ['docs', 'test', 'onboarding'],
        ['@storybook/addon-links'],
        'webpack5',
        webpackCompiler
      );

      expect(config.addonsForMain).toHaveLength(7); // compiler + links + docs + chromatic + vitest + a11y + onboarding
      expect(config.addonPackages).toHaveLength(7);
    });

    it('should filter out falsy values', () => {
      const config = manager.configureAddons([], [], 'vite', undefined);

      expect(config.addonsForMain).not.toContain(undefined);
      expect(config.addonsForMain).not.toContain(null);
      expect(config.addonPackages).not.toContain(undefined);
      expect(config.addonPackages).not.toContain(null);
    });
  });
});
