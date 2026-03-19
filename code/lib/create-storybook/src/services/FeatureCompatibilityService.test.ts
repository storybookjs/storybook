import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddonVitestService, ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedBuilder, SupportedFramework } from 'storybook/internal/types';

import { FeatureCompatibilityService } from './FeatureCompatibilityService';

vi.mock('storybook/internal/cli', { spy: true });

describe('FeatureCompatibilityService', () => {
  let service: FeatureCompatibilityService;
  const mockPackageManager = {
    getInstalledVersion: vi.fn(),
  } as Partial<JsPackageManager> as JsPackageManager;
  let mockAddonVitestService: AddonVitestService;

  beforeEach(() => {
    // Mock AddonVitestService constructor and methods
    const mockValidateCompatibility = vi.fn().mockResolvedValue({ compatible: true });
    vi.mocked(AddonVitestService).mockImplementation(function (this: any) {
      return {
        validateCompatibility: mockValidateCompatibility,
      };
    });

    mockAddonVitestService = new AddonVitestService(mockPackageManager);
    service = new FeatureCompatibilityService(mockPackageManager, mockAddonVitestService);
  });

  describe('supportsOnboarding', () => {
    it('should return true for supported project types', () => {
      expect(FeatureCompatibilityService.supportsOnboarding(ProjectType.REACT)).toBe(true);
      expect(FeatureCompatibilityService.supportsOnboarding(ProjectType.REACT_SCRIPTS)).toBe(true);
      expect(FeatureCompatibilityService.supportsOnboarding(ProjectType.NEXTJS)).toBe(true);
      expect(FeatureCompatibilityService.supportsOnboarding(ProjectType.VUE3)).toBe(true);
      expect(FeatureCompatibilityService.supportsOnboarding(ProjectType.ANGULAR)).toBe(true);
    });

    it('should return false for unsupported project types', () => {
      expect(FeatureCompatibilityService.supportsOnboarding(ProjectType.SVELTE)).toBe(false);
      expect(FeatureCompatibilityService.supportsOnboarding(ProjectType.EMBER)).toBe(false);
      expect(FeatureCompatibilityService.supportsOnboarding(ProjectType.HTML)).toBe(false);
    });
  });

  describe('validateTestFeatureCompatibility', () => {
    let mockValidateCompatibility: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Get the mocked validateCompatibility method
      mockValidateCompatibility = vi.mocked(mockAddonVitestService.validateCompatibility);
    });

    it('should return compatible when all checks pass', async () => {
      mockValidateCompatibility.mockResolvedValue({ compatible: true });

      const result = await service.validateTestFeatureCompatibility(
        SupportedFramework.REACT_VITE,
        SupportedBuilder.VITE,
        '/test'
      );

      expect(result.compatible).toBe(true);
      expect(mockValidateCompatibility).toHaveBeenCalledWith({
        framework: 'react-vite',
        builder: SupportedBuilder.VITE,
        projectRoot: '/test',
      });
    });

    it('should return incompatible if package versions check fails', async () => {
      mockValidateCompatibility.mockResolvedValue({
        compatible: false,
        reasons: ['Vitest version is too old'],
      });

      const result = await service.validateTestFeatureCompatibility(
        SupportedFramework.REACT_VITE,
        SupportedBuilder.VITE,
        '/test'
      );

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons).toContain('Vitest version is too old');
    });
  });
});
