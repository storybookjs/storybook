import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddonVitestService, ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedBuilder, SupportedFramework } from 'storybook/internal/types';

import { FeatureCompatibilityService } from './FeatureCompatibilityService';

vi.mock('storybook/internal/cli', async () => {
  const actual = await vi.importActual('storybook/internal/cli');
  return {
    ...actual,
    AddonVitestService: vi.fn().mockImplementation(() => ({
      validateCompatibility: vi.fn(),
    })),
  };
});

describe('FeatureCompatibilityService', () => {
  let service: FeatureCompatibilityService;
  let mockAddonVitestService: AddonVitestService;

  beforeEach(() => {
    // @ts-expect-error accept old constructor in mock context
    mockAddonVitestService = new AddonVitestService({} as any);
    service = new FeatureCompatibilityService(mockAddonVitestService);
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
    let mockPackageManager: JsPackageManager;
    let mockValidateCompatibility: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockPackageManager = {
        getInstalledVersion: vi.fn(),
      } as Partial<JsPackageManager> as JsPackageManager;

      // Get the mocked validateCompatibility method
      mockValidateCompatibility = vi.mocked(mockAddonVitestService.validateCompatibility);
    });

    it('should return compatible when all checks pass', async () => {
      mockValidateCompatibility.mockResolvedValue({ compatible: true });

      const result = await service.validateTestFeatureCompatibility(
        mockPackageManager,
        SupportedFramework.REACT_VITE,
        SupportedBuilder.VITE,
        '/test'
      );

      expect(result.compatible).toBe(true);
      expect(mockValidateCompatibility).toHaveBeenCalledWith({
        packageManager: mockPackageManager,
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
        mockPackageManager,
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
