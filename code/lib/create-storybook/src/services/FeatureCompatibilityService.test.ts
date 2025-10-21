import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddonVitestService, CoreBuilder, ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

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

  describe('validateTestFeatureCompatibility', () => {
    let mockPackageManager: JsPackageManager;
    let mockValidateCompatibility: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockPackageManager = {
        getInstalledVersion: vi.fn(),
      } as Partial<JsPackageManager> as JsPackageManager;

      // Mock AddonVitestService.validateCompatibility
      mockValidateCompatibility = vi.fn().mockResolvedValue({ compatible: true });
      vi.mocked(AddonVitestService).mockImplementation(
        () =>
          ({
            validateCompatibility: mockValidateCompatibility,
          }) as any
      );
    });

    it('should return compatible when all checks pass', async () => {
      mockValidateCompatibility.mockResolvedValue({ compatible: true });

      const result = await service.validateTestFeatureCompatibility(
        mockPackageManager,
        'react-vite',
        CoreBuilder.Vite,
        '/test'
      );

      expect(result.compatible).toBe(true);
      expect(mockValidateCompatibility).toHaveBeenCalledWith({
        packageManager: mockPackageManager,
        framework: 'react-vite',
        builderPackageName: CoreBuilder.Vite,
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
        'react-vite',
        CoreBuilder.Vite,
        '/test'
      );

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons).toContain('Vitest version is too old');
    });
  });
});
