import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as babel from 'storybook/internal/babel';
import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';

import * as find from 'empathic/find';

import { FeatureCompatibilityService } from './FeatureCompatibilityService';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/babel', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('empathic/find', { spy: true });

describe('FeatureCompatibilityService', () => {
  let service: FeatureCompatibilityService;

  beforeEach(() => {
    service = new FeatureCompatibilityService();
    vi.mocked(getProjectRoot).mockReturnValue('/test/project');
    vi.clearAllMocks();
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

  describe('validatePackageVersions', () => {
    let mockPackageManager: JsPackageManager;

    beforeEach(() => {
      mockPackageManager = {
        getInstalledVersion: vi.fn(),
      } as any;
    });

    it('should return compatible when check passes', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.1.0') // vitest
        .mockResolvedValueOnce('2.0.0'); // msw

      const result = await service.validatePackageVersions(mockPackageManager);

      expect(result.compatible).toBe(true);
      expect(result.reasons).toBeUndefined();
    });

    it('should return incompatible with reasons when check fails', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.0.0') // vitest < 2.1.0
        .mockResolvedValueOnce(null); // msw

      const result = await service.validatePackageVersions(mockPackageManager);

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.length).toBeGreaterThan(0);
    });
  });

  describe('validateVitestConfigFiles', () => {
    beforeEach(() => {
      vi.mocked(find.any).mockReturnValue(undefined);
    });

    it('should return compatible when no config files found', async () => {
      const result = await service.validateVitestConfigFiles('/test/dir');

      expect(result.compatible).toBe(true);
      expect(result.reasons).toBeUndefined();
    });

    it('should detect JSON workspace file', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.json');

      const result = await service.validateVitestConfigFiles('/test/dir');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.some((r) => r.includes('JSON workspace file'))).toBe(true);
    });

    it('should detect CommonJS config file', async () => {
      vi.mocked(find.any)
        .mockReturnValueOnce(undefined) // no workspace
        .mockReturnValueOnce('vitest.config.cts'); // CJS config

      const result = await service.validateVitestConfigFiles('/test/dir');

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('CommonJS config file'))).toBe(true);
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
      } as any;
    });

    it('should return compatible when all checks pass', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.1.0') // vitest
        .mockResolvedValueOnce('2.0.0'); // msw

      const result = await service.validateTestFeatureCompatibility(mockPackageManager, '/test');

      expect(result.compatible).toBe(true);
    });

    it('should return incompatible if package versions check fails', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.0.0') // vitest < 2.1.0
        .mockResolvedValueOnce(null); // msw

      const result = await service.validateTestFeatureCompatibility(mockPackageManager, '/test');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
    });

    it('should return incompatible if vitest config check fails', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.1.0') // vitest ok
        .mockResolvedValueOnce('2.0.0'); // msw ok

      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.json'); // JSON workspace

      const result = await service.validateTestFeatureCompatibility(mockPackageManager, '/test');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
    });
  });
});
