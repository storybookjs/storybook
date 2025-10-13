import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportedLanguage, copyTemplateFiles } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

import { TemplateManager } from './TemplateManager';

vi.mock('storybook/internal/cli', async () => {
  const actual = await vi.importActual('storybook/internal/cli');
  return {
    ...actual,
    copyTemplateFiles: vi.fn(),
  };
});

vi.mock('storybook/internal/common', async () => {
  const actual = await vi.importActual('storybook/internal/common');
  return {
    ...actual,
    frameworkPackages: {
      '@storybook/react-vite': 'react-vite',
      '@storybook/vue3-vite': 'vue3-vite',
    },
    optionalEnvToBoolean: vi.fn().mockReturnValue(false),
  };
});

describe('TemplateManager', () => {
  let manager: TemplateManager;

  beforeEach(() => {
    manager = new TemplateManager();
    vi.clearAllMocks();
  });

  describe('hasFrameworkTemplates', () => {
    it('should return true for frameworks with templates', () => {
      expect(manager.hasFrameworkTemplates('angular')).toBe(true);
      expect(manager.hasFrameworkTemplates('nextjs')).toBe(true);
      expect(manager.hasFrameworkTemplates('react-vite')).toBe(true);
      expect(manager.hasFrameworkTemplates('vue3-vite')).toBe(true);
      expect(manager.hasFrameworkTemplates('sveltekit')).toBe(true);
    });

    it('should return false for frameworks without templates', () => {
      expect(manager.hasFrameworkTemplates('unknown')).toBe(false);
      expect(manager.hasFrameworkTemplates('custom-framework')).toBe(false);
    });

    it('should return false for undefined framework', () => {
      expect(manager.hasFrameworkTemplates(undefined)).toBe(false);
    });

    it('should handle nuxt based on sandbox environment', async () => {
      const common = await import('storybook/internal/common');

      // Not in sandbox
      vi.mocked(common.optionalEnvToBoolean).mockReturnValueOnce(false);
      expect(manager.hasFrameworkTemplates('nuxt')).toBe(true);

      // In sandbox
      vi.mocked(common.optionalEnvToBoolean).mockReturnValueOnce(true);
      expect(manager.hasFrameworkTemplates('nuxt')).toBe(false);
    });
  });

  describe('copyTemplates', () => {
    let mockPackageManager: JsPackageManager;

    beforeEach(() => {
      mockPackageManager = {} as any;

      // Mock the private getCommonAssetsDir method
      vi.spyOn(manager as any, 'getCommonAssetsDir').mockReturnValue(
        '/test/path/rendererAssets/common'
      );
    });

    it('should copy templates using framework location when available', async () => {
      await manager.copyTemplates(
        'react-vite',
        '@storybook/react-vite',
        'react',
        mockPackageManager,
        SupportedLanguage.TYPESCRIPT,
        './src/stories',
        ['docs']
      );

      expect(copyTemplateFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          templateLocation: 'react-vite',
          packageManager: mockPackageManager,
          language: SupportedLanguage.TYPESCRIPT,
          destination: './src/stories',
          features: ['docs'],
        })
      );
    });

    it('should use renderer as template location when framework has no templates', async () => {
      await manager.copyTemplates(
        undefined,
        '@storybook/react',
        'react',
        mockPackageManager,
        SupportedLanguage.JAVASCRIPT,
        undefined,
        []
      );

      expect(copyTemplateFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          templateLocation: 'react',
          language: SupportedLanguage.JAVASCRIPT,
        })
      );
    });

    it('should resolve framework from frameworkPackages', async () => {
      await manager.copyTemplates(
        undefined,
        '@storybook/react-vite',
        'react',
        mockPackageManager,
        SupportedLanguage.TYPESCRIPT,
        undefined,
        []
      );

      expect(copyTemplateFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          templateLocation: 'react-vite',
        })
      );
    });

    it('should throw error if template location cannot be determined', async () => {
      await expect(
        manager.copyTemplates(
          undefined,
          undefined,
          undefined as any,
          mockPackageManager,
          SupportedLanguage.TYPESCRIPT,
          undefined,
          []
        )
      ).rejects.toThrow('Could not find template location');
    });
  });

  describe('getTemplateLocation', () => {
    it('should return framework location when templates exist', () => {
      const location = manager.getTemplateLocation('nextjs', '@storybook/nextjs', 'react');
      expect(location).toBe('nextjs');
    });

    it('should return renderer when framework has no templates', () => {
      const location = manager.getTemplateLocation(undefined, undefined, 'react');
      expect(location).toBe('react');
    });

    it('should use frameworkPackages mapping', () => {
      const location = manager.getTemplateLocation(undefined, '@storybook/react-vite', 'react');
      expect(location).toBe('react-vite');
    });

    it('should throw error for invalid inputs', () => {
      expect(() => {
        manager.getTemplateLocation(undefined, undefined, undefined as any);
      }).toThrow('Could not find template location');
    });
  });
});
