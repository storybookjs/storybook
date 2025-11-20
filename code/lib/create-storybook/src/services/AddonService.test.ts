import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Feature, SupportedBuilder } from 'storybook/internal/types';

import { AddonService } from './AddonService';

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

describe('AddonService', () => {
  let manager: AddonService;

  beforeEach(() => {
    manager = new AddonService();
  });

  describe('getWebpackCompilerAddon', () => {
    it('should return undefined when no compiler function provided', () => {
      const result = manager.getWebpackCompilerAddon(SupportedBuilder.WEBPACK5, undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when compiler function returns undefined', () => {
      const webpackCompiler = vi.fn().mockReturnValue(undefined);
      const result = manager.getWebpackCompilerAddon(SupportedBuilder.WEBPACK5, webpackCompiler);
      expect(result).toBeUndefined();
    });

    it('should return swc compiler addon', () => {
      const webpackCompiler = vi.fn().mockReturnValue('swc');
      const result = manager.getWebpackCompilerAddon(SupportedBuilder.WEBPACK5, webpackCompiler);
      expect(result).toBe('@storybook/addon-webpack5-compiler-swc');
    });

    it('should return babel compiler addon', () => {
      const webpackCompiler = vi.fn().mockReturnValue('babel');
      const result = manager.getWebpackCompilerAddon(SupportedBuilder.WEBPACK5, webpackCompiler);
      expect(result).toBe('@storybook/addon-webpack5-compiler-babel');
    });
  });

  describe('getAddonsForFeatures', () => {
    it('should return empty array for no features', () => {
      const addons = manager.getAddonsForFeatures(new Set([]));
      expect(addons).toEqual([]);
    });

    it('should add chromatic and vitest addons for test feature', () => {
      const addons = manager.getAddonsForFeatures(new Set([Feature.TEST]));
      expect(addons).toContain('@chromatic-com/storybook');
      expect(addons).toContain('@storybook/addon-vitest');
    });

    it('should add docs addon for docs feature', () => {
      const addons = manager.getAddonsForFeatures(new Set([Feature.DOCS]));
      expect(addons).toContain('@storybook/addon-docs');
    });

    it('should add a11y addon for a11y feature', () => {
      const addons = manager.getAddonsForFeatures(new Set([Feature.A11Y]));
      expect(addons).toContain('@storybook/addon-a11y');
    });

    it('should add all addons for all features', () => {
      const addons = manager.getAddonsForFeatures(
        new Set([Feature.DOCS, Feature.TEST, Feature.ONBOARDING, Feature.A11Y])
      );
      expect(addons).toContain('@storybook/addon-docs');
      expect(addons).toContain('@chromatic-com/storybook');
      expect(addons).toContain('@storybook/addon-vitest');
      expect(addons).toContain('@storybook/addon-a11y');
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
    it('should include compiler addon when specified', () => {
      const webpackCompiler = vi.fn().mockReturnValue('swc');
      const config = manager.configureAddons(
        new Set([Feature.DOCS]),
        [],
        SupportedBuilder.WEBPACK5,
        webpackCompiler
      );

      expect(config.addonsForMain).toContain('@storybook/addon-webpack5-compiler-swc');
      expect(config.addonPackages).toContain('@storybook/addon-webpack5-compiler-swc');
    });

    it('should strip versions from addons in main config', () => {
      const config = manager.configureAddons(
        new Set([Feature.DOCS]),
        ['@storybook/addon-links@8.0.0'],
        SupportedBuilder.VITE,
        undefined
      );

      expect(config.addonsForMain).toContain('@storybook/addon-links');
      expect(config.addonsForMain).not.toContain('@storybook/addon-links@8.0.0');
    });

    it('should keep versions in addon packages', () => {
      const config = manager.configureAddons(
        new Set([Feature.TEST]),
        ['@storybook/addon-links@8.0.0'],
        SupportedBuilder.VITE,
        undefined
      );

      expect(config.addonPackages).toContain('@storybook/addon-links@8.0.0');
    });

    it('should handle all features together', () => {
      const webpackCompiler = vi.fn().mockReturnValue('swc');
      const config = manager.configureAddons(
        new Set([Feature.DOCS, Feature.TEST, Feature.ONBOARDING, Feature.A11Y]),
        ['@storybook/addon-links'],
        SupportedBuilder.WEBPACK5,
        webpackCompiler
      );

      expect(config.addonsForMain).toHaveLength(2); // compiler + links
      expect(config.addonPackages).toHaveLength(2); // compiler + links
      expect(config.addonsForMain).toContain('@storybook/addon-webpack5-compiler-swc');
      expect(config.addonsForMain).toContain('@storybook/addon-links');
    });

    it('should filter out falsy values', () => {
      const config = manager.configureAddons(new Set([]), [], SupportedBuilder.VITE, undefined);

      expect(config.addonsForMain).not.toContain(undefined);
      expect(config.addonsForMain).not.toContain(null);
      expect(config.addonPackages).not.toContain(undefined);
      expect(config.addonPackages).not.toContain(null);
    });
  });
});
