import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as babel from 'storybook/internal/babel';
import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';

import * as find from 'empathic/find';

import { AddonVitestService } from './AddonVitestService';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/babel', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('empathic/find', { spy: true });

describe('AddonVitestService', () => {
  let service: AddonVitestService;
  let mockPackageManager: JsPackageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AddonVitestService();
    vi.mocked(getProjectRoot).mockReturnValue('/test/project');

    mockPackageManager = {
      getAllDependencies: vi.fn(),
      getInstalledVersion: vi.fn(),
    } as Partial<JsPackageManager> as JsPackageManager;
  });

  describe('collectDeps', () => {
    beforeEach(() => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion).mockResolvedValue(null);
    });

    it('should collect base packages when not installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce(null) // vitest version check
        .mockResolvedValueOnce(null) // @vitest/coverage-v8
        .mockResolvedValueOnce(null); // @vitest/coverage-istanbul

      const deps = await service.collectDependencies(mockPackageManager);

      expect(deps).toContain('vitest');
      expect(deps).toContain('@vitest/browser');
      expect(deps).toContain('playwright');
      expect(deps).toContain('@vitest/coverage-v8');
    });

    it('should not include base packages if already installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({
        vitest: '3.0.0',
        '@vitest/browser': '3.0.0',
        playwright: '1.0.0',
      });
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest version
        .mockResolvedValueOnce('3.0.0') // @vitest/coverage-v8
        .mockResolvedValueOnce(null); // @vitest/coverage-istanbul

      const deps = await service.collectDependencies(mockPackageManager);

      expect(deps).not.toContain('vitest');
      expect(deps).not.toContain('@vitest/browser');
      expect(deps).not.toContain('playwright');
    });

    it('should add @storybook/nextjs-vite for Next.js framework', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('8.0.0') // storybook version
        .mockResolvedValueOnce(null) // vitest version
        .mockResolvedValueOnce(null) // @vitest/coverage-v8
        .mockResolvedValueOnce(null); // @vitest/coverage-istanbul

      const deps = await service.collectDependencies(mockPackageManager, '@storybook/nextjs');

      expect(deps).toContain('@storybook/nextjs-vite@^8.0.0');
    });

    it('should not add @storybook/nextjs-vite for non-Next.js frameworks', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce(null) // vitest version
        .mockResolvedValueOnce(null) // @vitest/coverage-v8
        .mockResolvedValueOnce(null); // @vitest/coverage-istanbul

      const deps = await service.collectDependencies(mockPackageManager, '@storybook/react-vite');

      expect(deps.every((d) => !d.includes('nextjs-vite'))).toBe(true);
    });

    it('should not add coverage reporter if v8 already installed', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce(null) // vitest version
        .mockResolvedValueOnce('3.0.0') // @vitest/coverage-v8
        .mockResolvedValueOnce(null); // @vitest/coverage-istanbul

      const deps = await service.collectDependencies(mockPackageManager);

      expect(deps.every((d) => !d.includes('coverage'))).toBe(true);
    });

    it('skips coverage if istanbul', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce(null) // @vitest/coverage-v8
        .mockResolvedValueOnce('3.0.0') // @vitest/coverage-istanbul
        .mockResolvedValueOnce(null); // vitest version

      const deps = await service.collectDependencies(mockPackageManager);

      expect(deps.every((d) => !d.includes('coverage'))).toBe(true);
    });

    it('applies version', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce(null) // @vitest/coverage-v8
        .mockResolvedValueOnce(null) // @vitest/coverage-istanbul
        .mockResolvedValueOnce('3.2.0'); // vitest version

      const deps = await service.collectDependencies(mockPackageManager);

      expect(deps).toContain('vitest@3.2.0');
      expect(deps).toContain('@vitest/browser@3.2.0');
      expect(deps).toContain('@vitest/coverage-v8@3.2.0');
      expect(deps).toContain('playwright'); // no version for playwright
    });
  });

  describe('validatePackageVersions', () => {
    it('should return compatible when vitest >=3.0.0', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest
        .mockResolvedValueOnce(null); // msw

      const result = await service.validatePackageVersions(mockPackageManager);

      expect(result.compatible).toBe(true);
      expect(result.reasons).toBeUndefined();
    });

    it('should return incompatible when vitest <3.0.0', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.5.0') // vitest
        .mockResolvedValueOnce(null); // msw

      const result = await service.validatePackageVersions(mockPackageManager);

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.some((r) => r.includes('Vitest 3.0.0 or higher'))).toBe(true);
    });

    it('should return compatible when msw >=2.0.0', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest
        .mockResolvedValueOnce('2.0.0'); // msw

      const result = await service.validatePackageVersions(mockPackageManager);

      expect(result.compatible).toBe(true);
    });

    it('should return incompatible when msw <2.0.0', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest
        .mockResolvedValueOnce('1.9.0'); // msw

      const result = await service.validatePackageVersions(mockPackageManager);

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.some((r) => r.includes('MSW'))).toBe(true);
    });

    it('should return compatible when msw not installed', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest
        .mockResolvedValueOnce(null); // msw

      const result = await service.validatePackageVersions(mockPackageManager);

      expect(result.compatible).toBe(true);
    });

    it('should handle multiple validation failures', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.0.0') // vitest <3.0.0
        .mockResolvedValueOnce('1.0.0'); // msw <2.0.0

      const result = await service.validatePackageVersions(mockPackageManager);

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.length).toBe(2);
    });
  });

  describe('validateCompatibility', () => {
    beforeEach(() => {
      vi.mocked(mockPackageManager.getInstalledVersion).mockResolvedValue('3.0.0');
      vi.mocked(find.any).mockReturnValue(undefined);
    });

    it('should return compatible for valid Vite-based framework', async () => {
      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/react-vite',
        builderPackageName: '@storybook/builder-vite',
        hasCustomWebpackConfig: false,
      });

      expect(result.compatible).toBe(true);
    });

    it('should return incompatible with custom webpack config', async () => {
      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/react-vite',
        builderPackageName: '@storybook/builder-vite',
        hasCustomWebpackConfig: true,
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('Webpack'))).toBe(true);
    });

    it('should return incompatible for non-Vite builder (except Next.js)', async () => {
      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/react',
        builderPackageName: '@storybook/builder-webpack5',
        hasCustomWebpackConfig: false,
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('Vite-based'))).toBe(true);
    });

    it('should return compatible for Next.js even with webpack builder', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest
        .mockResolvedValueOnce(null) // msw
        .mockResolvedValueOnce('14.0.0'); // next

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/nextjs',
        builderPackageName: '@storybook/builder-webpack5',
        hasCustomWebpackConfig: false,
      });

      expect(result.compatible).toBe(true);
    });

    it('should return incompatible for unsupported framework', async () => {
      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/angular',
        builderPackageName: '@storybook/builder-vite',
        hasCustomWebpackConfig: false,
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('cannot yet be used'))).toBe(true);
    });

    it('should validate Next.js installation when using Next.js framework', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest
        .mockResolvedValueOnce(null) // msw
        .mockResolvedValueOnce(null); // next (not installed)

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/nextjs',
        builderPackageName: '@storybook/builder-vite',
        hasCustomWebpackConfig: false,
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('next'))).toBe(true);
    });

    it('should validate config files when configDir provided', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.json');

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/react-vite',
        builderPackageName: '@storybook/builder-vite',
        hasCustomWebpackConfig: false,
        configDir: '.storybook',
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('JSON workspace'))).toBe(true);
    });

    it('should skip config file validation when no configDir provided', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.json');

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/react-vite',
        builderPackageName: '@storybook/builder-vite',
        hasCustomWebpackConfig: false,
      });

      expect(result.compatible).toBe(true);
      expect(find.any).not.toHaveBeenCalled();
    });

    it('should accumulate multiple validation failures', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('2.0.0') // vitest <3.0.0
        .mockResolvedValueOnce('1.0.0'); // msw <2.0.0

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        frameworkPackageName: '@storybook/angular',
        builderPackageName: '@storybook/builder-webpack5',
        hasCustomWebpackConfig: true,
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.length).toBeGreaterThan(2);
    });
  });

  describe.skip('config validation', () => {
    beforeEach(() => {
      vi.mocked(find.any).mockReturnValue(undefined);
      vi.mocked(getProjectRoot).mockReturnValue('/test/project');
    });

    // TODO: These tests need to be fixed - they have issues with the mock setup
    it('passes without files', async () => {
      const result = await (service as any).validateConfigFiles('/test/dir');

      expect(result.compatible).toBe(true);
    });

    it('should detect JSON workspace file as incompatible', async () => {
      vi.mocked(find.any)
        .mockReturnValueOnce('vitest.workspace.json')
        .mockReturnValueOnce(undefined);

      const result = await (service as any).validateConfigFiles('/test/dir');

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r: string) => r.includes('JSON workspace'))).toBe(true);
    });

    it('should validate workspace file content', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.ts').mockReturnValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce('export default []');

      const mockAst = {
        type: 'File',
        program: { type: 'Program', body: [] },
      };
      vi.mocked(babel.babelParse).mockReturnValue(mockAst as any);

      const mockPath = {
        node: {
          declaration: {
            type: 'ArrayExpression',
            elements: [],
          },
        },
      };

      vi.mocked(babel.traverse).mockImplementation((ast: any, visitor: any) => {
        if (visitor.ExportDefaultDeclaration) {
          visitor.ExportDefaultDeclaration(mockPath);
        }
      });

      const result = await (service as any).validateConfigFiles('/test/dir');

      expect(result.compatible).toBe(true);
    });

    it('should detect CommonJS config file as incompatible', async () => {
      vi.mocked(find.any)
        .mockReturnValueOnce(undefined) // no workspace
        .mockReturnValueOnce('vitest.config.cts'); // CommonJS config

      const result = await (service as any).validateConfigFiles('/test/dir');

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r: string) => r.includes('CommonJS'))).toBe(true);
    });

    it('should validate vitest config file content', async () => {
      vi.mocked(find.any)
        .mockReturnValueOnce(undefined) // no workspace
        .mockReturnValueOnce('vitest.config.ts');

      vi.mocked(fs.readFile).mockResolvedValueOnce('export default defineConfig({})');

      const mockAst = {
        type: 'File',
        program: { type: 'Program', body: [] },
      };
      vi.mocked(babel.babelParse).mockReturnValue(mockAst as any);

      const mockPath = {
        node: {
          declaration: {
            type: 'CallExpression',
            callee: { name: 'defineConfig' },
            arguments: [
              {
                type: 'ObjectExpression',
                properties: [],
              },
            ],
          },
        },
      };

      vi.mocked(babel.traverse).mockImplementation((ast: any, visitor: any) => {
        if (visitor.ExportDefaultDeclaration) {
          visitor.ExportDefaultDeclaration(mockPath);
        }
      });

      const result = await (service as any).validateConfigFiles('/test/dir');

      expect(result.compatible).toBe(true);
    });
  });
});
