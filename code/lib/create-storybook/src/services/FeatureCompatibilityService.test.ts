import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

import { FeatureCompatibilityService } from './FeatureCompatibilityService';

describe('FeatureCompatibilityService', () => {
  let service: FeatureCompatibilityService;

  beforeEach(() => {
    service = new FeatureCompatibilityService();
  });

  describe('supportsOnboarding', () => {
    it('should return true for supported project types', () => {
      expect(service.supportsOnboarding(ProjectType.REACT)).toBe(true);
      expect(service.supportsOnboarding(ProjectType.REACT_SCRIPTS)).toBe(true);
      expect(service.supportsOnboarding(ProjectType.NEXTJS)).toBe(true);
      expect(service.supportsOnboarding(ProjectType.VUE3)).toBe(true);
      expect(service.supportsOnboarding(ProjectType.ANGULAR)).toBe(true);
    });

    it('should return false for unsupported project types', () => {
      expect(service.supportsOnboarding(ProjectType.SVELTE)).toBe(false);
      expect(service.supportsOnboarding(ProjectType.EMBER)).toBe(false);
      expect(service.supportsOnboarding(ProjectType.HTML)).toBe(false);
    });
  });

  describe('supportsTestAddon', () => {
    it('should always return true for Next.js regardless of builder', () => {
      expect(service.supportsTestAddon(ProjectType.NEXTJS, 'webpack5')).toBe(true);
      expect(service.supportsTestAddon(ProjectType.NEXTJS, 'vite')).toBe(true);
    });

    it('should return false for webpack5 builder on non-Next.js projects', () => {
      expect(service.supportsTestAddon(ProjectType.REACT, 'webpack5')).toBe(false);
      expect(service.supportsTestAddon(ProjectType.VUE3, 'webpack5')).toBe(false);
    });

    it('should return true for supported projects with vite builder', () => {
      expect(service.supportsTestAddon(ProjectType.REACT, 'vite')).toBe(true);
      expect(service.supportsTestAddon(ProjectType.VUE3, 'vite')).toBe(true);
      expect(service.supportsTestAddon(ProjectType.SVELTE, 'vite')).toBe(true);
      expect(service.supportsTestAddon(ProjectType.SVELTEKIT, 'vite')).toBe(true);
    });

    it('should return false for unsupported projects', () => {
      expect(service.supportsTestAddon(ProjectType.ANGULAR, 'vite')).toBe(false);
      expect(service.supportsTestAddon(ProjectType.EMBER, 'vite')).toBe(false);
    });
  });

  describe('filterFeaturesByProjectType', () => {
    it('should keep all features for fully supported project type', () => {
      const features = new Set(['docs', 'test', 'onboarding'] as const);

      const filtered = service.filterFeaturesByProjectType(features, ProjectType.REACT, 'vite');

      expect(filtered).toEqual(new Set(['docs', 'test', 'onboarding']));
    });

    it('should remove onboarding for unsupported project type', () => {
      const features = new Set(['docs', 'test', 'onboarding'] as const);

      const filtered = service.filterFeaturesByProjectType(features, ProjectType.SVELTE, 'vite');

      expect(filtered).toEqual(new Set(['docs', 'test']));
      expect(filtered.has('onboarding')).toBe(false);
    });

    it('should remove test for webpack5 builder', () => {
      const features = new Set(['docs', 'test', 'onboarding'] as const);

      const filtered = service.filterFeaturesByProjectType(features, ProjectType.REACT, 'webpack5');

      expect(filtered).toEqual(new Set(['docs', 'onboarding']));
      expect(filtered.has('test')).toBe(false);
    });

    it('should keep test for Next.js with webpack5', () => {
      const features = new Set(['docs', 'test', 'onboarding'] as const);

      const filtered = service.filterFeaturesByProjectType(
        features,
        ProjectType.NEXTJS,
        'webpack5'
      );

      expect(filtered).toEqual(new Set(['docs', 'test', 'onboarding']));
    });

    it('should handle empty features set', () => {
      const features = new Set([]);

      const filtered = service.filterFeaturesByProjectType(features, ProjectType.REACT, 'vite');

      expect(filtered).toEqual(new Set([]));
    });
  });

  describe('validateTestFeatureCompatibility', () => {
    let mockPackageManager: JsPackageManager;

    beforeEach(() => {
      mockPackageManager = {
        getInstalledVersion: vi.fn(),
      } as Partial<JsPackageManager> as JsPackageManager;
    });

    it('should return compatible when all checks pass', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest >=3.0.0 required
        .mockResolvedValueOnce('2.0.0'); // msw

      const result = await service.validateTestFeatureCompatibility(mockPackageManager, '/test');

      expect(result.compatible).toBe(true);
    });

    it('should return incompatible if package versions check fails', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.5.0') // vitest < 3.0.0 (incompatible)
        .mockResolvedValueOnce(null); // msw

      const result = await service.validateTestFeatureCompatibility(mockPackageManager, '/test');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
    });
  });
});
