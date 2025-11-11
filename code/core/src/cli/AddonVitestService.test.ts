import * as fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';

import { SupportedBuilder, SupportedFramework } from '../types';
import { AddonVitestService } from './AddonVitestService';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
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
      runPackageCommand: vi.fn(),
    } as Partial<JsPackageManager> as JsPackageManager;

    // Setup default mocks for logger and prompt
    vi.mocked(logger.info).mockImplementation(() => {});
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(prompt.executeTask).mockResolvedValue(undefined);
    vi.mocked(prompt.executeTaskWithSpinner).mockResolvedValue(undefined);
    vi.mocked(prompt.confirm).mockResolvedValue(true);
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
      // When vitest version is null, defaults to vitest 4+ behavior
      expect(deps).toContain('@vitest/browser-playwright');
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

    // Note: collectDependencies doesn't add framework-specific packages
    // It only collects base vitest packages
    it('should collect base packages without framework-specific additions', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce(null) // vitest version check
        .mockResolvedValueOnce(null) // @vitest/coverage-v8
        .mockResolvedValueOnce(null); // @vitest/coverage-istanbul

      const deps = await service.collectDependencies(mockPackageManager);

      // Should only contain base packages, not framework-specific ones
      expect(deps).toContain('vitest');
      // When vitest version is null, defaults to vitest 4+ behavior
      expect(deps).toContain('@vitest/browser-playwright');
      expect(deps).toContain('playwright');
      expect(deps).toContain('@vitest/coverage-v8');
      expect(deps.every((d) => !d.includes('nextjs-vite'))).toBe(true);
    });

    it('should not add @storybook/nextjs-vite for non-Next.js frameworks', async () => {
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue({});
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce(null) // vitest version
        .mockResolvedValueOnce(null) // @vitest/coverage-v8
        .mockResolvedValueOnce(null); // @vitest/coverage-istanbul

      const deps = await service.collectDependencies(mockPackageManager);

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
        .mockResolvedValueOnce('3.2.0') // vitest version check
        .mockResolvedValueOnce(null) // @vitest/coverage-v8
        .mockResolvedValueOnce(null); // @vitest/coverage-istanbul

      const deps = await service.collectDependencies(mockPackageManager);

      expect(deps).toContain('vitest@3.2.0');
      // Version 3.2.0 < 4.0.0, so uses @vitest/browser
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

    it('should return compatible when vitest >=4.0.0', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('4.0.0') // vitest
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

    it('should return compatible when vitest is not installed', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce(null) // vitest
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
        framework: SupportedFramework.REACT_VITE,
        builder: SupportedBuilder.VITE,
      });

      expect(result.compatible).toBe(true);
    });

    it('should return compatible for react-vite with Vite builder', async () => {
      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        framework: SupportedFramework.REACT_VITE,
        builder: SupportedBuilder.VITE,
      });

      expect(result.compatible).toBe(true);
    });

    it('should return incompatible for non-Vite builder (except Next.js)', async () => {
      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        framework: SupportedFramework.REACT_WEBPACK5,
        builder: SupportedBuilder.WEBPACK5,
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('Non-Vite builder'))).toBe(true);
    });

    it('should return incompatible for Next.js with webpack builder', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest
        .mockResolvedValueOnce(null); // msw

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        framework: SupportedFramework.NEXTJS,
        builder: SupportedBuilder.WEBPACK5,
      });

      // Test addon requires Vite builder, even for Next.js
      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('Non-Vite builder'))).toBe(true);
    });

    it('should return incompatible for unsupported framework', async () => {
      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        framework: SupportedFramework.ANGULAR,
        builder: SupportedBuilder.VITE,
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('cannot yet be used'))).toBe(true);
    });

    // Note: validateCompatibility currently doesn't validate Next.js installation
    // It only validates builder, framework support, package versions, and config files
    it('should return compatible for Next.js framework with valid setup', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion)
        .mockResolvedValueOnce('3.0.0') // vitest
        .mockResolvedValueOnce(null); // msw

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        framework: SupportedFramework.NEXTJS_VITE,
        builder: SupportedBuilder.VITE,
      });

      // NEXTJS_VITE framework is in SUPPORTED_FRAMEWORKS and Vite builder is compatible
      expect(result.compatible).toBe(true);
    });

    it('should validate config files when configDir provided', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.json');

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        framework: SupportedFramework.REACT_VITE,
        builder: SupportedBuilder.VITE,
        projectRoot: '.storybook',
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('JSON workspace'))).toBe(true);
    });

    it('should skip config file validation when no configDir provided', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.json');

      const result = await service.validateCompatibility({
        packageManager: mockPackageManager,
        framework: SupportedFramework.REACT_VITE,
        builder: SupportedBuilder.VITE,
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
        framework: SupportedFramework.ANGULAR,
        builder: SupportedBuilder.WEBPACK5,
      });

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.length).toBeGreaterThan(2);
    });
  });

  describe('installPlaywright', () => {
    beforeEach(() => {
      // Mock the logger methods used in installPlaywright
      vi.mocked(logger.log).mockImplementation(() => {});
      vi.mocked(logger.warn).mockImplementation(() => {});
    });

    it('should install Playwright successfully', async () => {
      vi.mocked(prompt.confirm).mockResolvedValue(true);
      vi.mocked(prompt.executeTaskWithSpinner).mockResolvedValue(undefined);

      const errors = await service.installPlaywright(mockPackageManager);

      expect(errors).toEqual([]);
      expect(prompt.confirm).toHaveBeenCalledWith({
        message: 'Do you want to install Playwright with Chromium now?',
        initialValue: true,
      });
      expect(prompt.executeTaskWithSpinner).toHaveBeenCalledWith(expect.any(Function), {
        id: 'playwright-installation',
        intro: 'Installing Playwright browser binaries',
        error: expect.stringContaining('An error occurred'),
        success: 'Playwright browser binaries installed successfully',
        abortable: true,
      });
    });

    it('should execute playwright install command', async () => {
      type ChildProcessFactory = (signal?: AbortSignal) => ExecaChildProcess;
      let commandFactory: ChildProcessFactory | ChildProcessFactory[];
      vi.mocked(prompt.confirm).mockResolvedValue(true);
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementation(
        async (factory: ChildProcessFactory | ChildProcessFactory[]) => {
          commandFactory = Array.isArray(factory) ? factory[0] : factory;
          // Simulate the child process completion
          commandFactory();
        }
      );

      await service.installPlaywright(mockPackageManager);

      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith({
        args: ['playwright', 'install', 'chromium', '--with-deps'],
        signal: undefined,
        stdio: 'ignore',
      });
    });

    it('should capture error stack when installation fails', async () => {
      const error = new Error('Installation failed');
      error.stack = 'Error stack trace';
      vi.mocked(prompt.confirm).mockResolvedValue(true);
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue(error);

      const errors = await service.installPlaywright(mockPackageManager);

      expect(errors).toEqual(['Error stack trace']);
    });

    it('should capture error message when installation fails without stack', async () => {
      const error = new Error('Installation failed');
      error.stack = undefined;
      vi.mocked(prompt.confirm).mockResolvedValue(true);
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue(error);

      const errors = await service.installPlaywright(mockPackageManager);

      expect(errors).toEqual(['Installation failed']);
    });

    it('should convert non-Error exceptions to string', async () => {
      vi.mocked(prompt.confirm).mockResolvedValue(true);
      vi.mocked(prompt.executeTaskWithSpinner).mockRejectedValue('String error');

      const errors = await service.installPlaywright(mockPackageManager);

      expect(errors).toEqual(['String error']);
    });

    it('should skip installation when user declines', async () => {
      vi.mocked(prompt.confirm).mockResolvedValue(false);

      const errors = await service.installPlaywright(mockPackageManager);

      expect(errors).toEqual([]);
      expect(prompt.executeTaskWithSpinner).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Playwright installation skipped');
    });

    it('should not skip installation by default', async () => {
      vi.mocked(prompt.confirm).mockResolvedValue(true);
      vi.mocked(prompt.executeTaskWithSpinner).mockResolvedValue(undefined);

      await service.installPlaywright(mockPackageManager);

      expect(prompt.confirm).toHaveBeenCalled();
      expect(prompt.executeTaskWithSpinner).toHaveBeenCalled();
    });
  });

  describe('validateConfigFiles', () => {
    beforeEach(() => {
      vi.mocked(find.any).mockReset();
      vi.mocked(find.any).mockReturnValue(undefined);
    });

    it('should return compatible when no config files found', async () => {
      vi.mocked(find.any).mockReturnValue(undefined);

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(true);
    });

    it('should reject JSON workspace files', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.json');

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.some((r) => r.includes('JSON workspace'))).toBe(true);
    });

    it('should validate non-JSON workspace files', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.ts');
      vi.mocked(fs.readFile).mockResolvedValue('export default ["project1", "project2"]');

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith('vitest.workspace.ts', 'utf8');
    });

    it('should reject invalid workspace config', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.ts');
      vi.mocked(fs.readFile).mockResolvedValue('export default "invalid"');

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('invalid workspace'))).toBe(true);
    });

    it('should reject CommonJS config files (.cts)', async () => {
      vi.mocked(find.any).mockReset();
      vi.mocked(find.any)
        .mockReturnValueOnce(undefined) // workspace
        .mockReturnValueOnce('vitest.config.cts'); // config

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.length).toBeGreaterThan(0);
      expect(result.reasons!.some((r) => r.includes('CommonJS config'))).toBe(true);
    });

    it('should reject CommonJS config files (.cjs)', async () => {
      vi.mocked(find.any)
        .mockReturnValueOnce(undefined) // workspace
        .mockReturnValueOnce('vitest.config.cjs'); // config

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('CommonJS config'))).toBe(true);
    });

    it('should validate non-CommonJS config files', async () => {
      vi.mocked(find.any)
        .mockReturnValueOnce(undefined) // workspace
        .mockReturnValueOnce('vitest.config.ts'); // config
      vi.mocked(fs.readFile).mockResolvedValue('export default defineConfig({ test: {} })');

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(true);
    });

    it('should reject invalid vitest config', async () => {
      vi.mocked(find.any)
        .mockReturnValueOnce(undefined) // workspace
        .mockReturnValueOnce('vitest.config.ts'); // config
      vi.mocked(fs.readFile).mockResolvedValue('export default {}');

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(false);
      expect(result.reasons!.some((r) => r.includes('invalid Vitest config'))).toBe(true);
    });

    it('should validate defineWorkspace expression', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.ts');
      vi.mocked(fs.readFile).mockResolvedValue('export default defineWorkspace(["project1"])');

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(true);
    });

    it('should validate workspace config with object expressions', async () => {
      vi.mocked(find.any).mockReturnValueOnce('vitest.workspace.ts');
      vi.mocked(fs.readFile).mockResolvedValue('export default [{ test: {} }, "project"]');

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(true);
    });

    it('should validate config with workspace array in test', async () => {
      vi.mocked(find.any)
        .mockReturnValueOnce(undefined) // workspace
        .mockReturnValueOnce('vitest.config.ts'); // config
      vi.mocked(fs.readFile).mockResolvedValue(
        'export default defineConfig({ test: { workspace: [] } })'
      );

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(true);
    });

    it('should accumulate multiple config validation errors', async () => {
      vi.mocked(find.any).mockReset();
      vi.mocked(find.any)
        .mockReturnValueOnce('vitest.workspace.json') // workspace JSON
        .mockReturnValueOnce('vitest.config.cjs'); // config CJS

      const result = await service.validateConfigFiles('.storybook');

      expect(result.compatible).toBe(false);
      expect(result.reasons).toBeDefined();
      expect(result.reasons!.length).toBe(2);
    });
  });
});
