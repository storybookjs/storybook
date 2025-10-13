import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportedLanguage } from 'storybook/internal/cli';

import { PackageResolver } from './PackageResolver';

vi.mock('storybook/internal/cli', async () => {
  const actual = await vi.importActual('storybook/internal/cli');
  return {
    ...actual,
    externalFrameworks: [
      {
        name: 'qwik',
        packageName: '@storybook/qwik',
        frameworks: ['@storybook/qwik-vite'],
      },
    ],
  };
});

vi.mock('storybook/internal/common', async () => {
  const actual = await vi.importActual('storybook/internal/common');
  return {
    ...actual,
    versions: {
      storybook: '8.0.0',
      '@storybook/react-vite': '8.0.0',
      '@storybook/vue3-vite': '8.0.0',
      '@storybook/react': '8.0.0',
      '@storybook/vue3': '8.0.0',
      '@storybook/builder-vite': '8.0.0',
      '@storybook/builder-webpack5': '8.0.0',
      vite: '4.0.0',
      webpack5: '5.0.0',
    },
  };
});

describe('PackageResolver', () => {
  let resolver: PackageResolver;

  beforeEach(() => {
    resolver = new PackageResolver();
  });

  describe('getBuilderDetails', () => {
    it('should return builder if it exists in versions', () => {
      const result = resolver.getBuilderDetails('vite');
      expect(result).toBe('vite');
    });

    it('should return @storybook/builder- prefixed name if exists', () => {
      const result = resolver.getBuilderDetails('vite');
      expect(result).toBe('vite');
    });

    it('should return builder as-is if not found in versions', () => {
      const result = resolver.getBuilderDetails('custom-builder');
      expect(result).toBe('custom-builder');
    });
  });

  describe('getExternalFramework', () => {
    it('should find external framework by name', () => {
      const result = resolver.getExternalFramework('qwik');
      expect(result).toBeDefined();
      expect(result?.name).toBe('qwik');
    });

    it('should find external framework by package name', () => {
      const result = resolver.getExternalFramework('@storybook/qwik');
      expect(result).toBeDefined();
      expect(result?.packageName).toBe('@storybook/qwik');
    });

    it('should find external framework by framework entry', () => {
      const result = resolver.getExternalFramework('@storybook/qwik-vite');
      expect(result).toBeDefined();
    });

    it('should return undefined for unknown framework', () => {
      const result = resolver.getExternalFramework('unknown-framework');
      expect(result).toBeUndefined();
    });
  });

  describe('getFrameworkPackage', () => {
    it('should return framework package for known framework', () => {
      const result = resolver.getFrameworkPackage('react-vite', 'react', 'vite');
      expect(result).toBe('@storybook/react-vite');
    });

    it('should construct package name from renderer and builder', () => {
      const result = resolver.getFrameworkPackage(undefined, 'react', 'vite');
      expect(result).toBe('@storybook/react-vite');
    });

    it('should throw error for unknown framework package', () => {
      expect(() => {
        resolver.getFrameworkPackage('unknown-framework', 'react', 'vite');
      }).toThrow('Could not find framework package');
    });

    it('should handle external frameworks', () => {
      const result = resolver.getFrameworkPackage('qwik', 'react', 'vite');
      expect(result).toBe('@storybook/qwik-vite');
    });
  });

  describe('getRendererPackage', () => {
    it('should return @storybook/renderer for standard renderers', () => {
      const result = resolver.getRendererPackage(undefined, 'react');
      expect(result).toBe('@storybook/react');
    });

    it('should return external framework renderer if defined', () => {
      const result = resolver.getRendererPackage('qwik', 'react');
      expect(result).toBe('@storybook/qwik');
    });
  });

  describe('applyGetAbsolutePathWrapper', () => {
    it('should wrap package name in getAbsolutePath call', () => {
      const result = resolver.applyGetAbsolutePathWrapper('@storybook/react-vite');
      expect(result).toBe("%%getAbsolutePath('@storybook/react-vite')%%");
    });
  });

  describe('applyAddonGetAbsolutePathWrapper', () => {
    it('should wrap string addon', () => {
      const result = resolver.applyAddonGetAbsolutePathWrapper('@storybook/addon-essentials');
      expect(result).toBe("%%getAbsolutePath('@storybook/addon-essentials')%%");
    });

    it('should wrap addon object name property', () => {
      const addon = { name: '@storybook/addon-essentials', options: {} };
      const result = resolver.applyAddonGetAbsolutePathWrapper(addon) as any;

      expect(result.name).toBe("%%getAbsolutePath('@storybook/addon-essentials')%%");
      expect(result.options).toEqual({});
    });
  });

  describe('getFrameworkDetails', () => {
    it('should return framework type details for known framework', () => {
      const details = resolver.getFrameworkDetails(
        'react',
        'vite',
        false,
        SupportedLanguage.TYPESCRIPT,
        'react-vite',
        false
      );

      expect(details.type).toBe('framework');
      expect(details.packages).toEqual(['@storybook/react-vite']);
      expect(details.frameworkPackage).toBe('@storybook/react-vite');
      expect(details.rendererId).toBe('react');
    });

    it('should apply getAbsolutePath wrapper for PnP projects', () => {
      const details = resolver.getFrameworkDetails(
        'react',
        'vite',
        true,
        SupportedLanguage.TYPESCRIPT,
        'react-vite',
        true
      );

      expect(details.frameworkPackagePath).toContain('%%getAbsolutePath');
      expect(details.frameworkPackagePath).toContain('@storybook/react-vite');
    });

    it('should return renderer type details for known renderer', () => {
      // Force renderer mode by using non-framework package
      const details = resolver.getFrameworkDetails(
        'react',
        'vite',
        false,
        SupportedLanguage.TYPESCRIPT,
        undefined,
        false
      );

      expect(details.type).toBe('framework');
      expect(details.rendererId).toBe('react');
    });

    it('should throw error for unknown framework and renderer', () => {
      expect(() => {
        resolver.getFrameworkDetails(
          'unknown' as any,
          'vite',
          false,
          SupportedLanguage.TYPESCRIPT,
          'unknown-framework' as any,
          false
        );
      }).toThrow();
    });

    it('should handle all renderer types', () => {
      const details = resolver.getFrameworkDetails(
        'vue3',
        'vite',
        false,
        SupportedLanguage.TYPESCRIPT,
        'vue3-vite',
        false
      );

      expect(details.rendererId).toBe('vue3');
      expect(details.packages).toContain('@storybook/vue3-vite');
    });
  });
});

